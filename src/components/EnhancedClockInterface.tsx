'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Card from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import LocationTrackingPanel from './LocationTrackingPanel';
import { format } from 'date-fns';
import { getCurrentLocation } from '../utils/location';

interface Shift {
  id: string;
  clockInTime: string;
  clockOutTime?: string;
  clockInNote?: string;
  clockOutNote?: string;
  totalHours?: number;
  clockInLat: number;
  clockInLng: number;
  clockOutLat?: number;
  clockOutLng?: number;
}

interface CurrentShift {
  id: string;
  clockInTime: string;
  clockInNote?: string;
}

const EnhancedClockInterface: React.FC = () => {
  const { user, logout } = useAuth();
  const [currentShift, setCurrentShift] = useState<CurrentShift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('clock');
  const [historyFilter, setHistoryFilter] = useState({
    limit: 20,
    offset: 0
  });
  
  const [organizationData] = useState({
    lat: 40.7128, 
    lng: -74.0060,
    perimeterRadius: 100 
  });

  useEffect(() => {
    if (user?.auth0Id) {
      fetchCurrentShift();
      fetchShiftHistory();
    }
    getCurrentLocationData();
  }, [user]);

  const getCurrentLocationData = async () => {
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);
      setLocationError(null);
    } catch (error) {
      setLocationError((error as Error).message);
      setCurrentLocation(null);
    }
  };

  const fetchCurrentShift = async () => {
    if (!user?.auth0Id) return;
    
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query CurrentShiftByAuth0Id($auth0Id: String!) {
              currentShiftByAuth0Id(auth0Id: $auth0Id) {
                id
                clockInTime
                clockInNote
              }
            }
          `,
          variables: { auth0Id: user.auth0Id },
        }),
      });

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      setCurrentShift(result.data.currentShiftByAuth0Id);
    } catch (error) {
      console.error('Error fetching current shift:', error);
    }
  };

  const fetchShiftHistory = async () => {
    if (!user?.auth0Id) return;
    
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query MyShiftsByAuth0Id($auth0Id: String!, $limit: Int, $offset: Int) {
              myShiftsByAuth0Id(auth0Id: $auth0Id, limit: $limit, offset: $offset) {
                id
                clockInTime
                clockOutTime
                clockInNote
                clockOutNote
                totalHours
                clockInLat
                clockInLng
                clockOutLat
                clockOutLng
              }
            }
          `,
          variables: { 
            auth0Id: user.auth0Id,
            ...historyFilter 
          },
        }),
      });

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      setShiftHistory(result.data.myShiftsByAuth0Id || []);
    } catch (error) {
      console.error('Error fetching shift history:', error);
    }
  };

  const handleClockIn = async () => {
    if (!user?.auth0Id) {
      setError('User not authenticated');
      return;
    }

    if (!currentLocation) {
      setError('Location access required for clock-in');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation ClockInByAuth0Id($auth0Id: String!, $input: ClockInInput!) {
              clockInByAuth0Id(auth0Id: $auth0Id, input: $input) {
                id
                clockInTime
                clockInNote
              }
            }
          `,
          variables: {
            auth0Id: user.auth0Id,
            input: {
              lat: currentLocation.lat,
              lng: currentLocation.lng,
              note: note || null,
            },
          },
        }),
      });

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      setCurrentShift(result.data.clockInByAuth0Id);
      setNote('');
      fetchShiftHistory(); // Refresh history
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user?.auth0Id) {
      setError('User not authenticated');
      return;
    }

    if (!currentLocation) {
      setError('Location access required for clock-out');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation ClockOutByAuth0Id($auth0Id: String!, $input: ClockOutInput!) {
              clockOutByAuth0Id(auth0Id: $auth0Id, input: $input) {
                id
                clockOutTime
                totalHours
              }
            }
          `,
          variables: {
            auth0Id: user.auth0Id,
            input: {
              lat: currentLocation.lat,
              lng: currentLocation.lng,
              note: note || null,
            },
          },
        }),
      });

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      setCurrentShift(null);
      setNote('');
      fetchShiftHistory(); // Refresh history
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreHistory = () => {
    setHistoryFilter(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
  };

  const formatTime = (timeString: string) => {
    return format(new Date(timeString), 'h:mm a');
  };

  const formatDateTime = (timeString: string) => {
    return format(new Date(timeString), 'MMM dd, yyyy h:mm a');
  };

  const calculateHoursWorked = (clockInTime: string) => {
    const now = new Date();
    const clockIn = new Date(clockInTime);
    const hours = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    return hours.toFixed(1);
  };

  const getShiftStats = () => {
    const completedShifts = shiftHistory.filter(shift => shift.totalHours);
    const totalHours = completedShifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0);
    const averageHours = completedShifts.length > 0 ? totalHours / completedShifts.length : 0;
    
    // This week's hours
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeekShifts = completedShifts.filter(shift => 
      new Date(shift.clockInTime) >= weekAgo
    );
    const weeklyHours = thisWeekShifts.reduce((sum, shift) => sum + (shift.totalHours || 0), 0);

    return {
      totalShifts: shiftHistory.length,
      totalHours: Math.round(totalHours * 100) / 100,
      averageHours: Math.round(averageHours * 100) / 100,
      weeklyHours: Math.round(weeklyHours * 100) / 100
    };
  };

  const stats = getShiftStats();

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">MediClock</h1>
          <p className="mt-2 text-sm text-gray-600">Welcome, {user?.name}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="mt-2"
          >
            Logout
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex justify-center space-x-8">
              {[
                { id: 'clock', name: 'Clock In/Out' },
                { id: 'location', name: 'Location Tracking' },
                { id: 'history', name: 'My Shift History' },
                { id: 'stats', name: 'My Statistics' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Clock Tab */}
        {activeTab === 'clock' && (
          <div className="max-w-md mx-auto space-y-8">
            <Card>
              <div className="space-y-6">
                {/* Location Status */}
                <div className="text-center">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    currentLocation 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      currentLocation ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    {currentLocation ? 'Location Available' : 'Location Unavailable'}
                  </div>
                  {locationError && (
                    <p className="mt-2 text-sm text-red-600">{locationError}</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={getCurrentLocationData}
                    className="mt-2"
                  >
                    Refresh Location
                  </Button>
                </div>

                {/* Current Shift Status */}
                {currentShift ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-blue-900">Currently Clocked In</h3>
                    <p className="text-blue-700">Since: {formatTime(currentShift.clockInTime)}</p>
                    <p className="text-blue-700">Hours worked: {calculateHoursWorked(currentShift.clockInTime)}h</p>
                    {currentShift.clockInNote && (
                      <p className="text-sm text-blue-600 mt-1">Note: {currentShift.clockInNote}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <p className="text-gray-600">You are currently clocked out</p>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                    {error}
                  </div>
                )}

                {/* Note Input */}
                <Input
                  label="Optional Note"
                  value={note}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
                  placeholder="Add a note about your shift..."
                />

                {/* Clock In/Out Button */}
                <div className="space-y-4">
                  {currentShift ? (
                    <Button
                      variant="danger"
                      size="lg"
                      onClick={handleClockOut}
                      loading={loading}
                      disabled={!currentLocation}
                      className="w-full"
                    >
                      Clock Out
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleClockIn}
                      loading={loading}
                      disabled={!currentLocation}
                      className="w-full"
                    >
                      Clock In
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Location Tracking Tab */}
        {activeTab === 'location' && (
          <div className="max-w-4xl mx-auto">
            <LocationTrackingPanel
              organizationLat={organizationData.lat}
              organizationLng={organizationData.lng}
              perimeterRadius={organizationData.perimeterRadius}
              onLocationUpdate={(location) => {
                setCurrentLocation(location);
                setLocationError(null);
              }}
            />
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <Card>
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">My Shift History</h2>
                
                {shiftHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No shift history available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {shiftHistory.map((shift) => (
                      <div key={shift.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-900">
                              {formatDateTime(shift.clockInTime)}
                              {shift.clockOutTime && (
                                <span className="text-gray-500"> → {formatDateTime(shift.clockOutTime)}</span>
                              )}
                            </div>
                            
                            {shift.totalHours && (
                              <div className="text-sm text-gray-600">
                                Duration: {shift.totalHours}h
                              </div>
                            )}
                            
                            {!shift.clockOutTime && (
                              <div className="text-sm text-blue-600 font-medium">
                                Still clocked in
                              </div>
                            )}
                            
                            {(shift.clockInNote || shift.clockOutNote) && (
                              <div className="text-sm text-gray-600">
                                {shift.clockInNote && (
                                  <div><strong>Clock-in note:</strong> {shift.clockInNote}</div>
                                )}
                                {shift.clockOutNote && (
                                  <div><strong>Clock-out note:</strong> {shift.clockOutNote}</div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="text-right text-xs text-gray-500">
                            <div>In: {shift.clockInLat.toFixed(4)}, {shift.clockInLng.toFixed(4)}</div>
                            {shift.clockOutLat && shift.clockOutLng && (
                              <div>Out: {shift.clockOutLat.toFixed(4)}, {shift.clockOutLng.toFixed(4)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {shiftHistory.length >= historyFilter.limit && (
                      <div className="text-center">
                        <Button variant="outline" onClick={loadMoreHistory}>
                          Load More
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.totalShifts}</p>
                  <p className="text-gray-600">Total Shifts</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.totalHours}h</p>
                  <p className="text-gray-600">Total Hours</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{stats.averageHours}h</p>
                  <p className="text-gray-600">Average Hours/Shift</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{stats.weeklyHours}h</p>
                  <p className="text-gray-600">This Week</p>
                </div>
              </Card>
            </div>

            <Card>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900">This Week</h4>
                    <p className="text-2xl font-bold text-blue-600">{stats.weeklyHours}h</p>
                    <p className="text-sm text-blue-700">
                      {shiftHistory.filter(shift => {
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return new Date(shift.clockInTime) >= weekAgo;
                      }).length} shifts
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-900">Average per Shift</h4>
                    <p className="text-2xl font-bold text-green-600">{stats.averageHours}h</p>
                    <p className="text-sm text-green-700">
                      Based on {shiftHistory.filter(s => s.totalHours).length} completed shifts
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedClockInterface;
