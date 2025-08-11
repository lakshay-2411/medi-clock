/**
 * Calculate the distance between two geographical points using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

/**
 * Check if a location is within the specified perimeter
 * @param userLat User's latitude
 * @param userLng User's longitude
 * @param facilityLat Facility's latitude
 * @param facilityLng Facility's longitude
 * @param perimeterRadius Perimeter radius in meters
 * @returns boolean indicating if user is within perimeter
 */
export function isWithinPerimeter(
  userLat: number,
  userLng: number,
  facilityLat: number,
  facilityLng: number,
  perimeterRadius: number
): boolean {
  const distance = calculateDistance(userLat, userLng, facilityLat, facilityLng);
  return distance <= perimeterRadius;
}

/**
 * Get current location using browser's geolocation API
 * @returns Promise with latitude and longitude
 */
export function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Watch position changes
 * @param callback Function to call when position changes
 * @returns Watch ID to clear the watch
 */
export function watchPosition(
  callback: (position: { lat: number; lng: number }) => void
): number {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by this browser.');
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      callback({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    (error) => {
      console.error('Error watching position:', error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    }
  );
}
