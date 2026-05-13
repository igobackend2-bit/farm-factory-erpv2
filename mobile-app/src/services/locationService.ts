import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import Constants from 'expo-constants';
import { supabase } from './supabase';

export const LOCATION_TASK_NAME = 'background-location-task';

// Check if running in Expo Go (doesn't support background tasks)
const isExpoGo = Constants.appOwnership === 'expo';

// Location tracking configuration
const TRACKING_CONFIG = {
    STANDARD_INTERVAL: 60000,      // 60 seconds
    DISTANCE_THRESHOLD: 50,        // 50 meters minimum movement
    STATIONARY_THRESHOLD: 5,       // m/s - below this is considered stationary
};

// Only define the background task if NOT in Expo Go
if (!isExpoGo) {
    try {
        TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: { data: any; error: any }) => {
            if (error) {
                console.error('📍 Background location task error:', error);
                return;
            }

            if (data) {
                const locations = data.locations;
                const location = locations && locations[0];

                if (location && location.coords) {
                    const coords = location.coords;
                    const latitude = coords.latitude;
                    const longitude = coords.longitude;
                    const speed = coords.speed;
                    const heading = coords.heading;
                    const accuracy = coords.accuracy;
                    const altitude = coords.altitude;
                    const timestamp = new Date().toISOString();

                    try {
                        const batteryLevel = await Battery.getBatteryLevelAsync();
                        const user = (await supabase.auth.getUser()).data.user;

                        if (!user) {
                            console.warn('📍 No authenticated user for location update');
                            return;
                        }

                        // Fetch active geofences for proximity check
                        const { data: geofences } = await supabase
                            .from('geofences')
                            .select('id, name, latitude, longitude, radius_meters, action_type')
                            .eq('is_active', true);

                        let isWithinGeofence = false;
                        let matchedGeofenceId = null;
                        let matchedGeofenceName = null;

                        if (geofences && geofences.length > 0) {
                            for (const fence of geofences) {
                                const distance = calculateDistance(
                                    latitude,
                                    longitude,
                                    fence.latitude,
                                    fence.longitude
                                );
                                if (distance <= fence.radius_meters) {
                                    isWithinGeofence = true;
                                    matchedGeofenceId = fence.id;
                                    matchedGeofenceName = fence.name;
                                    break;
                                }
                            }
                        }

                        const payload = {
                            user_id: user.id,
                            latitude,
                            longitude,
                            speed: speed ?? null,
                            heading: heading ?? null,
                            accuracy: accuracy ?? null,
                            altitude: altitude ?? null,
                            battery_level: batteryLevel ?? null,
                            timestamp,
                            is_within_geofence: isWithinGeofence,
                            matched_geofence_id: matchedGeofenceId,
                            device_info: {
                                platform: 'mobile',
                                task: LOCATION_TASK_NAME,
                            },
                        };

                        // Update live_locations (realtime position)
                        const { error: upsertError } = await supabase
                            .from('live_locations')
                            .upsert({
                                user_id: user.id,
                                latitude,
                                longitude,
                                speed: speed ?? null,
                                heading: heading ?? null,
                                battery_level: batteryLevel ?? null,
                                is_active: true,
                                last_updated: timestamp,
                            });

                        if (upsertError) {
                            // Log the error but do NOT throw — allow location_logs insert to proceed independently
                            console.error('📍 Live location upsert error (non-fatal):', upsertError);
                        }

                        // Insert into location_logs (history)
                        const { error: logError } = await supabase
                            .from('location_logs')
                            .insert(payload);

                        if (logError) {
                            console.error('📍 Location log insert error:', logError);
                        }

                        // Also log to user_location_logs if table exists
                        try {
                            await supabase.from('user_location_logs').insert({
                                user_id: user.id,
                                latitude,
                                longitude,
                                accuracy,
                                action_type: 'BACKGROUND',
                                is_within_geofence: isWithinGeofence,
                                matched_geofence_id: matchedGeofenceId,
                                device_info: { platform: 'mobile', source: 'background_task' },
                            });
                        } catch (e) {
                            // Table might not exist, ignore
                        }

                        console.log(
                            `📍 Location updated: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` +
                            (matchedGeofenceName ? ` | Geofence: ${matchedGeofenceName}` : '') +
                            ` | Battery: ${Math.round((batteryLevel ?? 0) * 100)}%`
                        );

                    } catch (err) {
                        console.error('📍 Error in background task:', err);
                    }
                }
            }
        });
        console.log('📍 Background task registered successfully');
    } catch (e) {
        console.warn('📍 Could not register background task (expected in Expo Go):', e);
    }
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export const startLocationTracking = async (): Promise<void> => {
    console.log('📍 Requesting location permissions...');

    // Request foreground permission first - safe property access
    const foregroundResult = await Location.requestForegroundPermissionsAsync();
    const foregroundStatus = foregroundResult?.status;
    if (foregroundStatus !== 'granted') {
        throw new Error('Foreground location permission not granted. Please enable in Settings.');
    }

    // If in Expo Go, only do foreground tracking
    if (isExpoGo) {
        console.log('📍 Running in Expo Go - background tracking not available');
        console.log('📍 Foreground location tracking enabled');
        return;
    }

    // Request background permission - safe property access
    const backgroundResult = await Location.requestBackgroundPermissionsAsync();
    const backgroundStatus = backgroundResult?.status;
    if (backgroundStatus !== 'granted') {
        console.warn('📍 Background permission not granted, will only track in foreground');
        return;
    }

    try {
        // Check if already running
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (hasStarted) {
            console.log('📍 Location tracking already active');
            return;
        }

        // Start background location updates
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: TRACKING_CONFIG.STANDARD_INTERVAL,
            distanceInterval: TRACKING_CONFIG.DISTANCE_THRESHOLD,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
                notificationTitle: 'IGO Group - Location Active',
                notificationBody: 'Your location is being tracked for attendance verification.',
                notificationColor: '#2563eb',
            },
            pausesUpdatesAutomatically: false,
            activityType: Location.ActivityType.Other,
        });

        console.log('📍 Background location tracking started successfully');

        // Get initial position immediately
        try {
            const initialLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            console.log(
                `📍 Initial position: ${initialLocation.coords.latitude.toFixed(6)}, ${initialLocation.coords.longitude.toFixed(6)}`
            );
        } catch (e) {
            console.warn('📍 Could not get initial position:', e);
        }
    } catch (e) {
        console.error('📍 Error starting background tracking:', e);
    }
};

