import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';

interface ShiftBreak {
    id: string;
    sessionId: string;
    breakStart: string;
    breakEnd: string | null;
    durationMinutes: number | null;
    reason: string | null;
}

export function useShiftBreaks(sessionId: string | undefined) {
    const [breaks, setBreaks] = useState<ShiftBreak[]>([]);
    const [activeBreak, setActiveBreak] = useState<ShiftBreak | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [isEnding, setIsEnding] = useState(false);

    const fetchBreaks = useCallback(async () => {
        if (!sessionId) {
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('shift_breaks')
                .select('*')
                .eq('session_id', sessionId)
                .order('break_start', { ascending: false });

            if (error) {
                console.error('Error fetching breaks:', error);
                return;
            }

            const mappedBreaks: ShiftBreak[] = (data || []).map((b: any) => ({
                id: b.id,
                sessionId: b.session_id,
                breakStart: b.break_start,
                breakEnd: b.break_end,
                durationMinutes: b.duration_minutes,
                reason: b.reason,
            }));

            setBreaks(mappedBreaks);

            // Check for active break (no end time)
            const active = mappedBreaks.find(b => b.breakEnd === null);
            setActiveBreak(active || null);
        } catch (error) {
            console.error('Error in useShiftBreaks:', error);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        fetchBreaks();
    }, [fetchBreaks]);

    const startBreak = async (reason?: string) => {
        if (!sessionId) return { success: false, error: 'No active session' };
        if (activeBreak) return { success: false, error: 'Break already active' };

        setIsStarting(true);
        try {
            const { data, error } = await supabase
                .from('shift_breaks')
                .insert({
                    session_id: sessionId,
                    break_start: new Date().toISOString(),
                    reason: reason || null,
                })
                .select()
                .single();

            if (error) throw error;

            await fetchBreaks();
            return { success: true, data };
        } catch (error: any) {
            console.error('Error starting break:', error);
            return { success: false, error: error.message };
        } finally {
            setIsStarting(false);
        }
    };

    const endBreak = async () => {
        if (!activeBreak) return { success: false, error: 'No active break' };

        setIsEnding(true);
        try {
            const breakEnd = new Date().toISOString();
            const breakStart = new Date(activeBreak.breakStart);
            const durationMinutes = Math.round((new Date(breakEnd).getTime() - breakStart.getTime()) / (1000 * 60));

            const { error } = await supabase
                .from('shift_breaks')
                .update({
                    break_end: breakEnd,
                    duration_minutes: durationMinutes,
                })
                .eq('id', activeBreak.id);

            if (error) throw error;

            await fetchBreaks();
            return { success: true };
        } catch (error: any) {
            console.error('Error ending break:', error);
            return { success: false, error: error.message };
        } finally {
            setIsEnding(false);
        }
    };

    // Calculate total break time
    const totalBreakMinutes = breaks.reduce((sum, b) => {
        if (b.durationMinutes) return sum + b.durationMinutes;
        if (b.breakEnd === null) {
            // Active break - calculate live
            const start = new Date(b.breakStart);
            const now = new Date();
            return sum + (now.getTime() - start.getTime()) / (1000 * 60);
        }
        return sum;
    }, 0);

    return {
        breaks,
        activeBreak,
        isOnBreak: activeBreak !== null,
        totalBreakMinutes,
        isLoading,
        isStarting,
        isEnding,
        startBreak,
        endBreak,
        refetch: fetchBreaks,
    };
}
