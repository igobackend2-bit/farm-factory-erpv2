import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { queueLocation, syncOfflineLocations } from '../offlineSyncService';
import { supabase } from '../supabase';

// Mock Dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
    fetch: jest.fn(),
}));

jest.mock('../supabase', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ error: null }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
    },
}));

describe('offlineSyncService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should queue a location when queueLocation is called', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

        const mockPayload = {
            user_id: 'user-123',
            latitude: 10,
            longitude: 20,
            speed: 1,
            heading: 0,
            battery_level: 0.9,
            timestamp: '2026-01-25T00:00:00Z',
        };

        await queueLocation(mockPayload);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
            'offline_locations_queue',
            JSON.stringify([mockPayload])
        );
    });

    it('should sync locations and clear queue when online', async () => {
        (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

        const mockQueue = [
            { user_id: 'user-123', latitude: 10, longitude: 20, timestamp: '2026-01-25T00:00:00Z' }
        ];
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockQueue));

        await syncOfflineLocations();

        expect(supabase.from).toHaveBeenCalledWith('location_logs');
        expect(supabase.from).toHaveBeenCalledWith('live_locations');
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('offline_locations_queue');
    });

    it('should NOT sync when offline', async () => {
        (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

        await syncOfflineLocations();

        expect(supabase.from).not.toHaveBeenCalled();
        expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });
});
