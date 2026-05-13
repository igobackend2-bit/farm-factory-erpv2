import { create } from 'zustand';

interface LocationState {
    // Duty status
    isOnDuty: boolean;
    setIsOnDuty: (status: boolean) => void;
    
    // Last known location
    lastLocation: {
        latitude: number;
        longitude: number;
        timestamp: number;
        accuracy?: number;
    } | null;
    setLastLocation: (location: { 
        latitude: number; 
        longitude: number; 
        timestamp: number;
        accuracy?: number;
    }) => void;
    
    // Geofence status
    isWithinGeofence: boolean;
    currentGeofenceName: string | null;
    setGeofenceStatus: (isWithin: boolean, name?: string | null) => void;
    
    // Tracking status
    isTrackingActive: boolean;
    setTrackingActive: (active: boolean) => void;
    
    // Queued locations count (for offline indicator)
    queuedLocationsCount: number;
    setQueuedLocationsCount: (count: number) => void;
    
    // Battery level
    batteryLevel: number | null;
    setBatteryLevel: (level: number | null) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
    // Duty status
    isOnDuty: false,
    setIsOnDuty: (status) => set({ isOnDuty: status }),
    
    // Last known location
    lastLocation: null,
    setLastLocation: (location) => set({ lastLocation: location }),
    
    // Geofence status
    isWithinGeofence: false,
    currentGeofenceName: null,
    setGeofenceStatus: (isWithin, name = null) => set({ 
        isWithinGeofence: isWithin, 
        currentGeofenceName: name 
    }),
    
    // Tracking status
    isTrackingActive: false,
    setTrackingActive: (active) => set({ isTrackingActive: active }),
    
    // Queued locations count
    queuedLocationsCount: 0,
    setQueuedLocationsCount: (count) => set({ queuedLocationsCount: count }),
    
    // Battery level
    batteryLevel: null,
    setBatteryLevel: (level) => set({ batteryLevel: level }),
}));
