import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Alert,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { AppScreen, GlassCard, Button } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { Search, User, Users, ChevronRight, Plus } from 'lucide-react-native';

interface Employee {
    id: string;
    full_name: string;
    designation?: string;
    department?: string;
    avatar_url?: string;
}

const BG_GRADIENT: readonly [string, string, string] = ['#e0e7ff', '#f0f9ff', '#f8fafc'] as const;

type ChannelCategory = 'people' | 'teams' | 'departments' | 'audit' | 'calendar' | 'meeting' | 'erp';

interface ChannelOption {
    id: string;
    name: string;
    category: ChannelCategory;
    description?: string;
    icon: string;
}

export default function NewChatScreen({ navigation }: any) {
    const [activeTab, setActiveTab] = useState<'direct' | 'group' | 'channels'>('direct');
    const [channelCategory, setChannelCategory] = useState<ChannelCategory>('people');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [groupName, setGroupName] = useState('');
    
    const CHANNEL_OPTIONS: ChannelOption[] = [
        { id: 'igo-all', name: 'IGO Connect', category: 'people', description: 'All employees', icon: '👥' },
        { id: 'igo-groups', name: 'IGO GROUPS ERP', category: 'teams', description: 'ERP system updates', icon: '💻' },
        { id: 'dept-it', name: 'IT & AI', category: 'departments', description: 'IT Department', icon: '🔧' },
        { id: 'dept-hr', name: 'HR Team', category: 'departments', description: 'Human Resources', icon: '👥' },
        { id: 'dept-accounts', name: 'Accounts', category: 'departments', description: 'Finance Team', icon: '💰' },
        { id: 'dept-engineering', name: 'Engineering', category: 'departments', description: 'Engineering Team', icon: '🏗️' },
        { id: 'audit-all', name: 'Audit Team', category: 'audit', description: 'Internal Audit', icon: '📋' },
        { id: 'calendar-events', name: 'Calendar', category: 'calendar', description: 'Company Events', icon: '📅' },
        { id: 'meeting-room', name: 'Meeting', category: 'meeting', description: 'Video Calls', icon: '📹' },
        { id: 'internal-all', name: 'Internal All', category: 'teams', description: 'Internal Communication', icon: '📢' },
        { id: 'erp-sync', name: 'ERP Data Sync', category: 'erp', description: 'ERP data sync chat channel', icon: '🤖' },
    ];

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        const userResult = await supabase.auth.getUser();
        const user = userResult?.data?.user;
        if (user?.id) {
            setCurrentUserId(user.id);
            fetchEmployees();
        }
    };

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, designation, department, avatar_url')
                .neq('id', currentUserId)
                .order('full_name');

            if (error) throw error;
            setEmployees(data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const startDirectChat = async (employee: Employee) => {
        try {
            // Check if conversation already exists
            const { data: myConvs } = await supabase
                .from('chat_participants')
                .select('conversation_id')
                .eq('user_id', currentUserId);
            
            const { data: theirConvs } = await supabase
                .from('chat_participants')
                .select('conversation_id')
                .eq('user_id', employee.id);
            
            const myConvIds = (myConvs || []).map((c: any) => c.conversation_id);
            const theirConvIds = (theirConvs || []).map((c: any) => c.conversation_id);
            const commonConvIds = myConvIds.filter((id: string) => theirConvIds.includes(id));

            if (commonConvIds.length > 0) {
                // Check if any is a direct conversation
                const { data: convData } = await supabase
                    .from('chat_conversations')
                    .select('id, type')
                    .in('id', commonConvIds)
                    .eq('type', 'direct');

                if (convData && convData.length > 0) {
                    navigation.replace('ChatRoom', {
                        conversationId: convData[0].id,
                        title: employee.full_name,
                    });
                    return;
                }
            }

            // Create new direct conversation
            const { data: newConv, error: convError } = await supabase
                .from('chat_conversations')
                .insert({ type: 'direct' })
                .select('id')
                .single();

            if (convError) throw convError;

            // Add participants
            await supabase.from('chat_participants').insert([
                { conversation_id: newConv.id, user_id: currentUserId },
                { conversation_id: newConv.id, user_id: employee.id },
            ]);

            navigation.replace('ChatRoom', {
                conversationId: newConv.id,
                title: employee.full_name,
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to start conversation');
        }
    };

    // ERP Sync: create a group chat containing ERP IT staff and sync data
    const startERPChat = async () => {
        try {
            // Fetch ERP staff (example: department IT & AI or designation containing IT)
            const { data: erpStaff, error } = await supabase
                .from('profiles')
                .select('id')
                .in('department', ['IT & AI', 'IT', 'Engineering'])
                .neq('id', currentUserId)
                .limit(50);
            if (error || !erpStaff) throw error || new Error('No ERP staff found');

            const erpIds = (erpStaff as any[]).map((p) => p.id);
            // Look for existing ERP-related group chats by known names, to be robust across deployments
            let existingConv: any = null;
            const { data: ei1 } = await supabase
                .from('chat_conversations')
                .select('id')
                .eq('name', 'IGO ERP')
                .eq('type', 'group')
                .single();
            if (ei1) existingConv = ei1;
            if (!existingConv) {
                const { data: ei2 } = await supabase
                    .from('chat_conversations')
                    .select('id')
                    .eq('name', 'ERP Sync')
                    .eq('type', 'group')
                    .single();
                if (ei2) existingConv = ei2;
            }
            const { data: newConv, error: convError } = existingConv
                ? { data: { id: existingConv.id } as any, error: null as any }
                : await supabase
                    .from('chat_conversations')
                    .insert({ type: 'group', name: 'ERP Sync' })
                    .select('id')
                    .single();
            if (convError) throw convError;

            const participants = [currentUserId, ...erpIds].map((uid) => ({ conversation_id: newConv.id, user_id: uid }));
            await supabase.from('chat_participants').insert(participants);
            navigation.replace('ChatRoom', { conversationId: newConv.id, title: 'ERP Sync' });
        } catch (err: any) {
            Alert.alert('Error', 'Failed to create ERP sync chat');
        }
    };

    const createGroup = async () => {
        if (selectedEmployees.length < 2) {
            Alert.alert('Error', 'Select at least 2 members for a group');
            return;
        }
        if (!groupName.trim()) {
            Alert.alert('Error', 'Enter a group name');
            return;
        }

        try {
            const { data: newConv, error: convError } = await supabase
                .from('chat_conversations')
                .insert({ type: 'group', name: groupName.trim() })
                .select('id')
                .single();

            if (convError) throw convError;

            // Add all participants including current user
            const participants = [currentUserId, ...selectedEmployees].map((userId) => ({
                conversation_id: newConv.id,
                user_id: userId,
            }));

            await supabase.from('chat_participants').insert(participants);

            navigation.replace('ChatRoom', {
                conversationId: newConv.id,
                title: groupName,
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to create group');
        }
    };

    const toggleEmployeeSelection = (employeeId: string) => {
        setSelectedEmployees((prev) =>
            prev.includes(employeeId)
                ? prev.filter((id) => id !== employeeId)
                : [...prev, employeeId]
        );
    };

    const filteredEmployees = employees.filter(
        (e) =>
            e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.department?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getInitials = (name: string) => {
        return name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '??';
    };

    const renderEmployee = ({ item }: { item: Employee }) => {
        const isSelected = selectedEmployees.includes(item.id);

        if (activeTab === 'direct') {
            return (
                <TouchableOpacity
                    style={styles.employeeItem}
                    onPress={() => startDirectChat(item)}
                    activeOpacity={0.7}
                >
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials(item.full_name)}</Text>
                    </View>
                    <View style={styles.employeeInfo}>
                        <Text style={styles.employeeName}>{item.full_name}</Text>
                        <Text style={styles.employeeDept}>
                            {item.designation || item.department || 'Employee'}
                        </Text>
                    </View>
                    <ChevronRight size={20} color={COLORS.neutral[400]} />
                </TouchableOpacity>
            );
        }

        // Group selection mode
        return (
            <TouchableOpacity
                style={[styles.employeeItem, isSelected && styles.employeeItemSelected]}
                onPress={() => toggleEmployeeSelection(item.id)}
                activeOpacity={0.7}
            >
                <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                    <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
                        {getInitials(item.full_name)}
                    </Text>
                </View>
                <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>{item.full_name}</Text>
                    <Text style={styles.employeeDept}>
                        {item.designation || item.department || 'Employee'}
                    </Text>
                </View>
                {isSelected && (
                    <View style={styles.checkmark}>
                        <Plus size={16} color="#fff" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <AppScreen title="New Chat" subtitle="Start a conversation">
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'direct' && styles.tabActive]}
                    onPress={() => {
                        setActiveTab('direct');
                        setSelectedEmployees([]);
                    }}
                >
                    <User size={18} color={activeTab === 'direct' ? COLORS.primary[600] : COLORS.neutral[500]} />
                    <Text style={[styles.tabText, activeTab === 'direct' && styles.tabTextActive]}>
                        People
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'group' && styles.tabActive]}
                    onPress={() => setActiveTab('group')}
                >
                    <Users size={18} color={activeTab === 'group' ? COLORS.primary[600] : COLORS.neutral[500]} />
                    <Text style={[styles.tabText, activeTab === 'group' && styles.tabTextActive]}>
                        Teams
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'channels' && styles.tabActive]}
                    onPress={() => setActiveTab('channels')}
                >
                    <Users size={18} color={activeTab === 'channels' ? COLORS.primary[600] : COLORS.neutral[500]} />
                    <Text style={[styles.tabText, activeTab === 'channels' && styles.tabTextActive]}>
                        Groups
                    </Text>
                </TouchableOpacity>
            </View>
            
            {/* Channel Category Tabs */}
            {activeTab === 'channels' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.channelTabs}>
                    {['people', 'teams', 'departments', 'audit', 'calendar', 'meeting', 'erp'].map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.channelTab, channelCategory === cat && styles.channelTabActive]}
                            onPress={() => setChannelCategory(cat as ChannelCategory)}
                        >
                            <Text style={[styles.channelTabText, channelCategory === cat && styles.channelTabTextActive]}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Search */}
            <View style={styles.searchContainer}>
                <Search size={18} color={COLORS.neutral[400]} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search employees..."
                    placeholderTextColor={COLORS.neutral[400]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* Group Name Input */}
            {activeTab === 'group' && (
                <View style={styles.groupInputContainer}>
                    <TextInput
                        style={styles.groupInput}
                        placeholder="Group name..."
                        placeholderTextColor={COLORS.neutral[400]}
                        value={groupName}
                        onChangeText={setGroupName}
                    />
                </View>
            )}

            {/* Selection count for group */}
            {activeTab === 'group' && selectedEmployees.length > 0 && (
                <View style={styles.selectionBar}>
                    <Text style={styles.selectionText}>
                        {selectedEmployees.length} selected
                    </Text>
                </View>
            )}

            {/* Channels List */}
            {activeTab === 'channels' && (
                <FlatList
                    data={CHANNEL_OPTIONS.filter(ch => ch.category === channelCategory)}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.channelItem}
                            onPress={() => {
                                if (item.id === 'erp-sync') {
                                    startERPChat();
                                } else {
                                    navigation.replace('ChatRoom', {
                                        conversationId: item.id,
                                        title: item.name,
                                    });
                                }
                            }}
                        >
                            <View style={styles.channelIcon}>
                                <Text style={styles.channelIconText}>{item.icon}</Text>
                            </View>
                            <View style={styles.channelInfo}>
                                <Text style={styles.channelName}>{item.name}</Text>
                                <Text style={styles.channelDesc}>{item.description}</Text>
                            </View>
                            <ChevronRight size={20} color={COLORS.neutral[400]} />
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* Employees List */}
            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary[600]} />
                </View>
            ) : (
                <FlatList
                    data={filteredEmployees}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={renderEmployee}
                    ListEmptyComponent={
                        <GlassCard style={styles.emptyCard}>
                            <Text style={styles.emptyText}>No employees found</Text>
                        </GlassCard>
                    }
                />
            )}

            {/* Create Group Button */}
            {activeTab === 'group' && selectedEmployees.length > 0 && (
                <View style={styles.createGroupContainer}>
                    <Button
                        title={`Create Group (${selectedEmployees.length})`}
                        onPress={createGroup}
                        style={styles.createGroupBtn}
                        icon={<Users size={18} color="#fff" />}
                    />
                </View>
            )}
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.md,
        gap: SPACING.sm,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xs,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },
    tabActive: {
        backgroundColor: COLORS.primary[50],
        borderColor: COLORS.primary[300],
    },
    tabText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[600],
    },
    tabTextActive: {
        color: COLORS.primary[700],
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        ...SHADOWS.sm,
    },
    searchInput: {
        flex: 1,
        marginLeft: SPACING.sm,
        fontSize: 16,
        color: COLORS.neutral[800],
    },
    groupInputContainer: {
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
    },
    groupInput: {
        backgroundColor: '#fff',
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        fontSize: 16,
        color: COLORS.neutral[800],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        ...SHADOWS.sm,
    },
    selectionBar: {
        backgroundColor: COLORS.primary[50],
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.primary[100],
    },
    selectionText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.primary[700],
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: 100,
        gap: SPACING.sm,
    },
    employeeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        ...SHADOWS.sm,
    },
    employeeItemSelected: {
        backgroundColor: COLORS.primary[50],
        borderWidth: 1,
        borderColor: COLORS.primary[300],
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary[100],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.primary[200],
    },
    avatarSelected: {
        backgroundColor: COLORS.primary[600],
        borderColor: COLORS.primary[700],
    },
    avatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary[700],
    },
    avatarTextSelected: {
        color: '#fff',
    },
    employeeInfo: {
        flex: 1,
        marginLeft: SPACING.md,
    },
    employeeName: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
    },
    employeeDept: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    checkmark: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.success[500],
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCard: {
        margin: SPACING.lg,
        padding: SPACING.xl,
        alignItems: 'center',
    },
    emptyText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[500],
    },
    createGroupContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: COLORS.neutral[200],
        ...SHADOWS.md,
    },
    createGroupBtn: {
        width: '100%',
    },
    channelTabs: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[200],
    },
    channelTab: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.md,
        marginRight: SPACING.sm,
    },
    channelTabActive: {
        backgroundColor: COLORS.primary[100],
    },
    channelTabText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
    },
    channelTabTextActive: {
        color: COLORS.primary[700],
        fontWeight: '600',
    },
    channelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[100],
    },
    channelIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary[50],
        alignItems: 'center',
        justifyContent: 'center',
    },
    channelIconText: {
        fontSize: 24,
    },
    channelInfo: {
        flex: 1,
        marginLeft: SPACING.md,
    },
    channelName: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
    },
    channelDesc: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
});
