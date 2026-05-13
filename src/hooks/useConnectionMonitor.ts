import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useConnectionMonitor() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Internet connection restored');
        };
        const handleOffline = () => {
            setIsOnline(false);
            toast.error('Internet connection lost');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Supabase Real-time connection monitoring
        const checkStatus = () => {
            // We use a dummy channel to check connectivity if needed, 
            // but the main way is via internal channel state listeners.
            // However, Supabase client doesn't expose a global connection status directly easily,
            // so we listen to a specific system-like channel.
        };

        // Ultra-Stable Resilience Logic
        let reconnectTimer: any = null;
        let healthCheckInterval: any = null;

        const checkRealHealth = async () => {
            try {
                // Lightweight check - just ping the REST endpoint without querying actual data
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || ''}/rest/v1/`, {
                    method: 'HEAD',
                    headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '' }
                });
                return response.ok || response.status === 400; // 400 means reachable
            } catch {
                return false;
            }
        };

        const channel = supabase.channel('connection-pulse-v2')
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    if (reconnectTimer) clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                    if (supabaseStatus !== 'connected') {
                      console.log('[Connection] Supabase real-time restored');
                      setSupabaseStatus('connected');
                    }
                } else if (!reconnectTimer && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')) {
                    // Increased debounce: If not subscribed, wait 45 seconds before showing an error state
                    // This prevents "Reconnecting" noise during minor blips
                    reconnectTimer = setTimeout(async () => {
                        const isActuallyBroken = !(await checkRealHealth());
                        if (isActuallyBroken && navigator.onLine) {
                            console.warn('[Connection] Supabase real-time entering reconnection state');
                            setSupabaseStatus('reconnecting');
                        } else {
                            // If REST works, stay in 'connected' state
                            setSupabaseStatus('connected');
                        }
                        reconnectTimer = null;
                    }, 45000);
                }
            });

        // Periodic health check every 90 seconds to clear error state if it recovers
        healthCheckInterval = setInterval(async () => {
            if (supabaseStatus !== 'connected') {
              const isActuallyReachable = await checkRealHealth();
              if (isActuallyReachable) {
                  setSupabaseStatus('connected');
              }
            }
        }, 90000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (healthCheckInterval) clearInterval(healthCheckInterval);
            supabase.removeChannel(channel);
        };
    }, []);

    return {
        isOnline,
        supabaseStatus,
        isConnecting: !isOnline || supabaseStatus === 'reconnecting'
    };
}
