import type { ApiClient } from '../api/client';
import type {
  MetroLine,
  PassengerNotification,
  PlannedJourney,
  PlannedLeg,
  PlannedStop,
  RouteStrategy,
  StationByLineItem,
  StationDetail,
  StationSearchResult,
} from '../types';
import type { MetroNetwork } from '../network';

const API_V1 = '/api/v1';

/** The one passenger network this app covers. */
export const BMRC_NETWORK: MetroNetwork = 'dmrc';

interface BmrcStationLine {
  line_code: string;
  line_id: number;
  line_name: string;
  line_name_kn: string;
  color: string;
  color_hex: string | null;
  order: number;
}

interface BmrcStation {
  code: string;
  name: string;
  name_kn: string;
  latitude: number | null;
  longitude: number | null;
  interchange: boolean;
  lines: BmrcStationLine[];
}

interface BmrcLine {
  code: string;
  line_id: number;
  name: string;
  name_kn: string;
  color: string;
  color_hex: string | null;
  station_count: number;
  start_station: string | null;
  end_station: string | null;
}

interface BmrcLineDetail extends BmrcLine {
  stations: BmrcStation[];
}

interface BmrcLeg {
  line_code: string;
  line_name: string;
  line_name_kn: string;
  color: string;
  color_hex: string | null;
  from_station: { code: string; name: string; name_kn: string };
  to_station: { code: string; name: string; name_kn: string };
  stations: { code: string; name: string; name_kn: string }[];
  hop_count: number;
}

interface BmrcPlan {
  from_station: { code: string; name: string; name_kn: string };
  to_station: { code: string; name: string; name_kn: string };
  strategy: RouteStrategy;
  strategies_differ: boolean;
  station_count: number;
  legs: BmrcLeg[];
  interchanges: { code: string; name: string; name_kn: string }[];
  fare: {
    zone: string;
    token: number;
    smart_card_peak: number;
    smart_card_off_peak: number;
    group_ticket: number;
    source: string;
  };
  parking_at_origin: {
    station_code: string;
    station_name: string;
    two_wheeler: number | null;
    four_wheeler: number | null;
    lcv: number | null;
  } | null;
}

interface BmrcNewsItem {
  id: number;
  title: string;
  title_kn: string;
  from_date: string | null;
  to_date: string | null;
  marquee: boolean;
  latest: boolean;
  pdf_url: string | null;
  pdf_url_kn: string | null;
}

/** BMRC sends an ISO timestamp; the notices read as a date, not a time. */
function newsDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Station codes are the stable key everywhere else, so they also stand in for
 * the numeric ids the view layer expects. A small deterministic hash keeps
 * list keys stable across fetches without inventing a second identity.
 */
