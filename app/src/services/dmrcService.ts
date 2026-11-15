import type { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import { catalogCache, type Cached } from '../storage/catalogCache';
import { asSearchResult, toStoredStation } from '../storage/stationCatalog';
import { popularRoutesRepository } from '../storage/popularRoutesRepository';
import { stationSearchCacheRepository } from '../storage/stationSearchCacheRepository';
import type {
  JourneyScope,
  MetroLine,
  PassengerNotification,
  PassengerNotificationDetail,
  PlannedJourney,
  RouteStrategy,
  StationByLineItem,
  StationDetail,
  StationSearchResult,
} from '../types';
import type { MetroNetwork } from '../network';
import { BMRC_NETWORK, bmrcApi } from './bmrcApi';

/** The network every request here runs against. */
const NETWORK: MetroNetwork = BMRC_NETWORK;

export interface JourneyRequest {
  fromStationCode: string;
  toStationCode: string;
  strategy: RouteStrategy;
  journeyTime?: string;
}

export interface PlanJourneyRequest {
  fromStationCode: string;
  toStationCode: string;
  strategy: RouteStrategy;
  /** Ignored: BMRC publishes one fare table, not a time-of-day one. */
  journeyTime?: string;
  excludeAirportLine?: boolean;
  source?: 'sarthi' | 'dmrc' | 'nmrc';
  network?: MetroNetwork;
  /** Local-cache scope for the saved plan. */
  scope?: JourneyScope;
}

/** A stored document, marked as an offline copy. `null` when nothing is stored. */
function asCached<T>(
  document: { payload: T; savedAt: number } | null,
): Cached<T> | null {
  if (!document) return null;
  return { data: document.payload, savedAt: document.savedAt, fromCache: true };
}

export class DmrcService {
  constructor(private readonly apiClient: ApiClient) {}

  getCachedLinesFor(network: MetroNetwork = NETWORK): Promise<Cached<MetroLine[]> | null> {
    return catalogCache.readLines(network).then(asCached);
  }

  getCachedLines(): Promise<Cached<MetroLine[]> | null> {
    return this.getCachedLinesFor(NETWORK);
  }

  getLines(
    network: MetroNetwork = NETWORK,
    shown?: Cached<MetroLine[]>,
  ): Promise<Cached<MetroLine[]>> {
    return catalogCache.lines(
      network,
      () => bmrcApi.getLines(this.apiClient),
      shown,
    );
  }

  /** Kept for the hooks' shape; there is one operator, so nothing to merge. */
  getAllLinesAcrossNetworks(
    shown?: Cached<MetroLine[]>,
  ): Promise<Cached<MetroLine[]>> {
    return this.getLines(NETWORK, shown);
  }

  getCachedNotifications(
    network: MetroNetwork = NETWORK,
  ): Promise<Cached<PassengerNotification[]> | null> {
    return catalogCache.readNotifications(network).then(asCached);
  }

  getNotifications(
    network: MetroNetwork = NETWORK,
    shown?: Cached<PassengerNotification[]>,
  ): Promise<Cached<PassengerNotification[]>> {
    return catalogCache.notifications(
      network,
      () => bmrcApi.getNews(this.apiClient),
      shown,
    );
  }

  getCachedNotificationDetail(
    pageSlug: string,
  ): Promise<Cached<PassengerNotificationDetail> | null> {
    return catalogCache.readNotificationDetail(pageSlug).then(asCached);
  }

  /**
   * BMRC notices are PDFs with no in-app page, so nothing links here. Answering
   * with an empty page keeps a stray deep link from crashing instead of
   * pretending there is content.
   */
  getNotificationDetail(
    pageSlug: string,
    shown?: Cached<PassengerNotificationDetail>,
  ): Promise<Cached<PassengerNotificationDetail>> {
    return catalogCache.notificationDetail(
      pageSlug,
      () =>
        Promise.reject(
          new ApiError('This notice opens as a PDF.', 404),
        ),
      shown,
    );
  }

  searchStations(
    query: string,
    _network: MetroNetwork = NETWORK,
  ): Promise<StationSearchResult[]> {
    return bmrcApi.searchStations(this.apiClient, query);
  }

  getCachedStations(network: MetroNetwork = NETWORK): Promise<StationSearchResult[] | null> {
    return stationSearchCacheRepository.getStations(network);
  }

  async getAllStationsAndRefreshCache(
    network: MetroNetwork = NETWORK,
  ): Promise<StationSearchResult[]> {
    const cachedStations = await stationSearchCacheRepository.getStations(network);

    try {
      const stations = await this.searchStations('', network);
      const stored = stations.map(toStoredStation);
      await stationSearchCacheRepository.saveStations(stations, network);
      // The stored copy drops the facility lists, which no search screen
      // renders. Returning that shape keeps memory in line with the disk.
      return stored.map(asSearchResult);
    } catch (error) {
      if (cachedStations) {
        return cachedStations;
      }
      throw error;
    }
  }

  /** All stations on the one network this app covers. */
  async getAllStationsAcrossNetworks(): Promise<StationSearchResult[]> {
    return this.getAllStationsAndRefreshCache(NETWORK);
  }

  planJourney(request: PlanJourneyRequest): Promise<PlannedJourney> {
    return bmrcApi.planJourney(
      this.apiClient,
      request.fromStationCode,
      request.toStationCode,
      request.strategy,
    );
  }

  /**
   * Plan a journey, keeping the last successful plan for this route so a
   * tunnel does not erase the answer already on screen.
   */
  async planJourneyWithLocalCache(
    request: PlanJourneyRequest,
    shown?: Cached<PlannedJourney>,
  ): Promise<Cached<PlannedJourney>> {
    const scope = request.scope ?? request.network ?? NETWORK;
    try {
      const plan = await this.planJourney(request);
      const savedAt = Date.now();
      await popularRoutesRepository.savePlannedJourney(
        request.fromStationCode,
        request.toStationCode,
        request.strategy,
        plan,
        scope,
      );
      return { data: plan, savedAt, fromCache: false };
    } catch (error) {
      // Keep the plan already on screen rather than swapping in an older
      // stored one and calling it offline.
      if (shown && !shown.fromCache) return shown;

      const cached = await popularRoutesRepository.getPlannedJourney(
        request.fromStationCode,
        request.toStationCode,
        request.strategy,
        scope,
      );
      if (cached) {
        return { data: cached.plan, savedAt: cached.savedAt ?? 0, fromCache: true };
      }
      throw error;
    }
  }

  async getPopularRoutes(limit = 5) {
    return popularRoutesRepository.getPopularRoutes(limit);
  }

  getCachedStationsByLine(
    lineCode: string,
    network: MetroNetwork = NETWORK,
  ): Promise<Cached<StationByLineItem[]> | null> {
    return catalogCache.readStationsByLine(network, lineCode).then(asCached);
  }

  getStationsByLine(
    lineCode: string,
    network: MetroNetwork = NETWORK,
    shown?: Cached<StationByLineItem[]>,
  ): Promise<Cached<StationByLineItem[]>> {
    return catalogCache.stationsByLine(
      network,
      lineCode,
      () => bmrcApi.getLineStations(this.apiClient, lineCode),
      shown,
    );
  }

  getCachedStationDetail(
    stationCode: string,
    network: MetroNetwork = NETWORK,
  ): Promise<Cached<StationDetail> | null> {
    return catalogCache.readStationDetail(network, stationCode).then(asCached);
  }

  getStationDetail(
    stationCode: string,
    network: MetroNetwork = NETWORK,
    shown?: Cached<StationDetail>,
  ): Promise<Cached<StationDetail>> {
    return catalogCache.stationDetail(
      network,
      stationCode,
      () => bmrcApi.getStation(this.apiClient, stationCode),
      shown,
    );
  }
}
