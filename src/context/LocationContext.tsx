'use client';

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { getCurrentLocation, watchPosition } from '../utils/location';
import { LocationCoordinates } from '../types';

interface LocationState {
  currentLocation: LocationCoordinates | null;
  watching: boolean;
  error: string | null;
  permission: PermissionState | null;
}

type LocationAction =
  | { type: 'SET_LOCATION'; payload: LocationCoordinates }
  | { type: 'SET_WATCHING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_PERMISSION'; payload: PermissionState }
  | { type: 'CLEAR_ERROR' };

const initialState: LocationState = {
  currentLocation: null,
  watching: false,
  error: null,
  permission: null,
};

function locationReducer(state: LocationState, action: LocationAction): LocationState {
  switch (action.type) {
    case 'SET_LOCATION':
      return { ...state, currentLocation: action.payload, error: null };
    case 'SET_WATCHING':
      return { ...state, watching: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_PERMISSION':
      return { ...state, permission: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

interface LocationContextType extends LocationState {
  requestLocation: () => Promise<void>;
  startWatching: () => Promise<void>;
  stopWatching: () => void;
  clearError: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(locationReducer, initialState);
  let watchId: number | null = null;

  useEffect(() => {
    // Check initial permission status
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        dispatch({ type: 'SET_PERMISSION', payload: result.state });
        
        result.addEventListener('change', () => {
          dispatch({ type: 'SET_PERMISSION', payload: result.state });
        });
      });
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const requestLocation = async () => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      const location = await getCurrentLocation();
      dispatch({ type: 'SET_LOCATION', payload: location });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    }
  };

  const startWatching = async () => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      
      // Get initial location
      const location = await getCurrentLocation();
      dispatch({ type: 'SET_LOCATION', payload: location });
      
      // Start watching
      watchId = watchPosition((position) => {
        dispatch({ type: 'SET_LOCATION', payload: position });
      });
      
      dispatch({ type: 'SET_WATCHING', payload: true });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    }
  };

  const stopWatching = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    dispatch({ type: 'SET_WATCHING', payload: false });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  return (
    <LocationContext.Provider
      value={{
        ...state,
        requestLocation,
        startWatching,
        stopWatching,
        clearError,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
