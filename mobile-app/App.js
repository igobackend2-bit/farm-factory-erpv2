import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, Pressable } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase, getSessionWithRecovery } from './src/services/supabase';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/auth/LoginScreen';
import { COLORS } from './src/theme';
import { Building2 } from 'lucide-react-native';
import pushNotificationService from './src/services/notificationService';
import realtimeService from './src/services/realtimeService';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            retry: 2,
        },
    },
});

const NAV_THEME = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: '#f8fafc',
        card: '#ffffff',
        text: '#0f172a',
        border: '#e2e8f0',
        primary: '#2563eb',
    },
};

// Inline gradient colors - avoids Android native bridge type issues
const LOADING_GRADIENT = ['#2563eb', '#1e40af'];

// Error Boundary to catch UI-level crashes
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Core App Crash:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#ef4444', marginBottom: 12 }}>
                        Diagnostic Catch
                    </Text>
                    <Text style={{ fontSize: 14, color: '#4b5563', textAlign: 'center', marginBottom: 20 }}>
                        {this.state.error?.message || 'Component failed to mount.'}
                    </Text>
                    <Pressable
                        onPress={() => this.setState({ hasError: false, error: null })}
                        style={{ backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
                    >
                        <Text style={{ color: '#fff', fontWeight: '600' }}>Retry Reload</Text>
                    </Pressable>
                </View>
            );
        }
        return this.props.children;
    }
}

export default function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [initStatus, setInitStatus] = useState('Starting...');

    useEffect(() => {
        let authSubscription = null;
        let isMounted = true;
        let pushResponseSubscription = null;
        let pushInitStarted = false;
        let realtimeInitStarted = false;

        const initPushNotifications = async () => {
            if (pushInitStarted) return;
            pushInitStarted = true;

            try {
                await pushNotificationService.registerDevice();

                // Add notification response handler
                pushResponseSubscription = pushNotificationService.addNotificationResponseListener((response) => {
                    pushNotificationService.handleNotificationResponse(response);
                });
            } catch (err) {
                console.warn('[MobileApp] Push notification init failed:', err);
            }
        };

        const initRealtime = async () => {
            if (realtimeInitStarted) return;
            realtimeInitStarted = true;

            try {
                await realtimeService.initialize();
            } catch (err) {
                console.warn('[MobileApp] Realtime init failed:', err);
            }
        };

        const initializeAuth = async () => {
            console.log('[MobileApp] Initializing auth...');
            if (isMounted) setInitStatus('Connecting...');

            // Safety timeout: proceed to login if auth is taking too long
            const timeoutId = setTimeout(() => {
                if (isMounted && loading) {
                    console.warn('[MobileApp] Auth init timed out (8s)');
                    setInitStatus('Timeout - forcing fallback');
                    setSession(null);
                    setLoading(false);
                }
            }, 8000);

            try {
                const { session, error, recovered } = await getSessionWithRecovery();
                clearTimeout(timeoutId);

                if (!isMounted) return;

                if (error) {
                    console.error('[MobileApp] Session check error:', error);
                    setSession(null);
                } else {
                    if (recovered) {
                        console.warn('[MobileApp] Cleared stale local auth session during startup.');
                    }
                    console.log('[MobileApp] Session found:', !!session);
                    setSession(session);

                    if (session) {
                        initPushNotifications();
                        initRealtime();
                    }
                }
            } catch (err) {
                clearTimeout(timeoutId);
                console.error('[MobileApp] Fatal Auth Error:', err);
                if (isMounted) setSession(null);
            } finally {
                if (isMounted) {
                    setInitStatus('Ready');
                    setLoading(false);
                }
            }
        };

        const setupListener = () => {
            try {
                const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
                    console.log('[MobileApp] Auth event:', event);
                    if (!isMounted) return;
                    
                    if (event === 'SIGNED_OUT') {
                        setSession(null);
                        pushNotificationService.unregisterDevice().catch(console.warn);
                        pushResponseSubscription?.remove?.();
                        pushResponseSubscription = null;
                        pushInitStarted = false;
                        realtimeInitStarted = false;
                    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                        setSession(newSession);
                        initPushNotifications();
                        initRealtime();
                    } else {
                        setSession(newSession);
                    }
                });
                authSubscription = data?.subscription || null;
            } catch (err) {
                console.warn('[MobileApp] Listener setup failed:', err);
            }
        };

        initializeAuth();
        setupListener();

        return () => {
            isMounted = false;
            if (authSubscription?.unsubscribe) {
                authSubscription.unsubscribe();
            }
            pushResponseSubscription?.remove?.();
            realtimeService.unsubscribeAll();
        };
    }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient
                    colors={['#0f4bbf', '#2563eb', '#4f8af8']}
                    style={styles.background}
                />
                <View style={styles.orbTop} />
                <View style={styles.orbBottom} />
                <View style={styles.logoContainer}>
                    <Building2 size={48} color="#fff" />
                </View>
                <Text style={styles.brandName}>IGO Group</Text>
                <Text style={styles.brandSub}>Operations Workspace</Text>
                <ActivityIndicator size="large" color="#fff" style={styles.loader} />
                <Text style={styles.loadingText}>{initStatus}</Text>
            </View>
        );
    }

    const isLoggedIn = session !== null;

    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <NavigationContainer theme={NAV_THEME}>
                    <View style={styles.container}>
                        {isLoggedIn ? <AppNavigator session={session} /> : <LoginScreen />}
                    </View>
                </NavigationContainer>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS?.background?.primary || '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    background: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    orbTop: {
        position: 'absolute',
        top: -90,
        right: -70,
        width: 220,
        height: 220,
        borderRadius: 200,
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    orbBottom: {
        position: 'absolute',
        bottom: -110,
        left: -70,
        width: 240,
        height: 240,
        borderRadius: 200,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    brandName: {
        fontSize: 30,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.8,
    },
    brandSub: {
        marginTop: 4,
        color: 'rgba(255,255,255,0.85)',
        fontSize: 14,
    },
    loader: {
        marginTop: 26,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
});
