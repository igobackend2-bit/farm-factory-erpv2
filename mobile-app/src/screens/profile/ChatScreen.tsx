import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { Send, MessageCircle, Phone, Video, MoreVertical, FileIcon, Check, MessageSquare, X, Clock, Trash2, Eraser, Search, Pin, ChevronDown, ChevronUp, User, Users } from 'lucide-react-native';
import { AppScreen, GlassCard } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { supabase } from '../../services/supabase';
import { format } from 'date-fns';

type Reaction = {
    id: string;
    emoji: string;
    user_id: string;
    profiles?: { name: string };
};

type ReplyInfo = {
    id: string;
    content: string | null;
    type: string;
    profiles?: { name: string | null } | null;
};

type Message = {
    id: string;
    content: string | null;
    sender_id: string;
    created_at: string;
    type: 'text' | 'image' | 'audio' | 'file' | 'system';
    media_url: string | null;
    metadata: any;
    is_deleted?: boolean;
    is_edited?: boolean | null;
    is_pinned?: boolean | null;
    edited_at?: string | null;
    reply_to_id?: string | null;
    reply_to?: ReplyInfo | null;
    profiles: {
        name: string | null;
        role: string | null;
        department: string | null;
    } | null;
};

type Conversation = {
    id: string;
    name: string;
    type: 'direct' | 'group';
    participants: any[];
};

