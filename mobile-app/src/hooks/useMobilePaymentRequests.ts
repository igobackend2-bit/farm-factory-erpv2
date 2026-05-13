import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface PaymentRequest {
    id: string;
    requester_id: string;
    purpose: string;
    amount: number;
    vendor_name: string;
    urgency: 'normal' | 'important' | 'emergency';
    status: string;
    created_at: string;
    cutoff_time: string;
    cutoff_date: string;
    department?: string;
    requester?: {
        name: string;
        department: string;
    };
    audit_timeline?: any[];
}

export function useMobilePaymentRequests() {
    const [requests, setRequests] = useState<PaymentRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActioning, setIsActioning] = useState(false);

    const fetchRequests = useCallback(async () => {
        try {
            setIsLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get user role
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            const role = profile?.role || 'employee';

            let query = supabase
                .from('payment_requests')
                .select('*, requester:profiles!payment_requests_requester_id_fkey(name, department)');

            if (role === 'director' || role === 'ceo') {
                query = query.eq('status', 'director_audit');
            } else if (role === 'accounts') {
                query = query.eq('status', 'admin_audit');
            } else {
                // Regular users see nothing in audit board
                setRequests([]);
                setIsLoading(false);
                return;
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data as PaymentRequest[]);
        } catch (error) {
            console.error('Error fetching payment requests:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const approveRequest = async (id: string) => {
        try {
            setIsActioning(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            // Fetch current request and user profile
            const [requestData, profileData] = await Promise.all([
                supabase.from('payment_requests').select('audit_timeline, status').eq('id', id).single(),
                supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
            ]);

            if (requestData.error) throw requestData.error;
            const profile = profileData.data;
            const profileName = profile?.full_name || 'User (Mobile)';
            const role = profile?.role || 'director';

            const now = new Date().toISOString();

            // Determine next status
            let nextStatus = 'admin_audit';
            if (role === 'accounts') {
                nextStatus = 'paid';
            }

            const timelineEntry = {
                status: nextStatus,
                user_id: user.id,
                user_name: profileName,
                role: role,
                timestamp: now,
                notes: `Approved via Mobile App (${role})`
            };

            const currentTimeline = requestData.data?.audit_timeline || [];

            const updateData: any = {
                status: nextStatus,
                audit_timeline: [...currentTimeline, timelineEntry]
            };

            if (role === 'director') {
                updateData.director_approved_by = user.id;
                updateData.director_approved_at = now;
            }

            const { error } = await supabase
                .from('payment_requests')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setRequests(prev => prev.filter(r => r.id !== id));
            return { success: true };
        } catch (error: any) {
            console.error('Error approving request:', error);
            return { success: false, error: error.message };
        } finally {
            setIsActioning(false);
        }
    };

    const rejectRequest = async (id: string, reason: string) => {
        try {
            setIsActioning(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            // Fetch current request and user profile
            const [requestData, profileData] = await Promise.all([
                supabase.from('payment_requests').select('audit_timeline').eq('id', id).single(),
                supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
            ]);

            if (requestData.error) throw requestData.error;
            const profile = profileData.data;
            const profileName = profile?.full_name || 'User (Mobile)';
            const role = profile?.role || 'director';

            const now = new Date().toISOString();
            const timelineEntry = {
                status: 'rejected',
                user_id: user.id,
                user_name: profileName,
                role: role,
                timestamp: now,
                notes: `Rejected via Mobile App (${role}): ${reason}`
            };

            const currentTimeline = requestData.data?.audit_timeline || [];

            const { error } = await supabase
                .from('payment_requests')
                .update({
                    status: 'rejected',
                    audit_timeline: [...currentTimeline, timelineEntry]
                })
                .eq('id', id);

            if (error) throw error;

            setRequests(prev => prev.filter(r => r.id !== id));
            return { success: true };
        } catch (error: any) {
            console.error('Error rejecting request:', error);
            return { success: false, error: error.message };
        } finally {
            setIsActioning(false);
        }
    };

    return {
        requests,
        isLoading,
        isActioning,
        fetchRequests,
        approveRequest,
        rejectRequest
    };
}
