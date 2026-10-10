/**
 * Real truck photo used by <TruckFill>. Put a side-view photo of a tractor + container in
 * apps/web/public/images/ and describe where the container body sits in it (percent of the
 * image width/height). Set to null to use the vector drawing.
 *
 * `fillFrom` is the side the cargo starts from: the front wall of the container is next to the cab.
 */
export interface TruckPhoto {
  src: string;
  width: number;
  height: number;
  /** container body inside the photo, in % of the image */
  box: { left: number; top: number; width: number; height: number };
  fillFrom: 'left' | 'right';
  credit: string;
}

export const TRUCK_PHOTO: TruckPhoto | null = null;
