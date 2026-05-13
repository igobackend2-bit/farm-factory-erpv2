import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useShiftBreaks } from '../useShiftBreaks';

// ─── Mock supabase ──────────────────────────────────────────────────────────
let mockQueryResult: any = { data: [], error: null };
let mockMutateResult: any = { error: null };
let mockInsertResult: any = { data: null, error: null };

// Track the last update payload so we can assert on it
let capturedUpdatePayload: any = null;

jest.mock('../../services/supabase', () => {
    // Build a chainable object that stores query/update results
    const makeChain = () => {
        const chain: any = {
            select: () => chain,
            eq: () => chain,
            order: () => Promise.resolve(mockQueryResult),
            insert: (payload: any) => Promise.resolve(mockInsertResult),
            update: (payload: any) => {
                capturedUpdatePayload = payload;
                return chain;
            },
            single: () => Promise.resolve({ data: null, error: null }),
        };
        // Make .eq() on an update chain resolve with the mutate result
        // We need to distinguish read eq (chainable) from write eq (terminal)
        // Strategy: track update state
        let isUpdate = false;
        chain.update = (payload: any) => {
            capturedUpdatePayload = payload;
            isUpdate = true;
            return chain;
        };
        const originalEq = chain.eq;
        chain.eq = (...args: any[]) => {
            if (isUpdate) {
                return Promise.resolve(mockMutateResult);
            }
            return chain;
        };
        return chain;
    };

    return {
        supabase: {
            from: () => makeChain(),
        },
    };
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useShiftBreaks', () => {
    beforeEach(() => {
        capturedUpdatePayload = null;
        mockQueryResult = { data: [], error: null };
        mockMutateResult = { error: null };
        mockInsertResult = { data: null, error: null };
    });

    it('initialises with empty breaks and no active break', async () => {
        const { result } = renderHook(() => useShiftBreaks('sess-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.breaks).toHaveLength(0);
        expect(result.current.activeBreak).toBeNull();
        expect(result.current.isOnBreak).toBe(false);
    });

    it('detects an active break (no break_end) on load', async () => {
        const activeBreakRow = {
            id: 'brk-1',
            session_id: 'sess-1',
            break_start: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            break_end: null,
            duration_minutes: null,
            reason: 'Lunch',
        };
        mockQueryResult = { data: [activeBreakRow], error: null };

        const { result } = renderHook(() => useShiftBreaks('sess-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.isOnBreak).toBe(true);
        expect(result.current.activeBreak?.id).toBe('brk-1');
    });

    it('calculates totalBreakMinutes for completed breaks', async () => {
        const completedBreak = {
            id: 'brk-2',
            session_id: 'sess-1',
            break_start: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            break_end: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            duration_minutes: 15,
            reason: null,
        };
        mockQueryResult = { data: [completedBreak], error: null };

        const { result } = renderHook(() => useShiftBreaks('sess-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.totalBreakMinutes).toBe(15);
    });

    it('endBreak sends duration_minutes to supabase', async () => {
        const breakStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        mockQueryResult = {
            data: [{
                id: 'brk-3',
                session_id: 'sess-1',
                break_start: breakStart,
                break_end: null,
                duration_minutes: null,
                reason: null,
            }],
            error: null,
        };

        const { result } = renderHook(() => useShiftBreaks('sess-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.isOnBreak).toBe(true);

        await act(async () => {
            const res = await result.current.endBreak();
            expect(res.success).toBe(true);
        });

        expect(capturedUpdatePayload).not.toBeNull();
        expect(capturedUpdatePayload).toMatchObject({
            break_end: expect.any(String),
            duration_minutes: expect.any(Number),
        });
        // ~10 minutes
        expect(capturedUpdatePayload.duration_minutes).toBeGreaterThanOrEqual(9);
        expect(capturedUpdatePayload.duration_minutes).toBeLessThanOrEqual(11);
    });

    it('startBreak returns error when break is already active', async () => {
        mockQueryResult = {
            data: [{
                id: 'brk-4',
                session_id: 'sess-1',
                break_start: new Date().toISOString(),
                break_end: null,
                duration_minutes: null,
                reason: null,
            }],
            error: null,
        };

        const { result } = renderHook(() => useShiftBreaks('sess-1'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            const res = await result.current.startBreak();
            expect(res.success).toBe(false);
            expect(res.error).toMatch(/already active/i);
        });
    });

    it('returns early when sessionId is undefined', async () => {
        const { result } = renderHook(() => useShiftBreaks(undefined));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.breaks).toHaveLength(0);
    });
});
