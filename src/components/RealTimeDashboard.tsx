import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocationSubscription } from '../hooks/useLocationTracking';

interface StaffLocationData {
  userId: string;
  userName: string;
  location: {
    lat: number;
    lng: number;
    timestamp: Date;
  };
  isWithinPerimeter: boolean;
  isOnline: boolean;
}

interface RealTimeDashboardProps {
  organizationId: string;
}

export default function RealTimeDashboard({ organizationId }: RealTimeDashboardProps) {
  const { user } = useAuth();
  const [staffLocations, setStaffLocations] = useState<StaffLocationData[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { locationUpdates, geofenceAlerts, isConnected } = useLocationSubscription(organizationId);

  useEffect(() => {
    if (!user?.auth0Id) {
      setLoading(false);
      setError('User not authenticated');
      return;
    }

    if (!autoRefresh) return;

    setLoading(true);
    setError(null);

    const fetchStaffData = async () => {
      try {
        // Fetch current staff status
        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query RealTimeStaffStatus($auth0Id: String!) {
                allStaffByAuth0Id(auth0Id: $auth0Id) {
                  id
                  name
                  email
                  shifts {
                    id
                    clockInTime
                    clockOutTime
                    clockInLat
                    clockInLng
                  }
                }
              }
            `,
            variables: { auth0Id: user.auth0Id }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.errors) {
          throw new Error(result.errors[0]?.message || 'GraphQL error');
        }
        
        if (result.data?.allStaffByAuth0Id) {
          const staff = result.data.allStaffByAuth0Id
            .filter((s: any) => s.shifts.some((shift: any) => !shift.clockOutTime))
            .map((s: any) => {
              const activeShift = s.shifts.find((shift: any) => !shift.clockOutTime);
              return {
                userId: s.id,
                userName: s.name,
                location: {
                  lat: activeShift?.clockInLat || 0,
                  lng: activeShift?.clockInLng || 0,
                  timestamp: new Date(activeShift?.clockInTime || Date.now())
                },
                isWithinPerimeter: true, // This would be calculated based on real-time location
                isOnline: Math.random() > 0.2 // Simulate online status
              };
            });
          
          setStaffLocations(staff);
          setError(null);
        } else {
          setStaffLocations([]);
        }
      } catch (error) {
        console.error('Error fetching real-time staff data:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch staff data');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchStaffData();

    // Set up interval for subsequent fetches
    const interval = setInterval(fetchStaffData, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [user?.auth0Id, autoRefresh]);

  const handleStaffSelect = (userId: string) => {
    setSelectedStaff(selectedStaff === userId ? null : userId);
  };

  const getStatusIcon = (staff: StaffLocationData) => {
    if (!staff.isOnline) return '🔴';
    if (staff.isWithinPerimeter) return '🟢';
    return '🟡';
  };

  const getStatusText = (staff: StaffLocationData) => {
    if (!staff.isOnline) return 'Offline';
    if (staff.isWithinPerimeter) return 'In work area';
    return 'Outside work area';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Real-Time Staff Tracking</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </label>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading staff data...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="text-red-400">⚠️</div>
            <div className="ml-2">
              <h3 className="text-sm font-medium text-red-800">Error loading staff data</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {staffLocations.filter(s => s.isWithinPerimeter && s.isOnline).length}
          </div>
          <div className="text-sm text-green-700">Staff in work area</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">
            {staffLocations.filter(s => !s.isWithinPerimeter && s.isOnline).length}
          </div>
          <div className="text-sm text-yellow-700">Staff outside area</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-600">
            {staffLocations.filter(s => !s.isOnline).length}
          </div>
          <div className="text-sm text-red-700">Staff offline</div>
        </div>
      </div>

      {/* Recent Geofence Alerts */}
      {geofenceAlerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Recent Alerts</h3>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {geofenceAlerts.slice(-5).map((alert, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border-l-4 ${
                  alert.alertType === 'ENTERED'
                    ? 'bg-green-50 border-green-400'
                    : alert.alertType === 'EXITED'
                    ? 'bg-yellow-50 border-yellow-400'
                    : 'bg-red-50 border-red-400'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">
                      {alert.user?.name || `User ${alert.userId}`}
                    </div>
                    <div className="text-xs text-gray-600">
                      {alert.alertType === 'ENTERED' && 'Entered work area'}
                      {alert.alertType === 'EXITED' && 'Left work area'}
                      {alert.alertType === 'AUTO_CLOCK_OUT' && 'Auto clock-out triggered'}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff List */}
      <div>
        <h3 className="text-lg font-medium mb-3">Active Staff ({staffLocations.length})</h3>
        <div className="space-y-3">
          {staffLocations.map((staff) => (
            <div
              key={staff.userId}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedStaff === staff.userId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleStaffSelect(staff.userId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{getStatusIcon(staff)}</span>
                  <div>
                    <div className="font-medium">{staff.userName}</div>
                    <div className="text-sm text-gray-600">{getStatusText(staff)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">
                    Last seen: {staff.location.timestamp.toLocaleTimeString()}
                  </div>
                  {staff.isOnline && (
                    <div className="text-xs text-gray-400">
                      {staff.location.lat.toFixed(4)}, {staff.location.lng.toFixed(4)}
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {selectedStaff === staff.userId && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Status:</span>
                      <div className={
                        staff.isWithinPerimeter ? 'text-green-600' : 
                        staff.isOnline ? 'text-yellow-600' : 'text-red-600'
                      }>
                        {getStatusText(staff)}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Last Location Update:</span>
                      <div>{staff.location.timestamp.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="font-medium">Coordinates:</span>
                      <div className="font-mono">
                        {staff.location.lat.toFixed(6)}, {staff.location.lng.toFixed(6)}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Connection:</span>
                      <div className={staff.isOnline ? 'text-green-600' : 'text-red-600'}>
                        {staff.isOnline ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {staffLocations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-lg mb-2">No staff currently active</div>
            <div className="text-sm">Staff members will appear here when they clock in</div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
