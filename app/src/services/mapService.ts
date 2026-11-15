import { apiClient } from '../api/client';
import { catalogCache, type Cached } from '../storage/catalogCache';
import type {
  MapAsset,
  MapAssetByFormatResponse,
  MapAssetListResponse,
  MapFamily,
  MapFormat,
} from '../types';
import type { MetroNetwork } from '../network';

const API_V1 = '/api/v1';

interface BmrcMapRow {
  family: MapFamily;
  title: string;
  content_type: string;
  source_url: string;
}

function toAsset(row: BmrcMapRow): MapAsset {
  return {
    ...row,
    url: `${apiClient.baseUrl}${API_V1}/maps/${row.family}/file`,
  };
}

async function fetchAssets(): Promise<MapAsset[]> {
  const rows = await apiClient.get<BmrcMapRow[]>(`${API_V1}/maps`);
  return rows.map(toAsset);
}

export const mapService = {
  async getAllAssets(_network: MetroNetwork = 'dmrc'): Promise<MapAssetListResponse> {
    return { assets: await fetchAssets() };
  },

  async getFamilyAssets(
    family: MapFamily,
    _format: MapFormat = 'any',
    _network: MetroNetwork = 'dmrc',
  ): Promise<MapAssetListResponse> {
    const assets = await fetchAssets();
    return { assets: assets.filter((asset) => asset.family === family) };
  },

  /** The last metadata this device stored for one family, if any. */
  async getCachedFamilyPrimaryMaps(
    family: MapFamily,
    network: MetroNetwork = 'dmrc',
  ): Promise<Cached<MapAssetByFormatResponse> | null> {
    const stored = await catalogCache.readMap(network, family);
    if (!stored) return null;
    return { data: stored.payload, savedAt: stored.savedAt, fromCache: true };
  },

  /**
   * The metadata is cached so the map opens from the image `expo-image`
   * already stored on disk, even when the metadata call fails.
   */
  getFamilyPrimaryMaps(
    family: MapFamily,
    network: MetroNetwork = 'dmrc',
    shown?: Cached<MapAssetByFormatResponse>,
  ): Promise<Cached<MapAssetByFormatResponse> | MapAssetByFormatResponse> {
    const load = async (): Promise<MapAssetByFormatResponse> => {
      const assets = await fetchAssets();
      return {
        family,
        image: assets.find((asset) => asset.family === family) ?? null,
        pdf: null,
      };
    };
    return catalogCache.map(network, family, load, shown);
  },

  getProxyFileUrl(
    family: MapFamily,
    _format: MapFormat = 'any',
    _network: MetroNetwork = 'dmrc',
  ): string {
    return `${apiClient.baseUrl}${API_V1}/maps/${family}/file`;
  },
};