export default function ChatScreen() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [input, setInput] = useState('');
    const [currentUserId, setCurrentUserId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isTyping, setIsTyping] = useState<Record<string, boolean>>({});
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
    const [showPinnedPanel, setShowPinnedPanel] = useState(false);

    const scrollRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout>();
    const presenceChannelRef = useRef<any>(null);
    const subscriptionRef = useRef<any>(null);

    useEffect(() => {
        let cleanup: (() => void) | undefined;
        initChat().then((fn) => {
            cleanup = fn;
        });
        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    const initChat = async () => {
        const userResult = await supabase.auth.getUser();
        const user = userResult?.data?.user;
        if (user?.id) setCurrentUserId(user.id);

        await Promise.all([
            fetchConversations(),
            setupPresence(),
        ]);

        setIsLoading(false);

        return () => {
            if (presenceChannelRef.current) {
                supabase.removeChannel(presenceChannelRef.current);
            }
            if (subscriptionRef.current) {
                supabase.removeSubscription(subscriptionRef.current);
            }
        };
    };

    const setupPresence = async () => {
        const userResult = await supabase.auth.getUser();
        const user = userResult?.data?.user;
        if (!user?.id) return;

        const channel = supabase.channel(`chat-presence-${user.id}`, {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const presenceState = channel.presenceState();
                const online = new Set<string>();
                Object.values(presenceState).forEach((presences: any) => {
                    presences.forEach((presence: any) => {
                        online.add(presence.user_id);
                    });
                });
                setOnlineUsers(online);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('User joined:', key, newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('User left:', key, leftPresences);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: user.id,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        presenceChannelRef.current = channel;
    };

    const fetchConversations = async () => {
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) return;

            // Get conversations where user is a participant
            const { data: participantsData, error: participantsError } = await supabase
                .from('chat_participants')
                .select(`
                    conversation_id,
                    chat_conversations!inner(
                        id,
                        name,
                        type,
                        created_at,
                        updated_at
                    )
                `)
                .eq('user_id', user.id);

            if (participantsError) throw participantsError;

            if (participantsData) {
                const conversations = participantsData.map((p: any) => p.chat_conversations).filter(Boolean);
                setConversations(conversations);

                // Auto-select first conversation if none selected
                if (conversations.length > 0 && !selectedConversation) {
                    setSelectedConversation(conversations[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching conversations:', error);
        }
    };

    const fetchMessages = async (conversationId?: string) => {
        const targetConversationId = conversationId || selectedConversation?.id;
        if (!targetConversationId) return;

        try {
            const query = await supabase
                .from('chat_messages')
                .select(`
                    id,
                    content,
                    sender_id,
                    created_at,
                    type,
                    media_url,
                    metadata,
                    is_deleted,
                    is_edited,
                    is_pinned,
                    edited_at,
                    reply_to_id,
                    reply_to (
                        id,
                        content,
                        type,
                        profiles (name)
                    ),
                    profiles (
                        name,
                        role,
                        department
                    )
                `)
                .eq('conversation_id', targetConversationId)
                .order('created_at', { ascending: true })
                .limit(200);

            if (query.error) throw query.error;
            const messagesData = (query.data || []) as Message[];
            setMessages(messagesData);

            // Update pinned messages
            const pinned = messagesData.filter(m => m.is_pinned && !m.is_deleted);
            setPinnedMessages(pinned);

        } catch (error) {
            console.error('Error fetching messages:', error);
            // Fallback for demo
            if (messages.length === 0) {
                setMessages([
                    {
                        id: 'demo-1',
                        content: 'Welcome to ERP Chat. Configure chat_messages table to enable live chat.',
                        created_at: new Date().toISOString(),
                        sender_id: 'system',
                        type: 'system',
                        media_url: null,
                        metadata: null,
                        profiles: { name: 'System', role: null, department: null },
                    },
                ]);
            }
        }
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (text === '' || !selectedConversation) return;

        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) return;

            const messageData: any = {
                conversation_id: selectedConversation.id,
                sender_id: user.id,
                content: text,
                type: 'text',
            };

            if (replyingTo) {
                messageData.reply_to_id = replyingTo.id;
            }

            const insert = await supabase.from('chat_messages').insert(messageData);

            if (insert.error) throw insert.error;
            setInput('');
            setReplyingTo(null);

            // Update conversation updated_at
            await supabase
                .from('chat_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', selectedConversation.id);

        } catch (error) {
            console.error('Error sending message:', error);
            Alert.alert('Error', 'Failed to send message');
        }
    };

    const handleConversationSelect = (conversation: Conversation) => {
        setSelectedConversation(conversation);
        fetchMessages(conversation.id);
    };

    const handleReply = (message: Message) => {
        setReplyingTo(message);
    };

    const handlePinMessage = async (messageId: string) => {
        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({ is_pinned: true })
                .eq('id', messageId);

            if (error) throw error;
            fetchMessages();
        } catch (error) {
            console.error('Error pinning message:', error);
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({ is_deleted: true })
                .eq('id', messageId);

            if (error) throw error;
            fetchMessages();
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const mine = item.sender_id === currentUserId;
        const isSystem = item.type === 'system';

        if (item.is_deleted) {
            return (
                <View style={[styles.messageRow, mine ? styles.messageRowMine : null]}>
                    <View style={[styles.messageBubble, styles.deletedBubble]}>
                        <Text style={styles.deletedText}>This message was deleted</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={[styles.messageRow, mine ? styles.messageRowMine : null]}>
                {!mine && (
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {item.profiles?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                    </View>
                )}

                <View style={[styles.messageBubble, mine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
                    {!mine && (
                        <View style={styles.messageHeader}>
                            <Text style={styles.senderName}>{item.profiles?.name || 'User'}</Text>
                            {item.profiles?.department && (
                                <Text style={styles.senderDepartment}>{item.profiles.department}</Text>
                            )}
                        </View>
                    )}

                    {item.reply_to && (
                        <View style={styles.replyContainer}>
                            <Text style={styles.replyLabel}>Replying to {item.reply_to.profiles?.name || 'User'}</Text>
                            <Text style={styles.replyText} numberOfLines={1}>
                                {item.reply_to.content}
                            </Text>
                        </View>
                    )}

                    <Text style={[styles.messageText, mine ? styles.messageTextMine : null]}>
                        {item.content}
                    </Text>

                    {item.is_edited && (
                        <Text style={styles.editedLabel}>edited</Text>
                    )}

                    {item.is_pinned && (
                        <View style={styles.pinnedIndicator}>
                            <Pin size={12} color={COLORS.primary[600]} />
                        </View>
                    )}

                    <View style={styles.messageFooter}>
                        <Text style={[styles.timeText, mine ? styles.timeTextMine : null]}>
                            {format(new Date(item.created_at), 'HH:mm')}
                        </Text>

                        {mine && (
                            <View style={styles.messageActions}>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleReply(item)}
                                >
                                    <MessageSquare size={14} color={COLORS.neutral[400]} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handlePinMessage(item.id)}
                                >
                                    <Pin size={14} color={COLORS.neutral[400]} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleDeleteMessage(item.id)}
                                >
                                    <Trash2 size={14} color={COLORS.neutral[400]} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    const renderConversationItem = ({ item }: { item: Conversation }) => {
        const isSelected = selectedConversation?.id === item.id;
        const lastMessage = messages[messages.length - 1];

        return (
            <TouchableOpacity
                style={[styles.conversationItem, isSelected ? styles.conversationItemSelected : null]}
                onPress={() => handleConversationSelect(item)}
            >
                <View style={styles.conversationIcon}>
                    {item.type === 'group' ? (
                        <Users size={20} color={isSelected ? COLORS.primary[600] : COLORS.neutral[500]} />
                    ) : (
                        <User size={20} color={isSelected ? COLORS.primary[600] : COLORS.neutral[500]} />
                    )}
                </View>

                <View style={styles.conversationContent}>
                    <Text style={[styles.conversationName, isSelected ? styles.conversationNameSelected : null]}>
                        {item.name}
                    </Text>
                    {lastMessage && (
                        <Text style={styles.conversationLastMessage} numberOfLines={1}>
                            {lastMessage.profiles?.name}: {lastMessage.content}
                        </Text>
                    )}
                </View>

                {lastMessage && (
                    <Text style={styles.conversationTime}>
                        {format(new Date(lastMessage.created_at), 'HH:mm')}
                    </Text>
                )}
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <AppScreen>
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary[600]} />
                    <Text style={styles.loaderText}>Loading chat...</Text>
                </View>
            </AppScreen>
        );
    }

    return (
        <AppScreen title="Chat" subtitle="Team communication">
            <View style={styles.container}>
                {/* Conversations Sidebar */}
                <View style={styles.sidebar}>
                    <View style={styles.sidebarHeader}>
                        <Text style={styles.sidebarTitle}>Conversations</Text>
                        <TouchableOpacity style={styles.newChatButton}>
                            <MessageSquare size={20} color={COLORS.primary[600]} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={conversations}
                        keyExtractor={(item) => item.id}
                        renderItem={renderConversationItem}
                        style={styles.conversationsList}
                        showsVerticalScrollIndicator={false}
                    />
                </View>

                {/* Chat Window */}
                <View style={styles.chatWindow}>
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <View style={styles.chatHeader}>
                                <View style={styles.chatHeaderInfo}>
                                    {selectedConversation.type === 'group' ? (
                                        <Users size={20} color={COLORS.neutral[600]} />
                                    ) : (
                                        <User size={20} color={COLORS.neutral[600]} />
                                    )}
                                    <Text style={styles.chatTitle}>{selectedConversation.name}</Text>
                                </View>

                                <View style={styles.chatHeaderActions}>
                                    <TouchableOpacity style={styles.headerAction}>
                                        <Phone size={20} color={COLORS.neutral[600]} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.headerAction}>
                                        <Video size={20} color={COLORS.neutral[600]} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.headerAction}>
                                        <MoreVertical size={20} color={COLORS.neutral[600]} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Pinned Messages Panel */}
                            {pinnedMessages.length > 0 && (
                                <View style={styles.pinnedPanel}>
                                    <TouchableOpacity
                                        style={styles.pinnedHeader}
                                        onPress={() => setShowPinnedPanel(!showPinnedPanel)}
                                    >
                                        <Pin size={16} color={COLORS.primary[600]} />
                                        <Text style={styles.pinnedText}>
                                            {pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}
                                        </Text>
                                        {showPinnedPanel ? (
                                            <ChevronUp size={16} color={COLORS.neutral[600]} />
                                        ) : (
                                            <ChevronDown size={16} color={COLORS.neutral[600]} />
                                        )}
                                    </TouchableOpacity>

                                    {showPinnedPanel && (
                                        <ScrollView style={styles.pinnedMessages} horizontal showsHorizontalScrollIndicator={false}>
                                            {pinnedMessages.map((msg) => (
                                                <View key={msg.id} style={styles.pinnedMessage}>
                                                    <Text style={styles.pinnedMessageText} numberOfLines={2}>
                                                        {msg.content}
                                                    </Text>
                                                </View>
                                            ))}
                                        </ScrollView>
                                    )}
                                </View>
                            )}

                            {/* Messages */}
                            <FlatList
                                ref={scrollRef}
                                data={messages}
                                keyExtractor={(item) => item.id}
                                renderItem={renderMessage}
                                style={styles.messagesList}
                                contentContainerStyle={styles.messagesContainer}
                                showsVerticalScrollIndicator={false}
                                onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
                            />

                            {/* Reply Preview */}
                            {replyingTo && (
                                <View style={styles.replyPreview}>
                                    <View style={styles.replyPreviewContent}>
                                        <Text style={styles.replyPreviewLabel}>
                                            Replying to {replyingTo.profiles?.name || 'User'}
                                        </Text>
                                        <Text style={styles.replyPreviewText} numberOfLines={1}>
                                            {replyingTo.content}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.replyCancel}
                                        onPress={() => setReplyingTo(null)}
                                    >
                                        <X size={16} color={COLORS.neutral[500]} />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Input Area */}
                            <View style={styles.inputArea}>
                                <TouchableOpacity style={styles.attachButton}>
                                    <FileIcon size={20} color={COLORS.neutral[500]} />
                                </TouchableOpacity>

                                <TextInput
                                    style={styles.input}
                                    value={input}
                                    onChangeText={setInput}
                                    placeholder="Type a message..."
                                    placeholderTextColor={COLORS.neutral[400]}
                                    multiline
                                    maxLength={1000}
                                />

                                <TouchableOpacity
                                    style={[styles.sendButton, input.trim() ? styles.sendButtonActive : null]}
                                    onPress={sendMessage}
                                    disabled={!input.trim()}
                                >
                                    <Send size={20} color={input.trim() ? COLORS.neutral[50] : COLORS.neutral[400]} />
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <View style={styles.emptyChat}>
                            <MessageCircle size={48} color={COLORS.neutral[300]} />
                            <Text style={styles.emptyChatTitle}>Select a conversation</Text>
                            <Text style={styles.emptyChatText}>Choose a conversation from the sidebar to start chatting</Text>
                        </View>
                    )}
                </View>
            </View>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
    },
    sidebar: {
        width: 280,
        backgroundColor: COLORS.neutral[50],
        borderRightWidth: 1,
        borderRightColor: COLORS.neutral[200],
    },
    sidebarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[200],
    },
    sidebarTitle: {
        ...TYPOGRAPHY.h3,
        color: COLORS.neutral[800],
    },
    newChatButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primary[50],
        alignItems: 'center',
        justifyContent: 'center',
    },
    conversationsList: {
        flex: 1,
    },
    conversationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[100],
    },
    conversationItemSelected: {
        backgroundColor: COLORS.primary[50],
    },
    conversationIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.neutral[200],
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    conversationContent: {
        flex: 1,
    },
    conversationName: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
    },
    conversationNameSelected: {
        color: COLORS.primary[700],
    },
    conversationLastMessage: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        marginTop: 2,
    },
    conversationTime: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[400],
    },
    chatWindow: {
        flex: 1,
        backgroundColor: COLORS.neutral[25],
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
        backgroundColor: COLORS.neutral[50],
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[200],
    },
    chatHeaderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    chatTitle: {
        ...TYPOGRAPHY.h3,
        color: COLORS.neutral[800],
        marginLeft: SPACING.sm,
    },
    chatHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerAction: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: SPACING.xs,
    },
    pinnedPanel: {
        backgroundColor: COLORS.neutral[50],
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[200],
    },
    pinnedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.sm,
    },
    pinnedText: {
        ...TYPOGRAPHY.body,
        color: COLORS.primary[700],
        marginLeft: SPACING.sm,
        flex: 1,
    },
    pinnedMessages: {
        paddingHorizontal: SPACING.sm,
        paddingBottom: SPACING.sm,
    },
    pinnedMessage: {
        backgroundColor: COLORS.neutral[100],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.sm,
        marginRight: SPACING.sm,
        maxWidth: 200,
    },
    pinnedMessageText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[700],
    },
    messagesList: {
        flex: 1,
    },
    messagesContainer: {
        padding: SPACING.md,
        paddingBottom: SPACING.xl,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: SPACING.sm,
    },
    messageRowMine: {
        justifyContent: 'flex-end',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary[500],
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.sm,
    },
    avatarText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[50],
    },
    messageBubble: {
        maxWidth: '75%',
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        ...SHADOWS.sm,
    },
    messageBubbleMine: {
        backgroundColor: COLORS.primary[600],
        alignSelf: 'flex-end',
    },
    messageBubbleOther: {
        backgroundColor: COLORS.neutral[50],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },
    deletedBubble: {
        backgroundColor: COLORS.neutral[100],
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: COLORS.neutral[300],
    },
    deletedText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        fontStyle: 'italic',
    },
    messageHeader: {
        marginBottom: SPACING.xs,
    },
    senderName: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[700],
    },
    senderDepartment: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    replyContainer: {
        backgroundColor: COLORS.neutral[100],
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary[400],
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    replyLabel: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[600],
    },
    replyText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
        marginTop: 2,
    },
    messageText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[800],
    },
    messageTextMine: {
        color: COLORS.neutral[50],
    },
    editedLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        fontStyle: 'italic',
        marginTop: 2,
    },
    pinnedIndicator: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: COLORS.primary[100],
        borderRadius: 10,
        padding: 2,
    },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: SPACING.xs,
    },
    timeText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    timeTextMine: {
        color: COLORS.neutral[200],
    },
    messageActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: SPACING.xs,
    },
    replyPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.neutral[50],
        borderTopWidth: 1,
        borderTopColor: COLORS.neutral[200],
        padding: SPACING.sm,
    },
    replyPreviewContent: {
        flex: 1,
    },
    replyPreviewLabel: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[600],
    },
    replyPreviewText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
        marginTop: 2,
    },
    replyCancel: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.neutral[200],
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: SPACING.sm,
    },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: COLORS.neutral[50],
        borderTopWidth: 1,
        borderTopColor: COLORS.neutral[200],
        padding: SPACING.md,
    },
    attachButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.neutral[200],
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.sm,
    },
    input: {
        flex: 1,
        backgroundColor: COLORS.neutral[50],
        borderWidth: 1,
        borderColor: COLORS.neutral[300],
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        color: COLORS.neutral[800],
        maxHeight: 100,
        minHeight: 36,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.neutral[300],
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: SPACING.sm,
    },
    sendButtonActive: {
        backgroundColor: COLORS.primary[600],
    },
    emptyChat: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    emptyChatTitle: {
        ...TYPOGRAPHY.h3,
        color: COLORS.neutral[600],
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    emptyChatText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[500],
        textAlign: 'center',
    },
    loaderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loaderText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[600],
        marginTop: SPACING.md,
    },
});import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { Send, MessageCircle, Phone, Video, MoreVertical, FileIcon, Check, MessageSquare, X, Clock, Trash2, Eraser, Search, Pin, ChevronDown, ChevronUp, User, Users } from 'lucide-react-native';
import { AppScreen, GlassCard } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { supabase } from '../../services/supabase';
import { format } from 'date-fns';