function idForCode(code: string): number {
  let hash = 0;
  for (let index = 0; index < code.length; index += 1) {
    hash = (hash * 31 + code.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function lineFromBmrc(line: BmrcLine): MetroLine {
  return {
    id: line.line_id,
    name: line.name,
    name_kn: line.name_kn,
    line_color: line.name,
    line_code: line.code,
    primary_color_code: line.color_hex ?? '#6D28D9',
    secondary_color_code: null,
    class_primary: line.color,
    class_secondary: null,
    start_station: line.start_station ?? '',
    end_station: line.end_station ?? '',
    show_in_frontend: true,
    status: '',
    network: BMRC_NETWORK,
  };
}

function lineFromStationLine(line: BmrcStationLine): MetroLine {
  return {
    id: line.line_id,
    name: line.line_name,
    name_kn: line.line_name_kn,
    line_color: line.line_name,
    line_code: line.line_code,
    primary_color_code: line.color_hex ?? '#6D28D9',
    secondary_color_code: null,
    class_primary: line.color,
    class_secondary: null,
    start_station: '',
    end_station: '',
    show_in_frontend: true,
    status: '',
    network: BMRC_NETWORK,
  };
}

function stationSearchResult(station: BmrcStation): StationSearchResult {
  return {
    id: idForCode(station.code),
    station_name: station.name,
    station_name_kn: station.name_kn,
    station_code: station.code,
    station_facility: [],
    metro_lines: station.lines.map((line) => ({
      line_id: line.line_id,
      line_code: line.line_code,
      line_name: line.line_name,
      line_color: line.line_name,
      primary_color_code: line.color_hex ?? '#6D28D9',
    })),
    network: BMRC_NETWORK,
  };
}

function stationByLineItem(station: BmrcStation): StationByLineItem {
  return {
    id: idForCode(station.code),
    station_name: station.name,
    station_name_kn: station.name_kn,
    station_code: station.code,
    station_facility: [],
    interchange: station.interchange,
    status: '',
  };
}

function stationDetail(station: BmrcStation): StationDetail {
  return {
    id: idForCode(station.code),
    station_code: station.code,
    station_name: station.name,
    station_name_kn: station.name_kn,
    station_commercial_name: null,
    station_description: null,
    station_type: null,
    interchange: station.interchange,
    latitude: station.latitude,
    longitude: station.longitude,
    mobile: null,
    landline: null,
    station_status: [],
    metro_lines: station.lines.map(lineFromStationLine),
    prev_next_stations: [],
    station_facility: [],
    gates: [],
    lifts: [],
    platforms: [],
    stations_facilities: [],
    parkings: [],
    nearby_places: [],
    feeder: [],
    first_last_train: null,
  };
}

function plannedStops(leg: BmrcLeg): PlannedStop[] {
  return leg.stations.map((station) => ({
    name: station.name,
    name_kn: station.name_kn,
    status: null,
  }));
}

function plannedLeg(leg: BmrcLeg): PlannedLeg {
  return {
    kind: 'metro',
    network: BMRC_NETWORK,
    source: null,
    walk_metres: null,
    note: null,
    line_name: leg.line_name,
    line_number: null,
    line_color: leg.color_hex,
    from_station: leg.from_station.name,
    from_station_code: leg.from_station.code,
    to_station: leg.to_station.name,
    to_station_code: leg.to_station.code,
    station_count: leg.hop_count,
    stops: plannedStops(leg),
    map_path: [],
    duration: null,
    distance_km: null,
    direction: null,
    platform_name: null,
    towards_station: null,
    start_time: null,
    end_time: null,
    interchange_minutes: null,
  };
}

function plannedJourney(plan: BmrcPlan): PlannedJourney {
  return {
    source: 'dmrc',
    networks: [BMRC_NETWORK],
    separate_tickets: false,
    fallback_reason: null,
    strategy: plan.strategy,
    exclude_airport_line: false,
    origin: {
      name: plan.from_station.name,
      name_kn: plan.from_station.name_kn,
      code: plan.from_station.code,
      slug: null,
      legacy_code: null,
      sarthi_code: null,
      status: null,
    },
    destination: {
      name: plan.to_station.name,
      name_kn: plan.to_station.name_kn,
      code: plan.to_station.code,
      slug: null,
      legacy_code: null,
      sarthi_code: null,
      status: null,
    },
    station_count: plan.station_count,
    strategies_differ: plan.strategies_differ,
    total_time: null,
    total_distance_km: null,
    fare: {
      normal: plan.fare.token,
      special: null,
      applicable: null,
      breakdown: [],
      bmrc: {
        zone: plan.fare.zone,
        token: plan.fare.token,
        smart_card_peak: plan.fare.smart_card_peak,
        smart_card_off_peak: plan.fare.smart_card_off_peak,
        group_ticket: plan.fare.group_ticket,
      },
    },
    legs: plan.legs.map(plannedLeg),
    interchanges: plan.interchanges.map((station) => ({
      station: station.name,
      minutes: null,
    })),
    metro_service: null,
    service_available: null,
    ticket_available: null,
    bookings: [],
  };
}

/**
 * Reads Namma Metro's public API and shapes the answers into the view models
 * the screens already speak. Everything the BMRC API does not publish (gates,
 * lifts, platforms, timings, service status) is returned empty, so those
 * sections stay hidden instead of showing invented values.
 */
export const bmrcApi = {
  async getLines(apiClient: ApiClient): Promise<MetroLine[]> {
    const lines = await apiClient.get<BmrcLine[]>(`${API_V1}/lines`);
    return lines.map(lineFromBmrc);
  },

  async getLineStations(apiClient: ApiClient, lineCode: string): Promise<StationByLineItem[]> {
    const detail = await apiClient.get<BmrcLineDetail>(
      `${API_V1}/lines/${encodeURIComponent(lineCode)}/stations`,
    );
    return detail.stations.map(stationByLineItem);
  },

  async searchStations(apiClient: ApiClient, query: string): Promise<StationSearchResult[]> {
    const stations = await apiClient.get<BmrcStation[]>(`${API_V1}/stations/search`, {
      query: { query },
    });
    return stations.map(stationSearchResult);
  },

  async getStation(apiClient: ApiClient, stationCode: string): Promise<StationDetail> {
    const station = await apiClient.get<BmrcStation>(
      `${API_V1}/stations/${encodeURIComponent(stationCode)}`,
    );
    return stationDetail(station);
  },

  async planJourney(
    apiClient: ApiClient,
    fromStationCode: string,
    toStationCode: string,
    strategy: RouteStrategy,
  ): Promise<PlannedJourney> {
    const plan = await apiClient.get<BmrcPlan>(`${API_V1}/journeys/plan`, {
      query: {
        from_station_code: fromStationCode,
        to_station_code: toStationCode,
        strategy,
      },
    });
    return plannedJourney(plan);
  },

  async getNews(apiClient: ApiClient): Promise<PassengerNotification[]> {
    const items = await apiClient.get<BmrcNewsItem[]>(`${API_V1}/news`);
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      title_kn: item.title_kn,
      notification_type: null,
      image: null,
      video_url: null,
      link_to: null,
      link_to_file: item.pdf_url,
      link_to_internal_page: null,
      link_to_outside_url: null,
      date: newsDate(item.from_date),
    }));
  },
};
