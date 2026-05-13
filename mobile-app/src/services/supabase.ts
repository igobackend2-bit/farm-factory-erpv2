import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../constants/Config';

const supabaseUrl = CONFIG.SUPABASE_URL;
const supabaseAnonKey = CONFIG.SUPABASE_ANON_KEY;

const resolveProjectRef = () => {
    try {
        return new URL(supabaseUrl).hostname.split('.')[0] || 'default';
    } catch (_error) {
        const match = supabaseUrl.match(/^https:\/\/([^.]+)/i);
        return match?.[1] || 'default';
    }
};

export const SUPABASE_AUTH_STORAGE_KEY = `sb-${resolveProjectRef()}-auth-token`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

export const isRefreshTokenMissingError = (error: unknown) => {
    const message =
        typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: unknown }).message ?? '').toLowerCase()
            : '';

    return message.includes('invalid refresh token') || message.includes('refresh token not found');
};

export const clearSupabaseAuthStorage = async () => {
    try {
        await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
        console.warn('[Supabase] Failed local sign-out while clearing stale auth state:', error);
    }

    try {
        await AsyncStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
    } catch (error) {
        console.warn('[Supabase] Failed to remove persisted auth storage:', error);
    }
};

export const getSessionWithRecovery = async () => {
    try {
        const { data, error } = await supabase.auth.getSession();

        if (error && isRefreshTokenMissingError(error)) {
            await clearSupabaseAuthStorage();
            return { session: null, error: null, recovered: true };
        }

        return { session: data.session ?? null, error, recovered: false };
    } catch (error) {
        if (isRefreshTokenMissingError(error)) {
            await clearSupabaseAuthStorage();
            return { session: null, error: null, recovered: true };
        }

        throw error;
    }
};

export const getUserWithRecovery = async () => {
    try {
        const { data, error } = await supabase.auth.getUser();

        if (error && isRefreshTokenMissingError(error)) {
            await clearSupabaseAuthStorage();
            return { user: null, error: null, recovered: true };
        }

        return { user: data.user ?? null, error, recovered: false };
    } catch (error) {
        if (isRefreshTokenMissingError(error)) {
            await clearSupabaseAuthStorage();
            return { user: null, error: null, recovered: true };
        }

        throw error;
    }
};

export const signInWithPasswordWithRecovery = async (credentials: { email: string; password: string }) => {
    const response = await supabase.auth.signInWithPassword(credentials);

    if (response.error && isRefreshTokenMissingError(response.error)) {
        await clearSupabaseAuthStorage();
        return supabase.auth.signInWithPassword(credentials);
    }

    return response;
};

export const signOutWithRecovery = async () => {
    const response = await supabase.auth.signOut();

    if (response.error && isRefreshTokenMissingError(response.error)) {
        await clearSupabaseAuthStorage();
        return { error: null };
    }

    return response;
};
