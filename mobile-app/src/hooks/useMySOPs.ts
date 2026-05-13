import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface SOP {
  id: string;
  name: string;
  code?: string;
  description?: string;
  category?: string;
  content: string;
  attachment_url?: string;
  version: number;
  is_active: boolean;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  assignment?: {
    id: string;
    acknowledged_at?: string;
    assigned_at: string;
  };
}

export interface SOPAssignment {
  id: string;
  sop_id: string;
  assigned_to_user_id?: string;
  assigned_to_department?: string;
  assigned_by: string;
  assigned_at: string;
  is_active: boolean;
  acknowledged_at?: string;
  updated_at: string;
}

export function useMySOPs() {
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSOPs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not logged in');
        return;
      }

      // Get user's department
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('department')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      const userDepartment = profileData?.department;

      // Fetch SOPs assigned to user or their department
      const { data, error: soQuery } = await supabase
        .from('sops')
        .select(`
          *,
          sop_assignments!inner(
            id,
            sop_id,
            assigned_to_user_id,
            assigned_to_department,
            is_active,
            acknowledged_at,
            assigned_at
          )
        `)
        .eq('is_active', true)
        .eq('sop_assignments.is_active', true)
        .or(
          `assigned_to_user_id.eq.${user.id},assigned_to_department.eq.${userDepartment ?? ''}`,
          { foreignTable: 'sop_assignments' }
        );

      if (soQuery) throw soQuery;

      if (data) {
        // Map the data to include assignment info
        const mappedSOPs: SOP[] = data.map((sop: any) => ({
          ...sop,
          assignment: sop.sop_assignments?.[0] || {},
        }));
        setSOPs(mappedSOPs);
      }
    } catch (err: any) {
      console.error('Error fetching SOPs:', err);
      setError(err.message || 'Failed to load SOPs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsAcknowledged = useCallback(async (assignmentId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('sop_assignments')
        .update({
          acknowledged_at: now,
          acknowledged_by_user_id: user.id,
          updated_at: now,
        })
        .eq('id', assignmentId);

      if (updateError) throw updateError;

      // Update local state
      setSOPs(prev => prev.map(sop => ({
        ...sop,
        assignment: sop.assignment?.id === assignmentId
          ? { ...sop.assignment, acknowledged_at: now }
          : sop.assignment,
      })));

      return { success: true };
    } catch (err: any) {
      console.error('Error acknowledging SOP:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSOPs();
    setRefreshing(false);
  }, [fetchSOPs]);

  useEffect(() => {
    fetchSOPs();
  }, [fetchSOPs]);

  return {
    sops,
    isLoading,
    error,
    refreshing,
    fetchSOPs,
    markAsAcknowledged,
    onRefresh,
  };
}
