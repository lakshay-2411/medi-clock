import { useEffect, useRef, useState } from 'react';
import { LocationTracker, LocationData, GeofenceAlert, NotificationManager } from '../utils/locationTracking';
import { useAuth } from '../context/AuthContext';

export interface UseLocationTrackingOptions {
  organizationLat: number;
  organizationLng: number;
  perimeterRadius: number;
  enableBackgroundTracking?: boolean;
  enableNotifications?: boolean;
}

export interface LocationStatus {
  isTracking: boolean;
  lastKnownLocation: LocationData | null;
  isInsidePerimeter: boolean;
  cachedLocationsCount: number;
  unsyncedLocationsCount: number;
  hasLocationPermission: boolean;
  hasNotificationPermission: boolean;
}

export function useLocationTracking(options: UseLocationTrackingOptions) {
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({
    isTracking: false,
    lastKnownLocation: null,
    isInsidePerimeter: false,
    cachedLocationsCount: 0,
    unsyncedLocationsCount: 0,
    hasLocationPermission: false,
    hasNotificationPermission: false
  });
  const [error, setError] = useState<string | null>(null);
  const [geofenceAlerts, setGeofenceAlerts] = useState<GeofenceAlert[]>([]);

  const trackerRef = useRef<LocationTracker | null>(null);

  // Initialize tracker
  useEffect(() => {
    if (!user?.auth0Id) return;

    try {
      trackerRef.current = new LocationTracker(
        options.organizationLat,
        options.organizationLng,
        options.perimeterRadius,
        user.auth0Id as string
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize location tracker');
    }

    return () => {
      if (trackerRef.current) {
        trackerRef.current.stopTracking();
      }
    };
  }, [user?.auth0Id, options.organizationLat, options.organizationLng, options.perimeterRadius]);

  // Check permissions
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        // Check geolocation permission
        const geoPermission = await navigator.permissions.query({ name: 'geolocation' });
        const hasGeoPermission = geoPermission.state === 'granted';

        // Check notification permission
        const hasNotificationPermission = options.enableNotifications 
          ? await NotificationManager.requestPermission()
          : false;

        setLocationStatus(prev => ({
          ...prev,
          hasLocationPermission: hasGeoPermission,
          hasNotificationPermission
        }));
      } catch (err) {
        console.error('Error checking permissions:', err);
      }
    };

    checkPermissions();
  }, [options.enableNotifications]);

  // Start tracking function
  const startTracking = async () => {
    if (!trackerRef.current) {
      setError('Location tracker not initialized');
      return;
    }

    try {
      setError(null);
      
      trackerRef.current.startTracking({
        onLocationUpdate: (location: LocationData) => {
          const status = trackerRef.current!.getStatus();
          setLocationStatus(prev => ({
            ...prev,
            lastKnownLocation: location,
            isTracking: status.isTracking,
            isInsidePerimeter: status.isInsidePerimeter,
            cachedLocationsCount: status.cachedLocationsCount,
            unsyncedLocationsCount: status.unsyncedLocationsCount
          }));
        },
        onGeofenceAlert: (alert: GeofenceAlert) => {
          setGeofenceAlerts(prev => [...prev, alert]);
          
          // Show notification if enabled
          if (options.enableNotifications) {
            NotificationManager.showGeofenceNotification(
              alert.alertType === 'ENTERED' ? 'entered' :
              alert.alertType === 'EXITED' ? 'exited' : 'auto-clockout'
            );
          }
        },
        onPerimeterEnter: () => {
          console.log('Entered work perimeter');
        },
        onPerimeterExit: () => {
          console.log('Exited work perimeter');
        }
      });

      setIsTracking(true);
      const status = trackerRef.current.getStatus();
      setLocationStatus(prev => ({
        ...prev,
        isTracking: true,
        isInsidePerimeter: status.isInsidePerimeter,
        cachedLocationsCount: status.cachedLocationsCount,
        unsyncedLocationsCount: status.unsyncedLocationsCount
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tracking');
    }
  };

  // Stop tracking function
  const stopTracking = () => {
    if (trackerRef.current) {
      trackerRef.current.stopTracking();
      setIsTracking(false);
      setLocationStatus(prev => ({
        ...prev,
        isTracking: false
      }));
    }
  };

  // Get current location function
  const getCurrentLocation = async (): Promise<LocationData | null> => {
    if (!trackerRef.current) {
      setError('Location tracker not initialized');
      return null;
    }

    try {
      const location = await trackerRef.current.getCurrentLocation();
      return location;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get current location');
      return null;
    }
  };

  // Update status periodically
  useEffect(() => {
    if (!isTracking || !trackerRef.current) return;

    const interval = setInterval(() => {
      setLocationStatus(prev => ({
        ...prev,
        ...trackerRef.current!.getStatus()
      }));
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isTracking]);

  // Clear alerts function
  const clearGeofenceAlerts = () => {
    setGeofenceAlerts([]);
  };

  return {
    isTracking,
    locationStatus,
    error,
    geofenceAlerts,
    startTracking,
    stopTracking,
    getCurrentLocation,
    clearGeofenceAlerts
  };
}

// Hook for real-time subscription to location updates (for managers)
export function useLocationSubscription(organizationId?: string) {
  const [locationUpdates, setLocationUpdates] = useState<any[]>([]);
  const [geofenceAlerts, setGeofenceAlerts] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!organizationId) return;

    // In a real implementation, you would set up WebSocket or GraphQL subscription here
    // For now, we'll simulate with a placeholder
    setIsConnected(true);

    // Cleanup function
    return () => {
      setIsConnected(false);
    };
  }, [organizationId]);

  return {
    locationUpdates,
    geofenceAlerts,
    isConnected
  };
}