type Reaction = {
    id: string;
    emoji: string;
    user_id: string;
    profiles?: { name: string };
};

type ReplyInfo = {
    id: string;
    content: string | null;
    type: string;
    profiles?: { name: string | null } | null;
};

type Message = {
    id: string;
    content: string | null;
    sender_id: string;
    created_at: string;
    type: 'text' | 'image' | 'audio' | 'file' | 'system';
    media_url: string | null;
    metadata: any;
    is_deleted?: boolean;
    is_edited?: boolean | null;
    is_pinned?: boolean | null;
    edited_at?: string | null;
    reply_to_id?: string | null;
    reply_to?: ReplyInfo | null;
    profiles: {
        name: string | null;
        role: string | null;
        department: string | null;
    } | null;
};

type Conversation = {
    id: string;
    name: string;
    type: 'direct' | 'group';
    participants: any[];
};

export default function ChatScreen() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [input, setInput] = useState('');
    const [currentUserId, setCurrentUserId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isTyping, setIsTyping] = useState<Record<string, boolean>>({});
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);

    const scrollRef = useRef<FlatList>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout>();
    const presenceChannelRef = useRef<any>(null);
    const subscriptionRef = useRef<any>(null);

    useEffect(() => {
        let cleanup: (() => void) | undefined;
        initChat().then((fn) => {
            cleanup = fn;
        });
        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    const initChat = async () => {
        const userResult = await supabase.auth.getUser();
        const user = userResult?.data?.user;
        if (user?.id) setCurrentUserId(user.id);

        await Promise.all([
            fetchConversations(),
            setupPresence(),
        ]);

        setIsLoading(false);

        return () => {
            if (presenceChannelRef.current) {
                supabase.removeChannel(presenceChannelRef.current);
            }
            if (subscriptionRef.current) {
                supabase.removeSubscription(subscriptionRef.current);
            }
        };
    };

    const setupPresence = async () => {
        const userResult = await supabase.auth.getUser();
        const user = userResult?.data?.user;
        if (!user?.id) return;

        const channel = supabase.channel(`chat-presence-${user.id}`, {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const presenceState = channel.presenceState();
                const online = new Set<string>();
                Object.values(presenceState).forEach((presences: any) => {
                    presences.forEach((presence: any) => {
                        online.add(presence.user_id);
                    });
                });
                setOnlineUsers(online);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('User joined:', key, newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('User left:', key, leftPresences);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: user.id,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        presenceChannelRef.current = channel;
    };

    const fetchConversations = async () => {
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) return;

            // Get conversations where user is a participant
            const { data: participantsData, error: participantsError } = await supabase
                .from('chat_participants')
                .select(`
                    conversation_id,
                    chat_conversations!inner(
                        id,
                        name,
                        type,
                        created_at,
                        updated_at
                    )
                `)
                .eq('user_id', user.id);

            if (participantsError) throw participantsError;

            if (participantsData) {
                const conversations = participantsData.map((p: any) => p.chat_conversations).filter(Boolean);
                setConversations(conversations);

                // Auto-select first conversation if none selected
                if (conversations.length > 0 && !selectedConversation) {
                    setSelectedConversation(conversations[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching conversations:', error);
        }
    };

    const fetchMessages = async (conversationId?: string) => {
        const targetConversationId = conversationId || selectedConversation?.id;
        if (!targetConversationId) return;

        try {
            const query = await supabase
                .from('chat_messages')
                .select(`
                    id,
                    content,
                    sender_id,
                    created_at,
                    type,
                    media_url,
                    metadata,
                    is_deleted,
                    is_edited,
                    is_pinned,
                    edited_at,
                    reply_to_id,
                    reply_to (
                        id,
                        content,
                        type,
                        profiles (name)
                    ),
                    profiles (
                        name,
                        role,
                        department
                    )
                `)
                .eq('conversation_id', targetConversationId)
                .order('created_at', { ascending: true })
                .limit(200);

            if (query.error) throw query.error;
            const messagesData = (query.data || []) as Message[];
            setMessages(messagesData);

            // Update pinned messages
            const pinned = messagesData.filter(m => m.is_pinned && !m.is_deleted);
            setPinnedMessages(pinned);

        } catch (error) {
            console.error('Error fetching messages:', error);
            // Fallback for demo
            if (messages.length === 0) {
                setMessages([
                    {
                        id: 'demo-1',
                        content: 'Welcome to ERP Chat. Configure chat_messages table to enable live chat.',
                        created_at: new Date().toISOString(),
                        sender_id: 'system',
                        type: 'system',
                        media_url: null,
                        metadata: null,
                        profiles: { name: 'System', role: null, department: null },
                    },
                ]);
            }
        }
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (text === '' || !selectedConversation) return;

        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) return;

            const messageData: any = {
                conversation_id: selectedConversation.id,
                sender_id: user.id,
                content: text,
                type: 'text',
            };

            if (replyingTo) {
                messageData.reply_to_id = replyingTo.id;
            }

            const insert = await supabase.from('chat_messages').insert(messageData);

            if (insert.error) throw insert.error;
            setInput('');
            setReplyingTo(null);

            // Update conversation updated_at
            await supabase
                .from('chat_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', selectedConversation.id);

        } catch (error) {
            console.error('Error sending message:', error);
            Alert.alert('Error', 'Failed to send message');
        }
    };

    const handleConversationSelect = (conversation: Conversation) => {
        setSelectedConversation(conversation);
        fetchMessages(conversation.id);
    };

    const handleReply = (message: Message) => {
        setReplyingTo(message);
    };

    const handlePinMessage = async (messageId: string) => {
        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({ is_pinned: true })
                .eq('id', messageId);

            if (error) throw error;
            fetchMessages();
        } catch (error) {
            console.error('Error pinning message:', error);
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({ is_deleted: true })
                .eq('id', messageId);

            if (error) throw error;
            fetchMessages();
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const mine = item.sender_id === currentUserId;
        const isSystem = item.type === 'system';

        if (item.is_deleted) {
            return (
                <View style={[styles.messageRow, mine ? styles.messageRowMine : null]}>
                    <View style={[styles.messageBubble, styles.deletedBubble]}>
                        <Text style={styles.deletedText}>This message was deleted</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={[styles.messageRow, mine ? styles.messageRowMine : null]}>
                {!mine && (
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {item.profiles?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                    </View>
                )}

                <View style={[styles.messageBubble, mine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
                    {!mine && (
                        <View style={styles.messageHeader}>
                            <Text style={styles.senderName}>{item.profiles?.name || 'User'}</Text>
                            {item.profiles?.department && (
                                <Text style={styles.senderDepartment}>{item.profiles.department}</Text>
                            )}
                        </View>
                    )}

                    {item.reply_to && (
                        <View style={styles.replyContainer}>
                            <Text style={styles.replyLabel}>Replying to {item.reply_to.profiles?.name || 'User'}</Text>
                            <Text style={styles.replyText} numberOfLines={1}>
                                {item.reply_to.content}
                            </Text>
                        </View>
                    )}

                    <Text style={[styles.messageText, mine ? styles.messageTextMine : null]}>
                        {item.content}
                    </Text>

                    {item.is_edited && (
                        <Text style={styles.editedLabel}>edited</Text>
                    )}

                    {item.is_pinned && (
                        <View style={styles.pinnedIndicator}>
                            <Pin size={12} color={COLORS.primary[600]} />
                        </View>
                    )}

                    <View style={styles.messageFooter}>
                        <Text style={[styles.timeText, mine ? styles.timeTextMine : null]}>
                            {format(new Date(item.created_at), 'HH:mm')}
                        </Text>

                        {mine && (
                            <View style={styles.messageActions}>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleReply(item)}
                                >
                                    <MessageSquare size={14} color={COLORS.neutral[400]} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handlePinMessage(item.id)}
                                >
                                    <Pin size={14} color={COLORS.neutral[400]} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleDeleteMessage(item.id)}
                                >
                                    <Trash2 size={14} color={COLORS.neutral[400]} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    const renderConversationItem = ({ item }: { item: Conversation }) => {
        const isSelected = selectedConversation?.id === item.id;
        const lastMessage = messages[messages.length - 1];

        return (
            <TouchableOpacity
                style={[styles.conversationItem, isSelected ? styles.conversationItemSelected : null]}
                onPress={() => handleConversationSelect(item)}
            >
                <View style={styles.conversationIcon}>
                    {item.type === 'group' ? (
                        <Users size={20} color={isSelected ? COLORS.primary[600] : COLORS.neutral[500]} />
                    ) : (
                        <User size={20} color={isSelected ? COLORS.primary[600] : COLORS.neutral[500]} />
                    )}
                </View>

                <View style={styles.conversationContent}>
                    <Text style={[styles.conversationName, isSelected ? styles.conversationNameSelected : null]}>
                        {item.name}
                    </Text>
                    {lastMessage && (
                        <Text style={styles.conversationLastMessage} numberOfLines={1}>
                            {lastMessage.profiles?.name}: {lastMessage.content}
                        </Text>
                    )}
                </View>

                {lastMessage && (
                    <Text style={styles.conversationTime}>
                        {format(new Date(lastMessage.created_at), 'HH:mm')}
                    </Text>
                )}
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <AppScreen>
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary[600]} />
                    <Text style={styles.loaderText}>Loading chat...</Text>
                </View>
            </AppScreen>
        );
    }

    return (
        <AppScreen title="Chat" subtitle="Team communication">
            <View style={styles.container}>
                {/* Conversations Sidebar */}
                <View style={styles.sidebar}>
                    <View style={styles.sidebarHeader}>
                        <Text style={styles.sidebarTitle}>Conversations</Text>
                        <TouchableOpacity style={styles.newChatButton}>
                            <MessageSquare size={20} color={COLORS.primary[600]} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={conversations}
                        keyExtractor={(item) => item.id}
                        renderItem={renderConversationItem}
                        style={styles.conversationsList}
                        showsVerticalScrollIndicator={false}
                    />
                </View>

                {/* Chat Window */}
                <View style={styles.chatWindow}>
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <View style={styles.chatHeader}>
                                <View style={styles.chatHeaderInfo}>
                                    {selectedConversation.type === 'group' ? (
                                        <Users size={20} color={COLORS.neutral[600]} />
                                    ) : (
                                        <User size={20} color={COLORS.neutral[600]} />
                                    )}
                                    <Text style={styles.chatTitle}>{selectedConversation.name}</Text>
                                </View>

                                <View style={styles.chatHeaderActions}>
                                    <TouchableOpacity style={styles.headerAction}>
                                        <Phone size={20} color={COLORS.neutral[600]} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.headerAction}>
                                        <Video size={20} color={COLORS.neutral[600]} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.headerAction}>
                                        <MoreVertical size={20} color={COLORS.neutral[600]} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Pinned Messages Panel */}
                            {pinnedMessages.length > 0 && (
                                <View style={styles.pinnedPanel}>
                                    <TouchableOpacity
                                        style={styles.pinnedHeader}
                                        onPress={() => setShowPinnedPanel(!showPinnedPanel)}
                                    >
                                        <Pin size={16} color={COLORS.primary[600]} />
                                        <Text style={styles.pinnedText}>
                                            {pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}
                                        </Text>
                                        {showPinnedPanel ? (
                                            <ChevronUp size={16} color={COLORS.neutral[600]} />
                                        ) : (
                                            <ChevronDown size={16} color={COLORS.neutral[600]} />
                                        )}
                                    </TouchableOpacity>

                                    {showPinnedPanel && (
                                        <ScrollView style={styles.pinnedMessages} horizontal showsHorizontalScrollIndicator={false}>
                                            {pinnedMessages.map((msg) => (
                                                <View key={msg.id} style={styles.pinnedMessage}>
                                                    <Text style={styles.pinnedMessageText} numberOfLines={2}>
                                                        {msg.content}
                                                    </Text>
                                                </View>
                                            ))}
                                        </ScrollView>
                                    )}
                                </View>
                            )}

                            {/* Messages */}
                            <FlatList
                                ref={scrollRef}
                                data={messages}
                                keyExtractor={(item) => item.id}
                                renderItem={renderMessage}
                                style={styles.messagesList}
                                contentContainerStyle={styles.messagesContainer}
                                showsVerticalScrollIndicator={false}
                                onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
                            />

                            {/* Reply Preview */}
                            {replyingTo && (
                                <View style={styles.replyPreview}>
                                    <View style={styles.replyPreviewContent}>
                                        <Text style={styles.replyPreviewLabel}>
                                            Replying to {replyingTo.profiles?.name || 'User'}
                                        </Text>
                                        <Text style={styles.replyPreviewText} numberOfLines={1}>
                                            {replyingTo.content}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.replyCancel}
                                        onPress={() => setReplyingTo(null)}
                                    >
                                        <X size={16} color={COLORS.neutral[500]} />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Input Area */}
                            <View style={styles.inputArea}>
                                <TouchableOpacity style={styles.attachButton}>
                                    <FileIcon size={20} color={COLORS.neutral[500]} />
                                </TouchableOpacity>

                                <TextInput
                                    style={styles.input}
                                    value={input}
                                    onChangeText={setInput}
                                    placeholder="Type a message..."
                                    placeholderTextColor={COLORS.neutral[400]}
                                    multiline
                                    maxLength={1000}
                                />

                                <TouchableOpacity
                                    style={[styles.sendButton, input.trim() ? styles.sendButtonActive : null]}
                                    onPress={sendMessage}
                                    disabled={!input.trim()}
                                >
                                    <Send size={20} color={input.trim() ? COLORS.neutral[50] : COLORS.neutral[400]} />
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <View style={styles.emptyChat}>
                            <MessageCircle size={48} color={COLORS.neutral[300]} />
                            <Text style={styles.emptyChatTitle}>Select a conversation</Text>
                            <Text style={styles.emptyChatText}>Choose a conversation from the sidebar to start chatting</Text>
                        </View>
                    )}
                </View>
            </View>
        </AppScreen>
    );
}
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const fetchMessages = async () => {
        try {
            const query = await supabase
                .from('chat_messages')
                .select('id, message, created_at, sender_id, sender_name')
                .order('created_at', { ascending: true })
                .limit(200);

            if (query.error) throw query.error;
            setMessages((query.data || []) as ChatMessage[]);
        } catch (_error) {
            // graceful fallback for missing table
            if (messages.length === 0) {
                setMessages([
                    {
                        id: 'demo-1',
                        message: 'Welcome to ERP Chat. Configure chat_messages table to enable live chat.',
                        created_at: new Date().toISOString(),
                        sender_id: 'system',
                        sender_name: 'System',
                    },
                ]);
            }
        }
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (text === '') return;

        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            const senderId = user?.id || 'guest';
            const senderName = user?.email?.split('@')[0] || 'You';

            const insert = await supabase.from('chat_messages').insert({
                message: text,
                sender_id: senderId,
                sender_name: senderName,
            });

            if (insert.error) throw insert.error;
            setInput('');
            fetchMessages();
        } catch (_error) {
            // local fallback append if backend unavailable
            setMessages((prev) => [
                ...prev,
                {
                    id: `local-${Date.now()}`,
                    message: text,
                    created_at: new Date().toISOString(),
                    sender_id: currentUserId || 'guest',
                    sender_name: 'You',
                },
            ]);
            setInput('');
        }
    };

    const sorted = useMemo(() => messages, [messages]);

    return (
        <AppScreen title="Chat" subtitle="ERP team communication">
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={90}
            >
                <FlatList
                    data={sorted}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => {
                        const mine = item.sender_id === currentUserId;
                        return (
                            <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : null]}>
                                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                                    {!mine ? <Text style={styles.sender}>{item.sender_name || 'User'}</Text> : null}
                                    <Text style={[styles.msgText, mine ? styles.msgTextMine : null]}>{item.message}</Text>
                                    <Text style={[styles.timeText, mine ? styles.timeTextMine : null]}>
                                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <GlassCard style={styles.emptyCard}>
                            <MessageCircle size={24} color={COLORS.neutral[500]} />
                            <Text style={styles.emptyText}>No messages yet.</Text>
                        </GlassCard>
                    }
                />

                <View style={styles.composer}>
                    <TextInput
                        style={styles.input}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Type a message"
                        placeholderTextColor={COLORS.neutral[400]}
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                        <Send size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    list: {
        paddingTop: SPACING.md,
        paddingBottom: SPACING.lg,
        gap: SPACING.sm,
    },
    bubbleRow: {
        flexDirection: 'row',
    },
    bubbleRowMine: {
        justifyContent: 'flex-end',
    },
    bubble: {
        maxWidth: '80%',
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        ...SHADOWS.sm,
    },
    bubbleMine: {
        backgroundColor: COLORS.primary[600],
    },
    bubbleOther: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },
    sender: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[600],
        marginBottom: 4,
    },
    msgText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[800],
    },
    msgTextMine: {
        color: '#fff',
    },
    timeText: {
        ...TYPOGRAPHY.caption,
        marginTop: 6,
        color: COLORS.neutral[500],
    },
    timeTextMine: {
        color: 'rgba(255,255,255,0.8)',
    },
    composer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingBottom: SPACING.md,
    },
    input: {
        flex: 1,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        color: COLORS.neutral[800],
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary[600],
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCard: {
        alignItems: 'center',
        gap: SPACING.sm,
    },
    emptyText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
});
