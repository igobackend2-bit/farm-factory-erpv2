import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useShiftSession } from '../useShiftSession';

// ─── Mutable state (must be prefixed "mock" to be accessible inside jest.mock) ─
let mockSessionRow: any = null;
let mockEodRow: any = null;
let mockCapturedUpdate: any = null;

jest.mock('../../services/supabase', () => {
    const makeChain = (table: string) => {
        let isUpdateMode = false;

        const chain: any = {
            select: () => chain,
            eq: () => chain,
            maybeSingle: () => {
                if (table === 'shift_sessions') {
                    return Promise.resolve({ data: mockSessionRow, error: null });
                }
                if (table === 'shift_eod_reports') {
                    return Promise.resolve({ data: mockEodRow, error: null });
                }
                return Promise.resolve({ data: null, error: null });
            },
            single: () => Promise.resolve({ data: null, error: null }),
            insert: (payload: any) => ({
                select: () => ({
                    single: () => Promise.resolve({ data: { id: 'new-sess', ...payload }, error: null }),
                }),
            }),
            update: (payload: any) => {
                mockCapturedUpdate = payload;
                return {
                    eq: () => Promise.resolve({ error: null }),
                };
            },
        };
        return chain;
    };

    return {
        supabase: {
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
            },
            from: (table: string) => makeChain(table),
        },
    };
});

jest.mock('date-fns', () => ({
    format: jest.fn(() => '2026-04-08'),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('useShiftSession', () => {
    beforeEach(() => {
        mockSessionRow = null;
        mockEodRow = null;
        mockCapturedUpdate = null;
    });

    it('initialises with null session and no active session flag', async () => {
        const { result } = renderHook(() => useShiftSession());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.currentSession).toBeNull();
        expect(result.current.hasActiveSession).toBe(false);
    });

    it('loads an existing active session from supabase', async () => {
        mockSessionRow = {
            id: 'sess-1',
            user_id: 'user-1',
            date: '2026-04-08',
            shift_start: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            shift_end: null,
            login_selfie_url: 'selfie.jpg',
            logout_selfie_url: null,
            login_location: null,
            logout_location: null,
            target_hours: 9,
            max_hours: 12,
            total_break_minutes: 0,
            net_working_minutes: null,
            status: 'active',
            day_plan: 'Work',
        };

        const { result } = renderHook(() => useShiftSession());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.currentSession?.id).toBe('sess-1');
        expect(result.current.hasActiveSession).toBe(true);
        expect(result.current.todayStats?.targetHours).toBe(9);
    });

    it('calculates live progress for an active session', async () => {
        mockSessionRow = {
            id: 'sess-live',
            user_id: 'user-1',
            date: '2026-04-08',
            shift_start: new Date(Date.now() - 4.5 * 60 * 60 * 1000).toISOString(),
            shift_end: null,
            login_selfie_url: 'selfie.jpg',
            logout_selfie_url: null,
            login_location: null,
            logout_location: null,
            target_hours: 9,
            max_hours: 12,
            total_break_minutes: 30,
            net_working_minutes: null,
            status: 'active',
            day_plan: 'Work',
        };

        const { result } = renderHook(() => useShiftSession());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.todayStats?.progressPercent).toBeGreaterThan(0);
        expect(result.current.todayStats?.isOvertime).toBe(false);
    });

    describe('endShift', () => {
        it('updates status to completed and calculates net_working_minutes', async () => {
            const shiftStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            mockSessionRow = {
                id: 'sess-2',
                user_id: 'user-1',
                date: '2026-04-08',
                shift_start: shiftStart,
                shift_end: null,
                login_selfie_url: 'selfie.jpg',
                logout_selfie_url: null,
                login_location: null,
                logout_location: null,
                target_hours: 9,
                max_hours: 12,
                total_break_minutes: 10,
                net_working_minutes: null,
                status: 'active',
                day_plan: 'Work',
            };
            mockEodRow = { id: 'eod-1' };

            const { result } = renderHook(() => useShiftSession());
            await waitFor(() => expect(result.current.isLoading).toBe(false));

            await act(async () => {
                const res = await result.current.endShift('logout.jpg');
                expect(res.success).toBe(true);
            });

            expect(mockCapturedUpdate).toMatchObject({
                status: 'completed',
                net_working_minutes: expect.any(Number),
                logout_selfie_url: 'logout.jpg',
            });
            // ~60 elapsed - 10 break = ~50 net minutes
            expect(mockCapturedUpdate.net_working_minutes).toBeGreaterThanOrEqual(45);
            expect(mockCapturedUpdate.net_working_minutes).toBeLessThanOrEqual(65);
        });

        it('clamps net_working_minutes to 0 when break time exceeds elapsed', async () => {
            const shiftStart = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            mockSessionRow = {
                id: 'sess-edge',
                user_id: 'user-1',
                date: '2026-04-08',
                shift_start: shiftStart,
                shift_end: null,
                login_selfie_url: 'selfie.jpg',
                logout_selfie_url: null,
                login_location: null,
                logout_location: null,
                target_hours: 9,
                max_hours: 12,
                total_break_minutes: 9999,
                net_working_minutes: null,
                status: 'active',
                day_plan: 'Work',
            };
            mockEodRow = { id: 'eod-edge' };

            const { result } = renderHook(() => useShiftSession());
            await waitFor(() => expect(result.current.isLoading).toBe(false));

            await act(async () => {
                await result.current.endShift('logout.jpg');
            });

            expect(mockCapturedUpdate.net_working_minutes).toBe(0);
        });

        it('returns error when EOD report is missing', async () => {
            mockSessionRow = {
                id: 'sess-3',
                user_id: 'user-1',
                date: '2026-04-08',
                shift_start: new Date().toISOString(),
                shift_end: null,
                login_selfie_url: 'selfie.jpg',
                logout_selfie_url: null,
                login_location: null,
                logout_location: null,
                target_hours: 9,
                max_hours: 12,
                total_break_minutes: 0,
                net_working_minutes: null,
                status: 'active',
                day_plan: 'Work',
            };
            mockEodRow = null;

            const { result } = renderHook(() => useShiftSession());
            await waitFor(() => expect(result.current.isLoading).toBe(false));

            await act(async () => {
                const res = await result.current.endShift('logout.jpg');
                expect(res.success).toBe(false);
                expect(res.error).toMatch(/EOD/i);
            });
        });

        it('returns error when no active session exists', async () => {
            mockSessionRow = null;

            const { result } = renderHook(() => useShiftSession());
            await waitFor(() => expect(result.current.isLoading).toBe(false));

            await act(async () => {
                const res = await result.current.endShift('logout.jpg');
                expect(res.success).toBe(false);
            });
        });
    });
});
