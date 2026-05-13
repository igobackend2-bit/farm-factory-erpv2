import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface EODReport {
    id: string;
    sessionId: string;
    summary: string;
    submittedAt: string;
    createdAt: string;
}

export function useShiftEOD(sessionId: string | undefined | null) {
    const [eodSummary, setEodSummary] = useState<EODReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchEOD = async () => {
            if (!sessionId) {
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('shift_eod_reports')
                    .select('*')
                    .eq('session_id', sessionId)
                    .maybeSingle();

                if (error) throw error;

                if (data) {
                    setEodSummary({
                        id: data.id,
                        sessionId: data.session_id,
                        summary: data.summary,
                        submittedAt: data.submitted_at,
                        createdAt: data.created_at
                    });
                } else {
                    setEodSummary(null);
                }
            } catch (error) {
                console.error('Error fetching EOD:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEOD();
    }, [sessionId]);

    const submitEOD = async (summary: string) => {
        if (!sessionId) return { success: false, error: 'No Session ID' };

        setIsSubmitting(true);
        try {
            const payload = {
                session_id: sessionId,
                summary,
                submitted_at: new Date().toISOString()
            };

            const existing = eodSummary;
            let result;

            if (existing) {
                result = await supabase
                    .from('shift_eod_reports')
                    .update(payload)
                    .eq('id', existing.id);
            } else {
                result = await supabase
                    .from('shift_eod_reports')
                    .insert(payload);
            }

            if (result.error) throw result.error;

            // Refresh logic - ideally we refetch
            setEodSummary(prev => ({
                ...prev!,
                summary,
                submittedAt: new Date().toISOString()
            }));

            return { success: true };
        } catch (error: any) {
            console.error('EOD Submit Error:', error);
            return { success: false, error: error.message };
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        eodSummary,
        loading,
        isSubmitting,
        submitEOD
    };
}
