import { renderHook, act } from '@testing-library/react-native';
import { useLocationStore } from '../useLocationStore';

describe('useLocationStore', () => {
    it('should initialize with default values', () => {
        const { result } = renderHook(() => useLocationStore());
        expect(result.current.isOnDuty).toBe(false);
        expect(result.current.lastLocation).toBe(null);
    });

    it('should update isOnDuty status', () => {
        const { result } = renderHook(() => useLocationStore());

        act(() => {
            result.current.setIsOnDuty(true);
        });

        expect(result.current.isOnDuty).toBe(true);
    });

    it('should update lastLocation', () => {
        const { result } = renderHook(() => useLocationStore());
        const mockLoc = { latitude: 1, longitude: 2, timestamp: 12345 };

        act(() => {
            result.current.setLastLocation(mockLoc);
        });

        expect(result.current.lastLocation).toEqual(mockLoc);
    });
});
