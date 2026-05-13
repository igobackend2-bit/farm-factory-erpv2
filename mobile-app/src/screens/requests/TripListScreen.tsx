import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { GlassCard, Button, AppScreen } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { Plus, MapPin, Calendar, DollarSign, Truck, CheckCircle, Clock, XCircle, Play } from 'lucide-react-native';
import { format } from 'date-fns';

interface TravelRequest {
    id: string;
    purpose: string;
    travel_type: string;
    from_location: string;
    to_location: string;
    travel_date: string;
    status: string;
    estimated_distance_km: number;
    estimated_cost: number;
    transport_mode: string;
    trip_started_at?: string;
    trip_ended_at?: string;
}

type StatusFilter = 'All' | 'Pending' | 'Approved' | 'Active' | 'Completed';

export default function TripListScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [requests, setRequests] = useState<TravelRequest[]>([]);
    const [filter, setFilter] = useState<StatusFilter>('All');

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) return;

            const { data, error } = await supabase
                .from('travel_requests')
                .select('*')
                .eq('employee_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setRequests(data);
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
            Alert.alert('Error', 'Failed to load travel requests.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchRequests();
    };

    const handleStartTrip = async (request: TravelRequest) => {
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) {
                Alert.alert('Error', 'Please login again.');
                return;
            }

            const today = format(new Date(), 'yyyy-MM-dd');
            const { data: dayPlan } = await supabase
                .from('day_plans')
                .select('id, tasks')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

            const hasTasks = Array.isArray(dayPlan?.tasks) && dayPlan.tasks.length > 0;
            if (!dayPlan || !hasTasks) {
                Alert.alert('Day Plan Required', 'Please submit today\'s day plan before starting a trip.');
                return;
            }
        } catch (error) {
            Alert.alert('Error', 'Unable to verify day plan. Please try again.');
            return;
        }

        Alert.alert(
            'Start Trip?',
            `Are you ready to start your trip to ${request.to_location}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Start',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('travel_requests')
                                .update({
                                    trip_started_at: new Date().toISOString(),
                                    status: 'Active'
                                })
                                .eq('id', request.id);

                            if (error) throw error;

                            Alert.alert('Success', 'Trip started! GPS tracking is now active.');
                            fetchRequests();

                            // Navigate to Active Trip Screen
                            navigation.navigate('ActiveTrip', { requestId: request.id });
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to start trip.');
                        }
                    }
                }
            ]
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return COLORS.warning[500];
            case 'Approved': return COLORS.success[500];
            case 'Active': return COLORS.primary[500];
            case 'Completed': return COLORS.neutral[500];
            case 'Rejected': return COLORS.error[500];
            default: return COLORS.neutral[400];
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Pending': return Clock;
            case 'Approved': return CheckCircle;
            case 'Active': return Play;
            case 'Completed': return CheckCircle;
            case 'Rejected': return XCircle;
            default: return Clock;
        }
    };

    const filteredRequests = requests.filter(req => {
        if (filter === 'All') return true;
        if (filter === 'Active') return req.status === 'Active' || (req.trip_started_at && !req.trip_ended_at);
        return req.status === filter;
    });

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary[500]} />
            </View>
        );
    }

    return (
        <AppScreen title="Travel Requests" subtitle="Plan, start, and track employee trips">

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {(['All', 'Pending', 'Approved', 'Active', 'Completed'] as StatusFilter[]).map((status) => (
                        <TouchableOpacity
                            key={status}
                            style={[
                                styles.filterTab,
                                filter === status ? styles.filterTabActive : null
                            ]}
                            onPress={() => setFilter(status)}
                        >
                            <Text style={[
                                styles.filterText,
                                filter === status ? styles.filterTextActive : null
                            ]}>
                                {status}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary[500]} />
                }
            >
                {filteredRequests.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MapPin size={64} color={COLORS.neutral[300]} />
                        <Text style={styles.emptyTitle}>No Travel Requests</Text>
                        <Text style={styles.emptyText}>
                            {filter === 'All'
                                ? 'Tap the + button to create a new travel request.'
                                : `No ${filter.toLowerCase()} requests found.`
                            }
                        </Text>
                    </View>
                ) : (
                    filteredRequests.map((request) => {
                        const StatusIcon = getStatusIcon(request.status);
                        const isApproved = request.status === 'Approved';
                        const isActive = request.status === 'Active' || (request.trip_started_at && !request.trip_ended_at);

                        return (
                            <GlassCard key={request.id} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.statusRow}>
                                        <StatusIcon size={16} color={getStatusColor(request.status)} />
                                        <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                                            {request.status}
                                        </Text>
                                    </View>
                                    <View style={[styles.typeBadge, { backgroundColor: request.travel_type === 'Local' ? COLORS.primary[50] : COLORS.warning[50] }]}>
                                        <Text style={[styles.typeText, { color: request.travel_type === 'Local' ? COLORS.primary[600] : COLORS.warning[600] }]}>
                                            {request.travel_type}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.purpose}>{request.purpose}</Text>

                                <View style={styles.routeContainer}>
                                    <View style={styles.routePoint}>
                                        <View style={[styles.routeDot, { backgroundColor: COLORS.success[500] }]} />
                                        <Text style={styles.locationText} numberOfLines={1}>{request.from_location}</Text>
                                    </View>
                                    <View style={styles.routeLine} />
                                    <View style={styles.routePoint}>
                                        <View style={[styles.routeDot, { backgroundColor: COLORS.error[500] }]} />
                                        <Text style={styles.locationText} numberOfLines={1}>{request.to_location}</Text>
                                    </View>
                                </View>

                                <View style={styles.metaRow}>
                                    <View style={styles.metaItem}>
                                        <Calendar size={14} color={COLORS.neutral[500]} />
                                        <Text style={styles.metaText}>{format(new Date(request.travel_date), 'dd MMM yyyy')}</Text>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <Truck size={14} color={COLORS.neutral[500]} />
                                        <Text style={styles.metaText}>{request.estimated_distance_km} km</Text>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <DollarSign size={14} color={COLORS.neutral[500]} />
                                        <Text style={styles.metaText}>₹{request.estimated_cost}</Text>
                                    </View>
                                </View>

                                {isApproved && !isActive && (
                                    <Button
                                        title="Start Trip"
                                        onPress={() => handleStartTrip(request)}
                                        size="sm"
                                        icon={<Play size={16} color="#fff" />}
                                        style={styles.startButton}
                                    />
                                )}

                                {isActive && (
                                    <TouchableOpacity
                                        style={styles.activeButton}
                                        onPress={() => navigation.navigate('ActiveTrip', { requestId: request.id })}
                                    >
                                        <Play size={16} color={COLORS.primary[600]} />
                                        <Text style={styles.activeButtonText}>Trip in Progress</Text>
                                    </TouchableOpacity>
                                )}
                            </GlassCard>
                        );
                    })
                )}
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('TravelApproval')}
                activeOpacity={0.9}
            >
                <View style={styles.fabGradient}>
                    <Plus size={26} color="#fff" />
                </View>
            </TouchableOpacity>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    filterContainer: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[100],
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
        marginTop: SPACING.sm,
    },
    filterScroll: {
        paddingHorizontal: SPACING.lg,
        gap: SPACING.sm,
    },
    filterTab: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.neutral[50],
    },
    filterTabActive: {
        backgroundColor: COLORS.primary[500],
    },
    filterText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.neutral[600],
    },
    filterTextActive: {
        color: '#fff',
    },

    content: {
        paddingTop: SPACING.lg,
        paddingHorizontal: 0,
        paddingBottom: 100,
    },

    emptyState: {
        alignItems: 'center',
        paddingVertical: SPACING.xxxl * 2,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.neutral[600],
        marginTop: SPACING.lg,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.neutral[400],
        textAlign: 'center',
        marginTop: SPACING.sm,
        maxWidth: 250,
    },

    card: {
        marginBottom: SPACING.lg,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    typeBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.sm,
    },
    typeText: {
        fontSize: 11,
        fontWeight: '600',
    },

    purpose: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.neutral[800],
        marginBottom: SPACING.md,
    },

    routeContainer: {
        marginBottom: SPACING.md,
    },
    routePoint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    routeDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    routeLine: {
        width: 2,
        height: 16,
        backgroundColor: COLORS.neutral[200],
        marginLeft: 4,
        marginVertical: 2,
    },
    locationText: {
        flex: 1,
        fontSize: 14,
        color: COLORS.neutral[700],
    },

    metaRow: {
        flexDirection: 'row',
        gap: SPACING.lg,
        flexWrap: 'wrap',
        marginBottom: SPACING.md,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: COLORS.neutral[600],
    },

    startButton: {
        marginTop: SPACING.sm,
    },
    activeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary[50],
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.primary[200],
    },
    activeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary[600],
    },

    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        ...SHADOWS.lg,
    },
    fabGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary[600],
    },
});
