/**
 * Background relief for the network map: real contours, lakes and rivers.
 *
 * `api/scripts/build_terrain.py` builds both files from free tile services
 * (AWS Terrain Tiles for height, OpenFreeMap's OpenStreetMap tiles for
 * water) and writes them in map space, so nothing is projected here.
 *
 * - `terrain.json` is bundled and drawn when the city is in view: 10 m
 *   contours, the larger lakes, rivers and canals, and two shaded bands for
 *   the highest ground.
 * - `terrainDetail.json` holds 5 m contours and every lake, pond and stream,
 *   cut into square chunks. It is loaded the first time the map zooms in,
 *   so the app doesn't parse it until it is needed, and the canvas draws only
 *   the chunks on screen.
 *
 * Kept free of React so it can be tested on its own.
 */

import overview from '../../data/terrain.json';
import type { Box } from './labels';

export interface TerrainOverview {
  /** Contour interval, metres. */
  interval: number;
  minor: string;
  /** Index contours, every fifth. */
  major: string;
  water: string;
  rivers: string;
  /** Filled bands for the highest ground, lower band first. */
  high: string[];
}

export interface TerrainChunk {
  /** Top-left corner in map metres; each chunk is `chunkSize` square. */
  x: number;
  y: number;
  minor: string;
  major: string;
  water: string;
  rivers: string;
  streams: string;
}

export interface TerrainDetail {
  interval: number;
  chunkSize: number;
  chunks: TerrainChunk[];
}

export const TERRAIN_OVERVIEW = overview as TerrainOverview;

type TerrainPaths = Pick<TerrainOverview, 'minor' | 'major' | 'water' | 'rivers' | 'high'>;
type TerrainPart = Box & { path: string };

// The generator writes absolute M commands followed by relative l steps.
// Keep each whole ring so SVG fill rules still apply to lakes and their holes.
function indexPath(path: string): TerrainPart[] {
  const parts: TerrainPart[] = [];
  for (const ring of path.matchAll(/M[^M]+/g)) {
    const [firstX, firstY, ...steps] = ring[0].match(/-?\d+/g)!.map(Number);
    let x = firstX;
    let y = firstY;
    let x0 = x;
    let y0 = y;
    let x1 = x;
    let y1 = y;
    for (let i = 0; i < steps.length; i += 2) {
      x += steps[i];
      y += steps[i + 1];
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    parts.push({ path: ring[0], x0, y0, x1, y1 });
  }
  return parts;
}

const makeOverviewIndex = () => ({
  minor: indexPath(TERRAIN_OVERVIEW.minor),
  major: indexPath(TERRAIN_OVERVIEW.major),
  water: indexPath(TERRAIN_OVERVIEW.water),
  rivers: indexPath(TERRAIN_OVERVIEW.rivers),
  high: TERRAIN_OVERVIEW.high.map(indexPath),
});
let overviewIndex: ReturnType<typeof makeOverviewIndex> | undefined;

export function overviewForView(bounds: Box, padding: number, highOnly = false): TerrainPaths {
  const index = overviewIndex ??= makeOverviewIndex();
  const { x0, y0, x1, y1 } = bounds;
  const visible = (parts: TerrainPart[]) => parts
    .filter((part) =>
      part.x0 <= x1 + padding && part.x1 >= x0 - padding &&
      part.y0 <= y1 + padding && part.y1 >= y0 - padding,
    )
    .map((part) => part.path)
    .join('');
  return {
    minor: highOnly ? '' : visible(index.minor),
    major: highOnly ? '' : visible(index.major),
    water: highOnly ? '' : visible(index.water),
    rivers: highOnly ? '' : visible(index.rivers),
    high: index.high.map(visible),
  };
}

/**
 * Below this span (metres across the screen) the map switches to the
 * detailed layer, about where single lakes become wider than a fingertip.
 */
export const DETAIL_SPAN = 11_000;

let detail: Promise<TerrainDetail> | null = null;

/** The detailed layer, loaded once and shared. */
export function loadTerrainDetail(): Promise<TerrainDetail> {
  if (!detail) {
    const loading = import('../../data/terrainDetail.json').then(
      (module) => ((module as { default?: unknown }).default ?? module) as TerrainDetail,
    );
    // A failed load can be tried again on the next zoom.
    loading.catch(() => {
      if (detail === loading) detail = null;
    });
    detail = loading;
  }
  return detail;
}

/** Chunks overlapping a map-space rectangle. */
export function chunksIn(
  data: TerrainDetail,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): TerrainChunk[] {
  const size = data.chunkSize;
  return data.chunks.filter((c) => c.x + size >= minX && c.x <= maxX && c.y + size >= minY && c.y <= maxY);
}
