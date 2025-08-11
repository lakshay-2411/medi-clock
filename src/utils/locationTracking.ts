import { isWithinPerimeter } from './location';

// Location tracking interfaces
export interface LocationData {
  lat: number;
  lng: number;
  timestamp: Date;
  accuracy?: number;
}

export interface GeofenceAlert {
  userId: string;
  alertType: 'ENTERED' | 'EXITED' | 'AUTO_CLOCK_OUT';
  location: LocationData;
  timestamp: Date;
}

export interface CachedLocation extends LocationData {
  synced: boolean;
  id: string;
}

// Enhanced Location Tracking Class
export class LocationTracker {
  private watchId: number | null = null;
  private lastKnownLocation: LocationData | null = null;
  private isInsidePerimeter: boolean = false;
  private backgroundInterval: NodeJS.Timeout | null = null;
  private locationCache: CachedLocation[] = [];
  private maxCacheSize = 100;
  private syncInterval: NodeJS.Timeout | null = null;

  // Callbacks
  private onLocationUpdate?: (location: LocationData) => void;
  private onGeofenceAlert?: (alert: GeofenceAlert) => void;
  private onPerimeterExit?: () => void;
  private onPerimeterEnter?: () => void;

  constructor(
    private organizationLat: number,
    private organizationLng: number,
    private perimeterRadius: number,
    private userId: string
  ) {
    this.initializeLocationTracking();
    this.startOfflineSync();
  }

