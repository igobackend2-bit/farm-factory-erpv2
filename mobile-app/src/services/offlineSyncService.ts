import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';

const QUEUE_KEY = 'offline_locations_queue';

interface QueuedLocation {
    user_id: string;
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    battery_level: number;
    timestamp: string;
}

export const queueLocation = async (location: QueuedLocation) => {
    try {
        const existingQueueStr = await AsyncStorage.getItem(QUEUE_KEY);
        const queue: QueuedLocation[] = existingQueueStr ? JSON.parse(existingQueueStr) : [];
        queue.push(location);
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        console.log(`Queued location offline. Total in queue: ${queue.length}`);
    } catch (error) {
        console.error('Error queuing location:', error);
    }
};

export const syncOfflineLocations = async () => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    try {
        const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
        if (!queueStr) return;

        const queue: QueuedLocation[] = JSON.parse(queueStr);
        if (queue.length === 0) return;

        console.log(`Attempting to sync ${queue.length} offline locations...`);

        // Insert into location_logs in batch
        const { error } = await supabase.from('location_logs').insert(queue);

        if (!error) {
            await AsyncStorage.removeItem(QUEUE_KEY);
            console.log('Successfully synced offline locations.');

            // Update live_locations with the most recent one
            const lastLocation = queue[queue.length - 1];
            await supabase.from('live_locations').upsert({
                user_id: lastLocation.user_id,
                latitude: lastLocation.latitude,
                longitude: lastLocation.longitude,
                speed: lastLocation.speed,
                heading: lastLocation.heading,
                battery_level: lastLocation.battery_level,
                is_active: true,
                last_updated: lastLocation.timestamp,
            });
        } else {
            console.error('Error syncing locations:', error);
        }
    } catch (error) {
        console.error('Sync failed:', error);
    }
};
