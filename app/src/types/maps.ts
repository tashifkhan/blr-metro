/** The two images BMRCL publishes for passengers. */
export type MapFamily = 'schematic' | 'phase';
export type MapFormat = 'image' | 'any';

export interface MapAsset {
  family: MapFamily;
  title: string;
  content_type: string;
  source_url: string;
  /** The app's own proxy, so the image loads without hitting BMRCL directly. */
  url: string;
}

export interface MapAssetListResponse {
  assets: MapAsset[];
}

export interface MapAssetByFormatResponse {
  family: MapFamily;
  image: MapAsset | null;
  pdf: null;
}