  // Initialize location tracking with enhanced options
  private initializeLocationTracking() {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    // Request permission for background location
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
          console.warn('Geolocation permission denied');
        }
      });
    }
  }

  // Start real-time location tracking
  public startTracking(options?: {
    onLocationUpdate?: (location: LocationData) => void;
    onGeofenceAlert?: (alert: GeofenceAlert) => void;
    onPerimeterExit?: () => void;
    onPerimeterEnter?: () => void;
  }) {
    this.onLocationUpdate = options?.onLocationUpdate;
    this.onGeofenceAlert = options?.onGeofenceAlert;
    this.onPerimeterExit = options?.onPerimeterExit;
    this.onPerimeterEnter = options?.onPerimeterEnter;

    const trackingOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000 // 30 seconds
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handleLocationUpdate(position),
      (error) => this.handleLocationError(error),
      trackingOptions
    );

    // Start background tracking for when app is in background
    this.startBackgroundTracking();
  }

  // Handle location updates
  private handleLocationUpdate(position: GeolocationPosition) {
    const location: LocationData = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: new Date(),
      accuracy: position.coords.accuracy
    };

    // Check geofencing
    this.checkGeofence(location);

    // Cache location for offline support
    this.cacheLocation(location);

    // Update last known location
    this.lastKnownLocation = location;

    // Trigger callback
    if (this.onLocationUpdate) {
      this.onLocationUpdate(location);
    }

    // Publish to GraphQL subscription
    this.publishLocationUpdate(location);
  }

  // Check geofencing status
  private checkGeofence(location: LocationData) {
    const wasInsidePerimeter = this.isInsidePerimeter;
    const isNowInsidePerimeter = isWithinPerimeter(
      location.lat,
      location.lng,
      this.organizationLat,
      this.organizationLng,
      this.perimeterRadius
    );

    this.isInsidePerimeter = isNowInsidePerimeter;

    // Geofence entry
    if (!wasInsidePerimeter && isNowInsidePerimeter) {
      const alert: GeofenceAlert = {
        userId: this.userId,
        alertType: 'ENTERED',
        location,
        timestamp: new Date()
      };
      
      if (this.onPerimeterEnter) this.onPerimeterEnter();
      if (this.onGeofenceAlert) this.onGeofenceAlert(alert);
      this.publishGeofenceAlert(alert);
    }

    // Geofence exit
    if (wasInsidePerimeter && !isNowInsidePerimeter) {
      const alert: GeofenceAlert = {
        userId: this.userId,
        alertType: 'EXITED',
        location,
        timestamp: new Date()
      };

      if (this.onPerimeterExit) this.onPerimeterExit();
      if (this.onGeofenceAlert) this.onGeofenceAlert(alert);
      this.publishGeofenceAlert(alert);

      // Check for auto clock-out
      this.checkAutoClockOut(location);
    }
  }

  // Auto clock-out when leaving perimeter
  private async checkAutoClockOut(location: LocationData) {
    try {
      // Check if user has active shift
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query CheckActiveShift($userId: String!) {
              currentShiftByAuth0Id(auth0Id: $userId) {
                id
                clockInTime
              }
            }
          `,
          variables: { userId: this.userId }
        })
      });

      const result = await response.json();
      
      if (result.data?.currentShiftByAuth0Id) {
        // Show notification for auto clock-out
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Auto Clock-Out', {
            body: 'You left the work area. Would you like to clock out?',
            icon: '/favicon.ico'
          });
        }

        // Emit auto clock-out alert
        const alert: GeofenceAlert = {
          userId: this.userId,
          alertType: 'AUTO_CLOCK_OUT',
          location,
          timestamp: new Date()
        };

        if (this.onGeofenceAlert) this.onGeofenceAlert(alert);
        this.publishGeofenceAlert(alert);
      }
    } catch (error) {
      console.error('Error checking active shift:', error);
    }
  }

  // Background location tracking
  private startBackgroundTracking() {
    // Track location every 30 seconds in background
    this.backgroundInterval = setInterval(() => {
      if (document.hidden || document.visibilityState === 'hidden') {
        navigator.geolocation.getCurrentPosition(
          (position) => this.handleLocationUpdate(position),
          (error) => this.handleLocationError(error),
          { enableHighAccuracy: false, timeout: 15000 }
        );
      }
    }, 30000);
  }

  // Cache location for offline support
  private cacheLocation(location: LocationData) {
    const cachedLocation: CachedLocation = {
      ...location,
      synced: navigator.onLine,
      id: `${Date.now()}_${Math.random()}`
    };

    this.locationCache.push(cachedLocation);

    // Maintain cache size
    if (this.locationCache.length > this.maxCacheSize) {
      this.locationCache = this.locationCache.slice(-this.maxCacheSize);
    }

    // Store in localStorage for persistence
    this.saveLocationCache();
  }

  // Save location cache to localStorage
  private saveLocationCache() {
    try {
      localStorage.setItem('locationCache', JSON.stringify(this.locationCache));
    } catch (error) {
      console.error('Error saving location cache:', error);
    }
  }

  // Load location cache from localStorage
  private loadLocationCache() {
    try {
      const cached = localStorage.getItem('locationCache');
      if (cached) {
        this.locationCache = JSON.parse(cached);
      }
    } catch (error) {
      console.error('Error loading location cache:', error);
      this.locationCache = [];
    }
  }

  // Start offline sync process
  private startOfflineSync() {
    this.loadLocationCache();

    // Sync every 60 seconds
    this.syncInterval = setInterval(() => {
      this.syncCachedLocations();
    }, 60000);

    // Sync when coming back online
    window.addEventListener('online', () => {
      this.syncCachedLocations();
    });
  }

  // Sync cached locations to server
  private async syncCachedLocations() {
    if (!navigator.onLine) return;

    const unsyncedLocations = this.locationCache.filter(loc => !loc.synced);
    
    for (const location of unsyncedLocations) {
      try {
        await this.uploadLocation(location);
        location.synced = true;
      } catch (error) {
        console.error('Error syncing location:', error);
        break; // Stop syncing if there's an error
      }
    }

    // Update cache
    this.saveLocationCache();
  }

  // Upload location to server
  private async uploadLocation(location: CachedLocation) {
    const response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation LogLocation($input: LocationInput!) {
            logLocation(input: $input) {
              success
            }
          }
        `,
        variables: {
          input: {
            userId: this.userId,
            lat: location.lat,
            lng: location.lng,
            timestamp: location.timestamp,
            accuracy: location.accuracy
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to upload location');
    }
  }

  // Publish location update to GraphQL subscription
  private publishLocationUpdate(location: LocationData) {
    // This would typically be done server-side, but for demo purposes
    // we can simulate it by posting to an endpoint
    fetch('/api/location-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: this.userId,
        location,
        isWithinPerimeter: this.isInsidePerimeter
      })
    }).catch(error => console.error('Error publishing location update:', error));
  }

  // Publish geofence alert
  private publishGeofenceAlert(alert: GeofenceAlert) {
    fetch('/api/geofence-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert)
    }).catch(error => console.error('Error publishing geofence alert:', error));
  }

  // Handle location errors
  private handleLocationError(error: GeolocationPositionError) {
    console.error('Location error:', error);
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        console.error('Location access denied by user');
        break;
      case error.POSITION_UNAVAILABLE:
        console.error('Location information unavailable');
        break;
      case error.TIMEOUT:
        console.error('Location request timed out');
        break;
    }
  }

  // Get current location
  public getCurrentLocation(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date(),
            accuracy: position.coords.accuracy
          };
          resolve(location);
        },
        reject,
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // Stop tracking
  public stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Get status
  public getStatus() {
    return {
      isTracking: this.watchId !== null,
      lastKnownLocation: this.lastKnownLocation,
      isInsidePerimeter: this.isInsidePerimeter,
      cachedLocationsCount: this.locationCache.length,
      unsyncedLocationsCount: this.locationCache.filter(loc => !loc.synced).length
    };
  }
}

// Utility functions for notifications
export class NotificationManager {
  public static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  public static showNotification(title: string, options?: NotificationOptions) {
    if (Notification.permission === 'granted') {
      return new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
  }

  public static showGeofenceNotification(type: 'entered' | 'exited' | 'auto-clockout') {
    const messages = {
      entered: 'You have entered the work area',
      exited: 'You have left the work area',
      'auto-clockout': 'You left the work area. Consider clocking out.'
    };

    this.showNotification('Location Alert', {
      body: messages[type],
      tag: 'geofence',
      requireInteraction: type === 'auto-clockout'
    });
  }
}
