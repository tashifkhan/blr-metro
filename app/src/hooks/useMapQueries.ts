import { hashKey, useQuery, useQueryClient, type QueryFunctionContext } from '@tanstack/react-query';
import { useEffect } from 'react';

import { mapService } from '../services/mapService';
import type { Cached } from '../storage/catalogCache';
import type { MapAssetByFormatResponse, MapFamily, MapFormat } from '../types';
import { queryKeys } from './queryKeys';
import { useMetroNetwork } from '../network';

function isCachedMap(
  value: Cached<MapAssetByFormatResponse> | MapAssetByFormatResponse | undefined,
): value is Cached<MapAssetByFormatResponse> {
  return value !== undefined && 'fromCache' in value;
}

export function useAllMapAssetsQuery() {
  const { network } = useMetroNetwork();
  return useQuery({
    queryKey: queryKeys.mapAssets(network),
    queryFn: () => mapService.getAllAssets(network),
  });
}

export function useMapFamilyAssetsQuery(family: MapFamily, format: MapFormat = 'any') {
  const { network } = useMetroNetwork();
  return useQuery({
    queryKey: queryKeys.mapFamilyAssets(network, family, format),
    queryFn: () => mapService.getFamilyAssets(family, format, network),
  });
}

export function useMapFamilyPrimaryQuery(family: MapFamily) {
  const { network } = useMetroNetwork();
  const client = useQueryClient();
  const queryKey = queryKeys.mapFamilyPrimary(network, family);
  const key = hashKey(queryKey);

  useEffect(() => {
    let cancelled = false;
    void mapService.getCachedFamilyPrimaryMaps(family, network).then((stored) => {
      if (cancelled || !stored) return;
      if (client.getQueryData(queryKey) !== undefined) return;
      client.setQueryData(queryKey, stored, { updatedAt: stored.savedAt });
    });
    return () => {
      cancelled = true;
    };
    // The key already covers family and network.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key]);

  const query = useQuery<Cached<MapAssetByFormatResponse> | MapAssetByFormatResponse>({
    queryKey,
    queryFn: (context: QueryFunctionContext) =>
      mapService.getFamilyPrimaryMaps(
        family,
        network,
        context.client.getQueryData<Cached<MapAssetByFormatResponse>>(context.queryKey),
      ),
    // A cached copy keeps painting while the metadata call runs; a live one
    // stays fresh for five minutes.
    staleTime: (current: {
      state: { data?: Cached<MapAssetByFormatResponse> | MapAssetByFormatResponse };
    }) =>
      isCachedMap(current.state.data) && current.state.data.fromCache
        ? 0
        : 5 * 60_000,
  });

  const envelope = query.data;
  const cached = isCachedMap(envelope);

  return {
    ...query,
    data: cached ? envelope.data : envelope,
    isOfflineCopy: cached && envelope.fromCache,
  };
}


