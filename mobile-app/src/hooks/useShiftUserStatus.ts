import { useState, useEffect } from 'react';
import { supabase, getSessionWithRecovery, getUserWithRecovery } from '../services/supabase';

export interface ShiftConfig {
    id: string;
    targetHours: number;
    maxHours: number;
    isActive: boolean;
    assignedAt: string;
}

export function useShiftUserStatus() {
    const [isShiftUser, setIsShiftUser] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [shiftConfig, setShiftConfig] = useState<ShiftConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkShiftStatus();

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                checkShiftStatus();
            } else {
                setIsShiftUser(false);
                setUserRole(null);
                setShiftConfig(null);
                setIsLoading(false);
            }
        });

        const authSubscription = data?.subscription;

        return () => {
            if (authSubscription?.unsubscribe) {
                authSubscription.unsubscribe();
            }
        };
    }, []);

    const checkShiftStatus = async () => {
        try {
            const { user, error: userError } = await getUserWithRecovery();

            if (userError) {
                throw userError;
            }

            if (!user) {
                const { session } = await getSessionWithRecovery();
                if (!session?.user) {
                    setIsShiftUser(false);
                    setUserRole(null);
                    setShiftConfig(null);
                    setIsLoading(false);
                    return;
                }
            }

            // User exists, check assignment and role
            const sessionData = await getSessionWithRecovery();
            const userId = user?.id || sessionData.session?.user?.id;

            if (!userId) {
                setIsShiftUser(false);
                setUserRole(null);
                setShiftConfig(null);
                setIsLoading(false);
                return;
            }

            // Fetch Role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (profile) {
                setUserRole(profile.role);
            }

            const { data, error } = await supabase
                .from('shift_user_assignments')
                .select('id, target_hours, max_hours, is_active, assigned_at')
                .eq('user_id', userId)
                .eq('is_active', true)
                .maybeSingle();

            if (error) {
                console.log('Error checking shift status:', error.message);
            }

            if (data) {
                setIsShiftUser(true);
                setShiftConfig({
                    id: data.id,
                    targetHours: data.target_hours,
                    maxHours: data.max_hours,
                    isActive: data.is_active,
                    assignedAt: data.assigned_at,
                });
            } else {
                setIsShiftUser(false);
                setShiftConfig(null);
            }
        } catch (error) {
            console.error('Error in useShiftUserStatus:', error);
            setIsShiftUser(false);
        } finally {
            setIsLoading(false);
        }
    };

    return { isShiftUser, userRole, shiftConfig, isLoading, refetch: checkShiftStatus };
}
