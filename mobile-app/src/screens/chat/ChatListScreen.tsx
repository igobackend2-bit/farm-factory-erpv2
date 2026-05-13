import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { AppScreen, GlassCard, Button } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import {
    MessageCircle,
    Users,
    Plus,
    Search,
    ChevronRight,
    Circle,
    MoreVertical,
} from 'lucide-react-native';
import { format } from 'date-fns';

type ConversationType = 'direct' | 'group';

interface Conversation {
    id: string;
    type: ConversationType;
    name?: string;
    last_message?: string;
    last_message_at?: string;
    unread_count: number;
    other_user?: {
        id: string;
        name: string;
        avatar_url?: string;
        is_online?: boolean;
    };
    participants_count?: number;
}

type TabType = 'direct' | 'groups';

const BG_GRADIENT: readonly [string, string, string] = ['#e0e7ff', '#f0f9ff', '#f8fafc'] as const;

export default function ChatListScreen({ navigation }: any) {
    const [activeTab, setActiveTab] = useState<TabType>('direct');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
        init();
    }, []);

    useEffect(() => {
        if (currentUserId) {
            fetchConversations();
            subscribeToPresence();
        }
    }, [currentUserId, activeTab]);

    const init = async () => {
        const userResult = await supabase.auth.getUser();
        const user = userResult?.data?.user;
        if (user?.id) {
            setCurrentUserId(user.id);
        }
    };

    const subscribeToPresence = () => {
        // Use unique channel name to avoid conflicts
        const channelName = `chat-list-presence-${currentUserId}`;
        const channel = supabase.channel(channelName)
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const online = new Set<string>();
                Object.values(state).forEach((presences: any) => {
                    presences.forEach((presence: any) => {
                        if (presence.user_id && presence.user_id !== currentUserId) {
                            online.add(presence.user_id);
                        }
                    });
                });
                setOnlineUsers(online);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: currentUserId,
                        online_at: new Date().toISOString()
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const fetchConversations = async () => {
        try {
            const { data: participations, error } = await supabase
                .from('chat_participants')
                .select(`
                    conversation_id,
                    unread_count,
                    chat_conversations!inner(
                        id,
                        type,
                        name,
                        last_message,
                        last_message_at
                    )
                `)
                .eq('user_id', currentUserId)
                .eq('chat_conversations.type', activeTab)
                .order('last_message_at', { ascending: false, foreignTable: 'chat_conversations' });

            if (error) throw error;

            const convs: Conversation[] = [];
            for (const p of participations || []) {
                const conv: any = p.chat_conversations;
                const conversation: Conversation = {
                    id: conv.id,
                    type: conv.type,
                    name: conv.name,
                    last_message: conv.last_message,
                    last_message_at: conv.last_message_at,
                    unread_count: p.unread_count || 0,
                };

                if (conv.type === 'direct') {
                    const { data: otherParticipant } = await supabase
                        .from('chat_participants')
                        .select(`
                            user_id,
                            profiles(name, avatar_url)
                        `)
                        .eq('conversation_id', conv.id)
                        .neq('user_id', currentUserId)
                        .single();

                    if (otherParticipant) {
                        const profile: any = otherParticipant.profiles;
                        conversation.other_user = {
                            id: otherParticipant.user_id,
                            name: profile?.name || 'Unknown',
                            avatar_url: profile?.avatar_url,
                            is_online: onlineUsers.has(otherParticipant.user_id),
                        };
                    }
                } else {
                    const { count } = await supabase
                        .from('chat_participants')
                        .select('*', { count: 'exact', head: true })
                        .eq('conversation_id', conv.id);
                    conversation.participants_count = count || 0;
                }

                convs.push(conversation);
            }

            setConversations(convs);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchConversations();
    }, [currentUserId, activeTab]);

    const handleNewChat = () => {
        navigation.navigate('NewChat');
    };

    const handleConversationPress = (conversation: Conversation) => {
        navigation.navigate('ChatRoom', { conversationId: conversation.id, title: conversation.name || conversation.other_user?.name || 'Chat' });
    };

    const getInitials = (name: string) => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
    };

    const renderConversation = ({ item }: { item: Conversation }) => {
        const isOnline = item.other_user?.is_online;
        const displayName = item.type === 'direct' ? item.other_user?.name : item.name;
        const subtitle = item.type === 'group' ? `${item.participants_count} members` : (isOnline ? 'Online' : 'Offline');

        return (
            <TouchableOpacity
                style={styles.conversationItem}
                onPress={() => handleConversationPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.avatarContainer}>
                    <View style={[styles.avatar, item.type === 'group' ? styles.groupAvatar : null]}>
                        <Text style={styles.avatarText}>
                            {item.type === 'group' ? 'GP' : getInitials(displayName || '')}
                        </Text>
                    </View>
                    {item.type === 'direct' && (
                        <View style={[styles.onlineIndicator, isOnline ? styles.online : styles.offline]} />
                    )}
                </View>

                <View style={styles.conversationInfo}>
                    <View style={styles.conversationHeader}>
                        <Text style={styles.conversationName} numberOfLines={1}>
                            {displayName || 'Unknown'}
                        </Text>
                        {item.last_message_at && (
                            <Text style={styles.timeText}>
                                {format(new Date(item.last_message_at), 'hh:mm a')}
                            </Text>
                        )}
                    </View>
                    <Text style={styles.conversationSubtitle} numberOfLines={1}>
                        {subtitle}
                    </Text>
                    {item.last_message && (
                        <Text style={styles.lastMessage} numberOfLines={1}>
                            {item.last_message}
                        </Text>
                    )}
                </View>

                {item.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{item.unread_count}</Text>
                    </View>
                )}

                <ChevronRight size={20} color={COLORS.neutral[400]} />
            </TouchableOpacity>
        );
    };

    const filteredConversations = conversations.filter(c => {
        const name = c.type === 'direct' ? c.other_user?.name : c.name;
        return name?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <AppScreen title="Messages" subtitle="Chat with your team">
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Search size={18} color={COLORS.neutral[400]} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search conversations..."
                        placeholderTextColor={COLORS.neutral[400]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                <TouchableOpacity style={styles.newChatBtn} onPress={handleNewChat}>
                    <Plus size={22} color={COLORS.primary[600]} />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'direct' && styles.tabActive]}
                    onPress={() => setActiveTab('direct')}
                >
                    <MessageCircle size={18} color={activeTab === 'direct' ? COLORS.primary[600] : COLORS.neutral[500]} />
                    <Text style={[styles.tabText, activeTab === 'direct' && styles.tabTextActive]}>Direct</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
                    onPress={() => setActiveTab('groups')}
                >
                    <Users size={18} color={activeTab === 'groups' ? COLORS.primary[600] : COLORS.neutral[500]} />
                    <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>Groups</Text>
                </TouchableOpacity>
            </View>

            {/* Conversations List */}
            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary[600]} />
                </View>
            ) : (
                <FlatList
                    data={filteredConversations}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary[600]} />
                    }
                    renderItem={renderConversation}
                    ListEmptyComponent={
                        <GlassCard style={styles.emptyCard}>
                            <MessageCircle size={48} color={COLORS.neutral[300]} />
                            <Text style={styles.emptyTitle}>
                                {searchQuery ? 'No results found' : `No ${activeTab} messages`}
                            </Text>
                            <Text style={styles.emptyText}>
                                {searchQuery
                                    ? 'Try a different search term'
                                    : `Tap + to start a new ${activeTab === 'direct' ? 'conversation' : 'group chat'}`}
                            </Text>
                            {!searchQuery && (
                                <Button
                                    title={`New ${activeTab === 'direct' ? 'Chat' : 'Group'}`}
                                    onPress={handleNewChat}
                                    style={styles.emptyButton}
                                    icon={<Plus size={16} color="#fff" />}
                                />
                            )}
                        </GlassCard>
                    }
                />
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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        gap: SPACING.sm,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
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
    newChatBtn: {
        width: 44,
        height: 44,
        borderRadius: BORDER_RADIUS.lg,
        backgroundColor: COLORS.primary[50],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary[200],
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.lg,
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
    conversationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        ...SHADOWS.sm,
        marginBottom: SPACING.sm,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.primary[100],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.primary[200],
    },
    groupAvatar: {
        backgroundColor: COLORS.success[100],
        borderColor: COLORS.success[200],
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary[700],
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#fff',
    },
    online: {
        backgroundColor: COLORS.success[500],
    },
    offline: {
        backgroundColor: COLORS.neutral[400],
    },
    conversationInfo: {
        flex: 1,
        marginLeft: SPACING.md,
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    conversationName: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
        flex: 1,
    },
    timeText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    conversationSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        marginTop: 2,
    },
    lastMessage: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
        marginTop: 4,
    },
    unreadBadge: {
        backgroundColor: COLORS.primary[600],
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: SPACING.sm,
    },
    unreadText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    emptyCard: {
        margin: SPACING.lg,
        padding: SPACING.xxl,
        alignItems: 'center',
        gap: SPACING.md,
    },
    emptyTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[700],
        marginTop: SPACING.md,
    },
    emptyText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[500],
        textAlign: 'center',
    },
    emptyButton: {
        marginTop: SPACING.md,
    },
});
