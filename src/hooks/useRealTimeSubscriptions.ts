'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

interface SubscriptionData {
  shiftUpdated?: any;
  staffStatusChanged?: any;
  dashboardUpdated?: any;
  locationUpdate?: any;
  geofenceAlert?: any;
  shiftReminder?: any;
}

interface UseRealTimeSubscriptionsProps {
  onShiftUpdate?: (data: any) => void;
  onStaffStatusChange?: (data: any) => void;
  onDashboardUpdate?: (data: any) => void;
  onLocationUpdate?: (data: any) => void;
  onGeofenceAlert?: (data: any) => void;
  onShiftReminder?: (data: any) => void;
}

export function useRealTimeSubscriptions(props: UseRealTimeSubscriptionsProps = {}) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({});
  const [error, setError] = useState<string | null>(null);

  const {
    onShiftUpdate,
    onStaffStatusChange,
    onDashboardUpdate,
    onLocationUpdate,
    onGeofenceAlert,
    onShiftReminder,
  } = props;

  const connectWebSocket = useCallback(() => {
    if (!user?.auth0Id) return;

    try {
      // Create WebSocket connection for real-time subscriptions
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/graphql-ws`;
      const ws = new WebSocket(wsUrl, 'graphql-ws');

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);

        // Send connection init
        ws.send(JSON.stringify({
          type: 'connection_init',
          payload: {
            auth0Id: user.auth0Id,
          },
        }));

        // Subscribe to all events
        const subscriptions = [
          {
            id: 'shift-updates',
            type: 'start',
            payload: {
              query: `
                subscription {
                  shiftUpdated {
                    id
                    userId
                    clockInTime
                    clockOutTime
                    totalHours
                    user {
                      id
                      name
                      email
                    }
                  }
                }
              `,
            },
          },
          {
            id: 'staff-status',
            type: 'start',
            payload: {
              query: `
                subscription {
                  staffStatusChanged {
                    id
                    name
                    email
                    role
                  }
                }
              `,
            },
          },
          {
            id: 'dashboard-updates',
            type: 'start',
            payload: {
              query: `
                subscription {
                  dashboardUpdated {
                    totalStaff
                    currentlyClocked
                    todayShifts
                    averageHours
                  }
                }
              `,
            },
          },
          {
            id: 'location-updates',
            type: 'start',
            payload: {
              query: `
                subscription {
                  locationUpdate {
                    userId
                    lat
                    lng
                    timestamp
                    isWithinPerimeter
                  }
                }
              `,
            },
          },
          {
            id: 'geofence-alerts',
            type: 'start',
            payload: {
              query: `
                subscription {
                  geofenceAlert {
                    userId
                    user {
                      id
                      name
                    }
                    alertType
                    timestamp
                    location {
                      lat
                      lng
                    }
                  }
                }
              `,
            },
          },
          {
            id: 'shift-reminders',
            type: 'start',
            payload: {
              query: `
                subscription {
                  shiftReminder {
                    userId
                    user {
                      id
                      name
                    }
                    reminderType
                    message
                    timestamp
                  }
                }
              `,
            },
          },
        ];

        // Send all subscriptions
        subscriptions.forEach(sub => {
          ws.send(JSON.stringify(sub));
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'data') {
            const { data } = message.payload;
            
            if (data.shiftUpdated) {
              setSubscriptionData(prev => ({ ...prev, shiftUpdated: data.shiftUpdated }));
              onShiftUpdate?.(data.shiftUpdated);
            }
            
            if (data.staffStatusChanged) {
              setSubscriptionData(prev => ({ ...prev, staffStatusChanged: data.staffStatusChanged }));
              onStaffStatusChange?.(data.staffStatusChanged);
            }
            
            if (data.dashboardUpdated) {
              setSubscriptionData(prev => ({ ...prev, dashboardUpdated: data.dashboardUpdated }));
              onDashboardUpdate?.(data.dashboardUpdated);
            }
            
            if (data.locationUpdate) {
              setSubscriptionData(prev => ({ ...prev, locationUpdate: data.locationUpdate }));
              onLocationUpdate?.(data.locationUpdate);
            }
            
            if (data.geofenceAlert) {
              setSubscriptionData(prev => ({ ...prev, geofenceAlert: data.geofenceAlert }));
              onGeofenceAlert?.(data.geofenceAlert);
              
              // Show browser notification for geofence alerts
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Geofence Alert', {
                  body: `${data.geofenceAlert.user.name} ${data.geofenceAlert.alertType}`,
                  icon: '/favicon.ico',
                });
              }
            }
            
            if (data.shiftReminder) {
              setSubscriptionData(prev => ({ ...prev, shiftReminder: data.shiftReminder }));
              onShiftReminder?.(data.shiftReminder);
              
              // Show browser notification for reminders
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Shift Reminder', {
                  body: data.shiftReminder.message,
                  icon: '/favicon.ico',
                });
              }
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error');
      };

      return ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setError('Failed to connect');
      return null;
    }
  }, [user?.auth0Id, onShiftUpdate, onStaffStatusChange, onDashboardUpdate, onLocationUpdate, onGeofenceAlert, onShiftReminder]);

  useEffect(() => {
    const ws = connectWebSocket();
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [connectWebSocket]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return {
    isConnected,
    subscriptionData,
    error,
  };
}
