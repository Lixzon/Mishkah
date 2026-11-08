const KAABA_LATITUDE = 21.4225;
const KAABA_LONGITUDE = 39.8262;

export function getQiblaBearing(latitude: number, longitude: number): number {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new RangeError('A valid latitude and longitude are required to calculate Qibla.');
  }

  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const toDegrees = (radians: number) => radians * 180 / Math.PI;
  const lat = toRadians(latitude);
  const kaabaLat = toRadians(KAABA_LATITUDE);
  const longitudeDelta = toRadians(KAABA_LONGITUDE - longitude);
  const y = Math.sin(longitudeDelta);
  const x = Math.cos(lat) * Math.tan(kaabaLat) - Math.sin(lat) * Math.cos(longitudeDelta);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function normalizeHeading(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new RangeError('A finite compass heading is required.');
  }
  return ((degrees % 360) + 360) % 360;
}

export function relativeQiblaHeading(qiblaBearing: number, deviceHeading: number): number {
  return normalizeHeading(qiblaBearing - deviceHeading);
}