export const stopLocationTracking = async (): Promise<void> => {
    console.log('📍 Stopping location tracking...');

    // Skip if in Expo Go
    if (isExpoGo) {
        console.log('📍 Expo Go - no background tracking to stop');
        return;
    }

    try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (hasStarted) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            console.log('📍 Background location tracking stopped');
        }
    } catch (e) {
        console.warn('📍 Error stopping location tracking:', e);
    }

    // Update live_locations to mark user as inactive
    try {
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
            await supabase.from('live_locations').upsert({
                user_id: user.id,
                is_active: false,
                last_updated: new Date().toISOString(),
            });
            console.log('📍 User marked as inactive in live_locations');
        }
    } catch (e) {
        console.warn('📍 Could not update live_locations:', e);
    }
};

export const getCurrentLocation = async (): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
} | null> => {
    try {
        const permissionResult = await Location.requestForegroundPermissionsAsync();
        const status = permissionResult?.status;
        if (status !== 'granted') {
            return null;
        }

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
        };
    } catch (error) {
        console.error('📍 Error getting current location:', error);
        return null;
    }
};

export const isTrackingActive = async (): Promise<boolean> => {
    // In Expo Go, we can't do background tracking
    if (isExpoGo) {
        return false;
    }
    
    try {
        return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
        return false;
    }
};

export const isRunningInExpoGo = (): boolean => {
    return isExpoGo;
};
