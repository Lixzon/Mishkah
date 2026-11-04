export type City = {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timeZone: string;
};

type CityRow = readonly [string, string, string, number, number, string];

const CITY_INDEX: readonly CityRow[] = [
  ['makkah', 'Makkah', 'Saudi Arabia', 21.3891, 39.8579, 'Asia/Riyadh'],
  ['medina', 'Madinah', 'Saudi Arabia', 24.4672, 39.6111, 'Asia/Riyadh'],
  ['riyadh', 'Riyadh', 'Saudi Arabia', 24.7136, 46.6753, 'Asia/Riyadh'],
  ['cairo', 'Cairo', 'Egypt', 30.0444, 31.2357, 'Africa/Cairo'],
  ['casablanca', 'Casablanca', 'Morocco', 33.5731, -7.5898, 'Africa/Casablanca'],
  ['lagos', 'Lagos', 'Nigeria', 6.5244, 3.3792, 'Africa/Lagos'],
  ['accra', 'Accra', 'Ghana', 5.6037, -0.187, 'Africa/Accra'],
  ['dakar', 'Dakar', 'Senegal', 14.7167, -17.4677, 'Africa/Dakar'],
  ['istanbul', 'Istanbul', 'Türkiye', 41.0082, 28.9784, 'Europe/Istanbul'],
  ['ankara', 'Ankara', 'Türkiye', 39.9334, 32.8597, 'Europe/Istanbul'],
  ['london', 'London', 'United Kingdom', 51.5072, -0.1276, 'Europe/London'],
  ['paris', 'Paris', 'France', 48.8566, 2.3522, 'Europe/Paris'],
  ['rome', 'Rome', 'Italy', 41.9028, 12.4964, 'Europe/Rome'],
  ['berlin', 'Berlin', 'Germany', 52.52, 13.405, 'Europe/Berlin'],
  ['new-york', 'New York', 'United States', 40.7128, -74.006, 'America/New_York'],
  ['toronto', 'Toronto', 'Canada', 43.6532, -79.3832, 'America/Toronto'],
  ['chicago', 'Chicago', 'United States', 41.8781, -87.6298, 'America/Chicago'],
  ['los-angeles', 'Los Angeles', 'United States', 34.0522, -118.2437, 'America/Los_Angeles'],
  ['mexico-city', 'Mexico City', 'Mexico', 19.4326, -99.1332, 'America/Mexico_City'],
  ['jakarta', 'Jakarta', 'Indonesia', -6.2088, 106.8456, 'Asia/Jakarta'],
  ['kuala-lumpur', 'Kuala Lumpur', 'Malaysia', 3.139, 101.6869, 'Asia/Kuala_Lumpur'],
  ['singapore', 'Singapore', 'Singapore', 1.3521, 103.8198, 'Asia/Singapore'],
  ['karachi', 'Karachi', 'Pakistan', 24.8607, 67.0011, 'Asia/Karachi'],
  ['delhi', 'Delhi', 'India', 28.6139, 77.209, 'Asia/Kolkata'],
  ['dhaka', 'Dhaka', 'Bangladesh', 23.8103, 90.4125, 'Asia/Dhaka'],
  ['tokyo', 'Tokyo', 'Japan', 35.6762, 139.6503, 'Asia/Tokyo'],
  ['sydney', 'Sydney', 'Australia', -33.8688, 151.2093, 'Australia/Sydney'],
  ['reykjavik', 'Reykjavík', 'Iceland', 64.1466, -21.9426, 'Atlantic/Reykjavik'],
  ['cape-town', 'Cape Town', 'South Africa', -33.9249, 18.4241, 'Africa/Johannesburg'],
];

export const DEFAULT_CITY_IDS = ['makkah', 'london', 'jakarta'] as const;
export const MAX_PINNED_CITIES = 5;

export function getCity(id: string): City | undefined {
  const row = CITY_INDEX.find(([cityId]) => cityId === id);
  return row
    ? {
        id: row[0],
        name: row[1],
        country: row[2],
        latitude: row[3],
        longitude: row[4],
        timeZone: row[5],
      }
    : undefined;
}

export function searchCities(query: string, limit = 12): City[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return CITY_INDEX.filter((row) =>
    `${row[1]} ${row[2]}`.toLocaleLowerCase().includes(normalizedQuery),
  )
    .slice(0, limit)
    .map(([id]) => getCity(id))
    .filter((city): city is City => city !== undefined);
}

export type PinResult =
  | { status: 'added'; cityIds: string[] }
  | { status: 'already-pinned'; cityIds: string[] }
  | { status: 'capacity-reached'; cityIds: string[] };

export function pinCity(cityIds: readonly string[], cityId: string): PinResult {
  if (cityIds.includes(cityId)) {
    return { status: 'already-pinned', cityIds: [...cityIds] };
  }
  if (cityIds.length >= MAX_PINNED_CITIES) {
    return { status: 'capacity-reached', cityIds: [...cityIds] };
  }
  return { status: 'added', cityIds: [...cityIds, cityId] };
}

export function unpinCity(cityIds: readonly string[], cityId: string): string[] {
  return cityIds.filter((id) => id !== cityId);
}
