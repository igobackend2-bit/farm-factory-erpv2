// Mock Test for Graduation of Mobile Services
import 'react-native-url-polyfill/auto';
import { supabase } from './supabase';
import { queueLocation, syncOfflineLocations } from './offlineSyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Manual Mocks for Browser-like/Node environment
const mockStorage: Record<string, string> = {};

// Override AsyncStorage methods manually
(AsyncStorage.getItem as any) = (key: string) => Promise.resolve(mockStorage[key] || null);
(AsyncStorage.setItem as any) = (key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
};
(AsyncStorage.removeItem as any) = (key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
};

async function runFullTest() {
    console.log('🚀 Starting Full Service Verification...');

    try {
        // 1. Verify Supabase Connection
        console.log('🔗 Connecting to Supabase...');
        const { data, error } = await supabase.from('profiles').select('id').limit(1);
        if (error) throw new Error(`Supabase connection failed: ${error.message}`);
        console.log('✅ Supabase Connection: Verified');

        // 2. Test Offline Queuing
        console.log('📦 Testing Offline Queue...');
        const mockPayload = {
            user_id: 'test-user-id',
            latitude: 12.34,
            longitude: 56.78,
            speed: 0,
            heading: 0,
            battery_level: 0.8,
            timestamp: new Date().toISOString(),
        };

        await queueLocation(mockPayload);
        const stored = await AsyncStorage.getItem('offline_locations_queue');
        if (!stored || JSON.parse(stored).length !== 1) {
            throw new Error('Offline queuing failed: Queue is empty or incorrect');
        }
        console.log('✅ Offline Queuing: Verified');

        // 3. Test Sync Logic
        console.log('🔄 Attempting Sync Simulation...');
        await syncOfflineLocations();

        // Check if queue was cleared (in mock sync, we assume success if no error)
        const postSyncStored = await AsyncStorage.getItem('offline_locations_queue');
        if (postSyncStored && JSON.parse(postSyncStored).length > 0) {
            throw new Error('Sync failed: Queue not cleared after successful sync');
        }
        console.log('✅ Offline Sync Logic: Verified');

        console.log('\n🌟 ALL CORE SERVICES VERIFIED SUCCESSFULLY!');
    } catch (err: any) {
        console.error(`\n❌ TEST FAILED: ${err.message}`);
    }
}

runFullTest();
