import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { format } from 'date-fns';
import { Alert } from 'react-native';

export interface ShiftSession {
    id: string;
    userId: string;
    date: string;
    shiftStart: string;
    shiftEnd: string | null;
    loginSelfieUrl: string;
    logoutSelfieUrl: string | null;
    loginLocation: { lat: number; lng: number } | null;
    logoutLocation: { lat: number; lng: number } | null;
    targetHours: number;
    maxHours: number;
    totalBreakMinutes: number;
    netWorkingMinutes: number | null;
    status: 'active' | 'completed' | 'incomplete';
    dayPlan: string | null;
}

interface ShiftStats {
    hoursWorked: number;
    breaksTaken: number;
    totalBreakMinutes: number;
    targetHours: number;
    progressPercent: number;
    isOvertime: boolean;
}

const MIN_LOGOUT_HOURS = 9;

export function useShiftSession() {
    const [currentSession, setCurrentSession] = useState<ShiftSession | null>(null);
    const [todayStats, setTodayStats] = useState<ShiftStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [isEnding, setIsEnding] = useState(false);

    const dateStr = format(new Date(), 'yyyy-MM-dd');

    const fetchSession = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setIsLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('shift_sessions')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', dateStr)
                .maybeSingle();

            if (error) {
                console.error('Error fetching shift session:', error);
                return;
            }

            if (data) {
                const session: ShiftSession = {
                    id: data.id,
                    userId: data.user_id,
                    date: data.date,
                    shiftStart: data.shift_start,
                    shiftEnd: data.shift_end,
                    loginSelfieUrl: data.login_selfie_url,
                    logoutSelfieUrl: data.logout_selfie_url,
                    loginLocation: data.login_location,
                    logoutLocation: data.logout_location,
                    targetHours: data.target_hours,
                    maxHours: data.max_hours,
                    totalBreakMinutes: data.total_break_minutes,
                    netWorkingMinutes: data.net_working_minutes,
                    status: data.status,
                    dayPlan: data.day_plan,
                };
                setCurrentSession(session);

                // Calculate live stats
                if (session.status === 'active') {
                    const now = new Date();
                    const start = new Date(session.shiftStart);
                    const totalMinutes = (now.getTime() - start.getTime()) / (1000 * 60);
                    const netMinutes = totalMinutes - session.totalBreakMinutes;
                    const hoursWorked = netMinutes / 60;
                    const progressPercent = Math.min((hoursWorked / session.targetHours) * 100, 100);

                    setTodayStats({
                        hoursWorked,
                        breaksTaken: 0,
                        totalBreakMinutes: session.totalBreakMinutes,
                        targetHours: session.targetHours,
                        progressPercent: Math.max(0, progressPercent),
                        isOvertime: hoursWorked > session.targetHours,
                    });
                } else if (session.netWorkingMinutes !== null) {
                    const hoursWorked = session.netWorkingMinutes / 60;
                    setTodayStats({
                        hoursWorked,
                        breaksTaken: 0,
                        totalBreakMinutes: session.totalBreakMinutes,
                        targetHours: session.targetHours,
                        progressPercent: Math.min((hoursWorked / session.targetHours) * 100, 100),
                        isOvertime: hoursWorked > session.targetHours,
                    });
                }
            } else {
                setCurrentSession(null);
                setTodayStats(null);
            }
        } catch (error) {
            console.error('Error in useShiftSession:', error);
        } finally {
            setIsLoading(false);
        }
    }, [dateStr]);

    useEffect(() => {
        fetchSession();
        const interval = setInterval(fetchSession, 60000);
        return () => clearInterval(interval);
    }, [fetchSession]);

    const startShift = async (
        selfieUrl: string,
        dayPlan: string,
        location?: { lat: number; lng: number }
    ) => {
        setIsStarting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            if (currentSession) throw new Error('Session already active');

            // Get user's shift config
            const { data: config } = await supabase
                .from('shift_user_assignments')
                .select('target_hours, max_hours')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle();

            const targetHours = config?.target_hours || 9;
            const maxHours = config?.max_hours || 12;

            // Create session
            const { data, error } = await supabase
                .from('shift_sessions')
                .insert({
                    user_id: user.id,
                    date: dateStr,
                    login_selfie_url: selfieUrl,
                    login_location: location || null,
                    target_hours: targetHours,
                    max_hours: maxHours,
                    day_plan: dayPlan,
                    status: 'active',
                })
                .select()
                .single();

            if (error) throw error;

            // Create first hourly slot
            await supabase
                .from('shift_hourly_slots')
                .insert({
                    session_id: data.id,
                    slot_number: 1,
                    slot_start: new Date().toISOString(),
                    plan: dayPlan,
                    plan_submitted_at: new Date().toISOString(),
                    status: 'plan_submitted',
                });

            await fetchSession();
            return { success: true, data };
        } catch (error: any) {
            console.error('Error starting shift:', error);
            return { success: false, error: error.message };
        } finally {
            setIsStarting(false);
        }
    };

    const endShift = async (
        selfieUrl: string,
        location?: { lat: number; lng: number }
    ) => {
        if (!currentSession) return { success: false, error: 'No active session' };

        // Check for EOD report
        const { data: eod } = await supabase
            .from('shift_eod_reports')
            .select('id')
            .eq('session_id', currentSession.id)
            .maybeSingle();

        if (!eod) {
            return { success: false, error: 'EOD report is required before logout' };
        }

        setIsEnding(true);

        try {
            const shiftEnd = new Date().toISOString();
            const shiftStart = new Date(currentSession.shiftStart);
            const totalElapsedMinutes = (new Date(shiftEnd).getTime() - shiftStart.getTime()) / (1000 * 60);
            const netWorkingMinutes = Math.max(0, Math.round(totalElapsedMinutes - currentSession.totalBreakMinutes));
            const requiredMinutes = MIN_LOGOUT_HOURS * 60;
            const shortfallMinutes = Math.max(0, requiredMinutes - netWorkingMinutes);
            const hasLop = shortfallMinutes > 0;
            const lopHours = Number((shortfallMinutes / 60).toFixed(2));
            const nextStatus: ShiftSession['status'] = hasLop ? 'incomplete' : 'completed';

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('shift_sessions')
                .update({
                    shift_end: shiftEnd,
                    logout_selfie_url: selfieUrl,
                    logout_location: location || null,
                    status: nextStatus,
                    net_working_minutes: netWorkingMinutes,
                    updated_at: shiftEnd,
                })
                .eq('id', currentSession.id);

            if (error) throw error;

            if (hasLop) {
                const todayDate = format(new Date(), 'yyyy-MM-dd');
                await supabase
                    .from('lop_entries')
                    .insert({
                        employee_id: user.id,
                        date: todayDate,
                        reason: `Shortfall on logout (${netWorkingMinutes} mins worked, minimum ${requiredMinutes} mins required)` ,
                        hours_lost: lopHours,
                        status: 'active',
                        reversal_status: null,
                    });
            }

            await fetchSession();
            return {
                success: true,
                hasLop,
                lopHours,
                netWorkingMinutes,
                minimumMinutes: requiredMinutes,
            };
        } catch (error: any) {
            console.error('Error ending shift:', error);
            return { success: false, error: error.message };
        } finally {
            setIsEnding(false);
        }
    };

    return {
        currentSession,
        todayStats,
        isLoading,
        isStarting,
        isEnding,
        hasActiveSession: currentSession?.status === 'active',
        startShift,
        endShift,
        refetch: fetchSession,
    };
}
