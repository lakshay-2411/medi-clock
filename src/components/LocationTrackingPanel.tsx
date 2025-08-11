import React, { useState, useEffect } from 'react';
import { useLocationTracking, LocationStatus } from '../hooks/useLocationTracking';
import { useAuth } from '../context/AuthContext';

interface LocationTrackingPanelProps {
  organizationLat: number;
  organizationLng: number;
  perimeterRadius: number;
  onLocationUpdate?: (location: any) => void;
}

export default function LocationTrackingPanel({
  organizationLat,
  organizationLng,
  perimeterRadius,
  onLocationUpdate
}: LocationTrackingPanelProps) {
  const { user } = useAuth();
  const [showDetails, setShowDetails] = useState(false);

  const {
    isTracking,
    locationStatus,
    error,
    geofenceAlerts,
    startTracking,
    stopTracking,
    getCurrentLocation,
    clearGeofenceAlerts
  } = useLocationTracking({
    organizationLat,
    organizationLng,
    perimeterRadius,
    enableBackgroundTracking: true,
    enableNotifications: true
  });

  // Auto-start tracking for care workers
  useEffect(() => {
    if (user && !isTracking) {
      startTracking();
    }
  }, [user, isTracking]);

  // Handle location updates
  useEffect(() => {
    if (locationStatus.lastKnownLocation && onLocationUpdate) {
      onLocationUpdate(locationStatus.lastKnownLocation);
    }
  }, [locationStatus.lastKnownLocation, onLocationUpdate]);

  const handleToggleTracking = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  const handleGetCurrentLocation = async () => {
    const location = await getCurrentLocation();
    if (location) {
      console.log('Current location:', location);
    }
  };

  const getStatusColor = () => {
    if (!isTracking) return 'text-gray-500';
    if (!locationStatus.hasLocationPermission) return 'text-red-500';
    if (locationStatus.isInsidePerimeter) return 'text-green-500';
    return 'text-yellow-500';
  };

  const getStatusText = () => {
    if (!isTracking) return 'Location tracking disabled';
    if (!locationStatus.hasLocationPermission) return 'Location permission denied';
    if (error) return `Error: ${error}`;
    if (locationStatus.isInsidePerimeter) return 'Inside work area';
    return 'Outside work area';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Location Tracking</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Status Display */}
      <div className="flex items-center space-x-3 mb-4">
        <div className={`w-3 h-3 rounded-full ${
          isTracking ? 
            (locationStatus.isInsidePerimeter ? 'bg-green-400' : 'bg-yellow-400') : 
            'bg-gray-400'
        }`}></div>
        <span className={`font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-sm text-gray-600">Status:</span>
          <div className={`font-medium ${getStatusColor()}`}>
            {isTracking ? 'Active' : 'Inactive'}
          </div>
        </div>
        <div>
          <span className="text-sm text-gray-600">Position:</span>
          <div className="font-medium">
            {locationStatus.isInsidePerimeter ? 'In Area' : 'Out of Area'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={handleToggleTracking}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            isTracking
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isTracking ? 'Stop Tracking' : 'Start Tracking'}
        </button>
        <button
          onClick={handleGetCurrentLocation}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Get Location
        </button>
      </div>

      {/* Geofence Alerts */}
      {geofenceAlerts.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">
              Recent Alerts ({geofenceAlerts.length})
            </h4>
            <button
              onClick={clearGeofenceAlerts}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Clear
            </button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {geofenceAlerts.slice(-3).map((alert, index) => (
              <div
                key={index}
                className={`p-2 rounded text-xs ${
                  alert.alertType === 'ENTERED'
                    ? 'bg-green-100 text-green-800'
                    : alert.alertType === 'EXITED'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <div className="font-medium">
                  {alert.alertType === 'ENTERED' && '✅ Entered work area'}
                  {alert.alertType === 'EXITED' && '⚠️ Left work area'}
                  {alert.alertType === 'AUTO_CLOCK_OUT' && '🔔 Auto clock-out reminder'}
                </div>
                <div className="text-xs opacity-75">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Information */}
      {showDetails && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Detailed Status</h4>
          
          <div className="grid grid-cols-1 gap-3 text-sm">
            {/* Permissions */}
            <div className="flex justify-between">
              <span className="text-gray-600">Location Permission:</span>
              <span className={locationStatus.hasLocationPermission ? 'text-green-600' : 'text-red-600'}>
                {locationStatus.hasLocationPermission ? '✅ Granted' : '❌ Denied'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Notification Permission:</span>
              <span className={locationStatus.hasNotificationPermission ? 'text-green-600' : 'text-yellow-600'}>
                {locationStatus.hasNotificationPermission ? '✅ Granted' : '⚠️ Not granted'}
              </span>
            </div>

            {/* Location Info */}
            {locationStatus.lastKnownLocation && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Update:</span>
                  <span className="font-mono text-xs">
                    {new Date(locationStatus.lastKnownLocation.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Coordinates:</span>
                  <span className="font-mono text-xs">
                    {locationStatus.lastKnownLocation.lat.toFixed(6)}, {locationStatus.lastKnownLocation.lng.toFixed(6)}
                  </span>
                </div>

                {locationStatus.lastKnownLocation.accuracy && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Accuracy:</span>
                    <span className="text-xs">
                      ±{Math.round(locationStatus.lastKnownLocation.accuracy)}m
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Cache Info */}
            <div className="flex justify-between">
              <span className="text-gray-600">Cached Locations:</span>
              <span className="text-xs">
                {locationStatus.cachedLocationsCount} 
                {locationStatus.unsyncedLocationsCount > 0 && (
                  <span className="text-yellow-600 ml-1">
                    ({locationStatus.unsyncedLocationsCount} unsynced)
                  </span>
                )}
              </span>
            </div>

            {/* Network Status */}
            <div className="flex justify-between">
              <span className="text-gray-600">Network:</span>
              <span className={navigator.onLine ? 'text-green-600' : 'text-red-600'}>
                {navigator.onLine ? '🌐 Online' : '📴 Offline'}
              </span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded text-red-700 text-xs">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
