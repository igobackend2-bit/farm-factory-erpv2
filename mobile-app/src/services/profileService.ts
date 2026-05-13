import { supabase, getUserWithRecovery } from './supabase';

export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  phone?: string;
  department?: string;
  designation?: string;
  role?: string;
  profile_picture_url?: string;
  employee_id?: string;
  date_of_joining?: string;
  blood_group?: string;
  emergency_contact?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

const getEmployeeId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

export const profileService = {
  async getProfile(): Promise<Profile | null> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (error) {
      console.error('[Profile] Error fetching profile:', error);
      return null;
    }
    return data;
  },

  async updateProfile(updates: Partial<Profile>): Promise<{ data?: Profile; error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', employeeId)
      .select()
      .single();

    return { data, error };
  },

  async updateProfilePicture(imageUri: string): Promise<{ data?: Profile; error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const fileName = `profile/${employeeId}/${Date.now()}.jpg`;
    
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('employee-profile-pictures')
      .upload(fileName, {
        uri: imageUri,
        type: 'image/jpeg',
        name: fileName,
      } as any, {
        upsert: true,
      });

    if (uploadError) {
      console.error('[Profile] Error uploading image:', uploadError);
      return { error: uploadError };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('employee-profile-pictures')
      .getPublicUrl(fileName);

    return this.updateProfile({ profile_picture_url: publicUrl });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ error?: any }> {
    const { user, error: userError } = await getUserWithRecovery();
    
    if (userError || !user) {
      return { error: userError || { message: 'Not authenticated' } };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('[Profile] Error changing password:', error);
      return { error };
    }

    return { error: null };
  },

  async signOut(): Promise<{ error?: any }> {
    const { error } = await supabase.auth.signOut();
    return { error };
  },
};

export const sopService = {
  async getSOPs(): Promise<any[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    const { data, error } = await supabase
      .from('employee_sops')
      .select('*, sop_templates(*)')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SOP] Error fetching SOPs:', error);
    }
    return data || [];
  },

  async acknowledge(sopId: string): Promise<{ error?: any }> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return { error: { message: 'Not authenticated' } };

    const { error } = await supabase
      .from('employee_sop acknowledgments')
      .insert({
        employee_id: employeeId,
        sop_id: sopId,
        acknowledged_at: new Date().toISOString(),
      });

    return { error };
  },
};

export const projectService = {
  async getAssigned(): Promise<any[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    const { data, error } = await supabase
      .from('employee_projects')
      .select('*, projects(*)')
      .eq('employee_id', employeeId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Project] Error fetching assigned:', error);
    }
    return data || [];
  },

  async getDetails(projectId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_phases(*), project_verticals(*)')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('[Project] Error fetching details:', error);
    }
    return data;
  },
};

export const siteVisitService = {
  async getList(status?: string): Promise<any[]> {
    const employeeId = await getEmployeeId();
    if (!employeeId) return [];

    let query = supabase
      .from('site_visits')
      .select('*')
      .eq('employee_id', employeeId)
      .order('visit_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.limit(30);
    if (error) {
      console.error('[SiteVisit] Error fetching list:', error);
    }
    return data || [];
  },

  async checkIn(visitId: string, location: any): Promise<{ error?: any }> {
    const { error } = await supabase
      .from('site_visits')
      .update({
        check_in_time: new Date().toISOString(),
        check_in_location: location,
        status: 'in_progress',
      })
      .eq('id', visitId);

    return { error };
  },

  async checkOut(visitId: string, location: any, notes?: string): Promise<{ error?: any }> {
    const { error } = await supabase
      .from('site_visits')
      .update({
        check_out_time: new Date().toISOString(),
        check_out_location: location,
        status: 'completed',
        notes: notes,
      })
      .eq('id', visitId);

    return { error };
  },
};