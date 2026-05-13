import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Modal,
    Alert,
    Image,
    Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { GlassCard } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import {
    Send,
    ChevronLeft,
    MoreVertical,
    Smile,
    Reply,
    Edit2,
    Trash2,
    Pin,
    Check,
    CheckCheck,
    X,
    Search,
    ChevronDown,
    ChevronUp,
    Copy,
} from 'lucide-react-native';
import { format } from 'date-fns';

const BG_GRADIENT: readonly [string, string, string] = ['#e0e7ff', '#f0f9ff', '#f8fafc'] as const;

type MessageType = 'text' | 'image' | 'audio' | 'file' | 'system';

interface Reaction {
    id: string;
    emoji: string;
    user_id: string;
}

interface ReplyInfo {
    id: string;
    content: string | null;
    type: string;
    sender_name?: string;
}

interface Message {
    id: string;
    content: string | null;
    sender_id: string;
    created_at: string;
    type: MessageType;
    media_url?: string | null;
    is_deleted?: boolean;
    is_edited?: boolean;
    is_pinned?: boolean;
    reply_to_id?: string;
    reply_to?: ReplyInfo | null;
    reactions?: Reaction[];
    sender_name?: string;
    isOptimistic?: boolean;
}

interface Participant {
    user_id: string;
    last_read_at?: string;
    profiles?: { name: string };
}

// Match web ERP reaction set
const REACTION_EMOJIS = ['✅', '👀', '❓', '🚀', '❌', '👍'];

const TEN_MINUTES = 10 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

const MESSAGE_SELECT = `
    id,
    content,
    sender_id,
    created_at,
    type,
    media_url,
    is_deleted,
    is_edited,
    is_pinned,
    reply_to_id,
    reply_to:chat_messages!chat_messages_reply_to_id_fkey(id, content, type, profiles(name)),
    profiles(name)
`;

export default function ChatRoomScreen({ navigation, route }: any) {
    const { conversationId, title } = route.params;
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [conversation, setConversation] = useState<any>(null);
    const [isTyping, setIsTyping] = useState<Record<string, boolean>>({});
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [searchIndex, setSearchIndex] = useState(0);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [showPinnedPanel, setShowPinnedPanel] = useState(false);
    const [lastMessageAt, setLastMessageAt] = useState<string | null>(null);

    const typingTimeoutRef = useRef<NodeJS.Timeout>();
    const flatListRef = useRef<FlatList>(null);
    const presenceChannelRef = useRef<any>(null);
    const lastPressRef = useRef<{ id: string; time: number } | null>(null);

    useEffect(() => {
        init();
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (presenceChannelRef.current) {
                supabase.removeChannel(presenceChannelRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (currentUserId && conversationId) {
            fetchConversation();
            fetchMessages();
            fetchParticipants();
            markAsRead();
            subscribeToMessages();
            subscribeToPresence();
        }
    }, [currentUserId, conversationId]);

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
            }, 100);
        }
    }, [messages.length]);

    const init = async () => {
        const userResult = await supabase.auth.getUser();
        const user = userResult?.data?.user;
        if (user?.id) setCurrentUserId(user.id);
    };

    const fetchConversation = async () => {
        const { data } = await supabase
            .from('chat_conversations')
            .select('*')
            .eq('id', conversationId)
            .single();
        setConversation(data);
        if (data?.last_message_at) setLastMessageAt(data.last_message_at);
    };

    const fetchParticipants = async () => {
        const { data } = await supabase
            .from('chat_participants')
            .select(`user_id, last_read_at, profiles(name)`)
            .eq('conversation_id', conversationId);
        if (data) setParticipants(data as any);
    };

    const subscribeToPresence = () => {
        const channelName = `chat-room-presence-${conversationId}`;
        const channel = supabase.channel(channelName)
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const typing: Record<string, boolean> = {};
                const online = new Set<string>();
                Object.values(state).forEach((presences: any) => {
                    presences.forEach((presence: any) => {
                        if (presence.user_id && presence.user_id !== currentUserId) {
                            online.add(presence.user_id);
                            if (presence.isTyping) {
                                typing[presence.user_id] = true;
                            }
                        }
                    });
                });
                setIsTyping(typing);
                setOnlineUsers(online);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: currentUserId,
                        isTyping: false,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        presenceChannelRef.current = channel;
    };

    const handleTyping = async () => {
        if (!presenceChannelRef.current || !currentUserId) return;
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        } else {
            await presenceChannelRef.current.track({
                user_id: currentUserId,
                isTyping: true,
                online_at: new Date().toISOString(),
            });
        }
        typingTimeoutRef.current = setTimeout(async () => {
            if (presenceChannelRef.current) {
                await presenceChannelRef.current.track({
                    user_id: currentUserId,
                    isTyping: false,
                    online_at: new Date().toISOString(),
                });
            }
            typingTimeoutRef.current = undefined;
        }, 3000);
    };

    const fetchMessages = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('chat_messages')
            .select(MESSAGE_SELECT)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            const msgs = data as any[];
            const msgIds = msgs.map((m) => m.id);

            const { data: rxData } = await supabase
                .from('chat_message_reactions')
                .select('id, emoji, user_id, message_id')
                .in('message_id', msgIds);

            const reactionsByMessage: Record<string, Reaction[]> = {};
            if (rxData) {
                rxData.forEach((r: any) => {
                    if (!reactionsByMessage[r.message_id]) reactionsByMessage[r.message_id] = [];
                    reactionsByMessage[r.message_id].push(r);
                });
            }

            setMessages(msgs.map((m) => ({
                ...m,
                reactions: reactionsByMessage[m.id] || [],
                sender_name: m.profiles?.name || 'Unknown',
                reply_to: m.reply_to ? {
                    id: m.reply_to.id,
                    content: m.reply_to.content,
                    type: m.reply_to.type,
                    sender_name: m.reply_to.profiles?.name,
                } : null,
            })));
        }
        setLoading(false);
    };

    const subscribeToMessages = () => {
        const channel = supabase
            .channel(`chat:${conversationId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_messages',
                filter: `conversation_id=eq.${conversationId}`,
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    fetchNewMessage(payload.new.id);
                } else if (payload.eventType === 'UPDATE') {
                    setMessages((prev) => prev.map((m) =>
                        m.id === payload.new.id ? { ...m, ...payload.new } : m
                    ));
                } else if (payload.eventType === 'DELETE') {
                    setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
                }
            })
            .subscribe();
    };

    const fetchNewMessage = async (messageId: string) => {
        const { data } = await supabase
            .from('chat_messages')
            .select(MESSAGE_SELECT)
            .eq('id', messageId)
            .single();

        if (data) {
            const msg = data as any;
            setMessages((prev) => {
                // Remove optimistic version (same content + sender), replace with real
                const filtered = prev.filter((m) =>
                    !(m.isOptimistic && m.content === msg.content && m.sender_id === msg.sender_id)
                );
                if (filtered.some((m) => m.id === msg.id)) return filtered;
                return [...filtered, {
                    ...msg,
                    reactions: [],
                    sender_name: msg.profiles?.name || 'Unknown',
                    reply_to: msg.reply_to ? {
                        id: msg.reply_to.id,
                        content: msg.reply_to.content,
                        type: msg.reply_to.type,
                        sender_name: msg.reply_to.profiles?.name,
                    } : null,
                }];
            });
        }
    };

    const markAsRead = async () => {
        if (!currentUserId || !conversationId) return;
        const now = new Date().toISOString();
        await supabase
            .from('chat_participants')
            .update({ last_read_at: now, unread_count: 0 })
            .eq('conversation_id', conversationId)
            .eq('user_id', currentUserId);
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || !currentUserId) return;

        const messageData: any = {
            conversation_id: conversationId,
            content: text,
            sender_id: currentUserId,
            type: 'text',
        };

        if (replyingTo) {
            messageData.reply_to_id = replyingTo.id;
        }

        // Optimistic update
        const optimisticId = `opt-${Date.now()}`;
        const optimisticMsg: Message = {
            id: optimisticId,
            content: text,
            sender_id: currentUserId,
            created_at: new Date().toISOString(),
            type: 'text',
            reactions: [],
            sender_name: 'Me',
            isOptimistic: true,
            reply_to: replyingTo ? {
                id: replyingTo.id,
                content: replyingTo.content,
                type: replyingTo.type,
                sender_name: replyingTo.sender_name,
            } : null,
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        setInput('');
        setReplyingTo(null);

        try {
            const { error } = await supabase
                .from('chat_messages')
                .insert(messageData);
            if (error) {
                // Remove optimistic message on error
                setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
                Alert.alert('Error', 'Failed to send message');
            }
        } catch {
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            Alert.alert('Error', 'Failed to send message');
        }
    };

    const handleReaction = async (messageId: string, emoji: string) => {
        if (!currentUserId) return;
        const message = messages.find((m) => m.id === messageId);
        const existing = message?.reactions?.find((r) => r.user_id === currentUserId && r.emoji === emoji);

        if (existing) {
            await supabase.from('chat_message_reactions').delete().eq('id', existing.id);
        } else {
            await supabase.from('chat_message_reactions').insert({
                message_id: messageId,
                user_id: currentUserId,
                emoji,
            });
        }

        const { data: rxData } = await supabase
            .from('chat_message_reactions')
            .select('*')
            .eq('message_id', messageId);

        setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, reactions: rxData || [] } : m))
        );
    };

    const handleEdit = async (messageId: string, newContent: string) => {
        await supabase
            .from('chat_messages')
            .update({
                content: newContent,
                is_edited: true,
                edited_at: new Date().toISOString(),
            })
            .eq('id', messageId);
        setEditingMessage(null);
        setInput('');
    };

    const handleDelete = async (message: Message) => {
        const age = Date.now() - new Date(message.created_at).getTime();
        const canHardDelete = age < TEN_MINUTES;

        Alert.alert(
            canHardDelete ? 'Delete Message' : 'Remove Message',
            canHardDelete
                ? 'This message will be permanently deleted.'
                : 'This message will be marked as removed.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: canHardDelete ? 'Delete' : 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        if (canHardDelete) {
                            await supabase.from('chat_messages').delete().eq('id', message.id);
                        } else {
                            await supabase
                                .from('chat_messages')
                                .update({ is_deleted: true, content: null })
                                .eq('id', message.id);
                        }
                    },
                },
            ]
        );
    };

    const handlePin = async (messageId: string, isPinned: boolean) => {
        await supabase
            .from('chat_messages')
            .update({ is_pinned: !isPinned })
            .eq('id', messageId);
        setMessages((prev) =>
            prev.map((m) => m.id === messageId ? { ...m, is_pinned: !isPinned } : m)
        );
    };

    const handleShare = async (content: string) => {
        try {
            await Share.share({ message: content });
        } catch {
            // ignore
        }
    };

    const handleDoubleTap = (message: Message) => {
        const now = Date.now();
        const last = lastPressRef.current;
        if (last && last.id === message.id && now - last.time < 400) {
            lastPressRef.current = null;
            handleReaction(message.id, '👍');
        } else {
            lastPressRef.current = { id: message.id, time: now };
        }
    };

    const getMessageStatus = (message: Message) => {
        if (message.sender_id !== currentUserId) return null;
        if (message.isOptimistic) return 'sent';
        const others = participants.filter((p) => p.user_id !== currentUserId);
        if (others.length === 0) return 'sent';
        const allRead = others.every((p) =>
            p.last_read_at && new Date(p.last_read_at) >= new Date(message.created_at)
        );
        return allRead ? 'read' : 'sent';
    };

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        const lower = query.toLowerCase();
        const found = messages
            .filter((m) => !m.is_deleted && m.content?.toLowerCase().includes(lower))
            .map((m) => m.id);
        setSearchResults(found);
        setSearchIndex(0);
    };

    const navigateSearch = (dir: 1 | -1) => {
        if (searchResults.length === 0) return;
        const newIdx = (searchIndex + dir + searchResults.length) % searchResults.length;
        setSearchIndex(newIdx);
    };

    const pinnedMessages = messages.filter((m) => m.is_pinned && !m.is_deleted);

    const otherParticipant = conversation?.type !== 'group'
        ? participants.find((p) => p.user_id !== currentUserId)
        : null;
    const isOtherOnline = otherParticipant ? onlineUsers.has(otherParticipant.user_id) : false;

    const typingUsers = Object.keys(isTyping).filter((id) => isTyping[id]);
    const typingText = typingUsers.length > 0
        ? `${typingUsers.length === 1 ? 'Someone' : `${typingUsers.length} people`} typing...`
        : '';

    const getHeaderSubtitle = () => {
        if (typingText) return null; // handled separately
        if (conversation?.type === 'group') return `${participants.length} members`;
        if (isOtherOnline) return 'Online';
        if (lastMessageAt) return `Last seen ${format(new Date(lastMessageAt), 'hh:mm a')}`;
        return 'Offline';
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMine = item.sender_id === currentUserId;
        const status = getMessageStatus(item);
        const isSearchMatch = searchResults.includes(item.id);
        const isCurrentResult = searchResults[searchIndex] === item.id;

        if (item.is_deleted) {
            return (
                <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : null]}>
                    <View style={[styles.bubble, styles.deletedBubble]}>
                        <Text style={styles.deletedText}>This message was removed</Text>
                    </View>
                </View>
            );
        }

        return (
            <TouchableOpacity
                style={[
                    styles.bubbleRow,
                    isMine ? styles.bubbleRowMine : null,
                    isCurrentResult && styles.highlightedRow,
                    isSearchMatch && !isCurrentResult && styles.searchMatchRow,
                ]}
                onPress={() => handleDoubleTap(item)}
                onLongPress={() => { setSelectedMessage(item); }}
                activeOpacity={0.85}
            >
                <View style={[
                    styles.bubble,
                    isMine ? styles.bubbleMine : styles.bubbleOther,
                    item.isOptimistic && styles.bubbleOptimistic,
                ]}>
                    {/* Pin indicator */}
                    {item.is_pinned && (
                        <Pin size={10} color={isMine ? 'rgba(255,255,255,0.5)' : COLORS.primary[400]} style={styles.pinIndicator} />
                    )}

                    {/* Reply preview */}
                    {item.reply_to && (
                        <View style={[styles.replyPreview, isMine ? styles.replyPreviewMine : null]}>
                            <Text style={styles.replyName}>{item.reply_to.sender_name}</Text>
                            <Text style={styles.replyContent} numberOfLines={1}>
                                {item.reply_to.content}
                            </Text>
                        </View>
                    )}

                    {/* Sender name for others */}
                    {!isMine && (
                        <Text style={styles.senderName}>{item.sender_name}</Text>
                    )}

                    {/* Text content */}
                    {item.type === 'text' && (
                        <Text style={[styles.msgText, isMine ? styles.msgTextMine : null]}>
                            {item.content}
                        </Text>
                    )}

                    {/* Image content */}
                    {item.type === 'image' && item.media_url && (
                        <Image
                            source={{ uri: item.media_url }}
                            style={styles.messageImage}
                            resizeMode="cover"
                        />
                    )}

                    {/* File content */}
                    {item.type === 'file' && (
                        <View style={styles.fileCard}>
                            <Text style={[styles.fileName, isMine ? styles.fileNameMine : null]} numberOfLines={1}>
                                {item.content}
                            </Text>
                            <Text style={[styles.fileType, isMine ? styles.fileTypeMine : null]}>
                                DOCUMENT
                            </Text>
                        </View>
                    )}

                    {/* Audio content */}
                    {item.type === 'audio' && (
                        <View style={styles.audioCard}>
                            <Text style={[styles.audioLabel, isMine ? styles.audioLabelMine : null]}>
                                🎤 Voice Message
                            </Text>
                        </View>
                    )}

                    {/* Edited indicator */}
                    {item.is_edited && (
                        <Text style={[styles.editedText, isMine ? styles.editedTextMine : null]}>
                            edited
                        </Text>
                    )}

                    {/* Time and status */}
                    <View style={styles.messageFooter}>
                        <Text style={[styles.timeText, isMine ? styles.timeTextMine : null]}>
                            {format(new Date(item.created_at), 'hh:mm a')}
                        </Text>
                        {isMine && status && (
                            status === 'read' ? (
                                <CheckCheck size={14} color={isMine ? 'rgba(255,255,255,0.8)' : COLORS.primary[500]} />
                            ) : (
                                <Check size={14} color="rgba(255,255,255,0.5)" />
                            )
                        )}
                    </View>

                    {/* Reactions */}
                    {item.reactions && item.reactions.length > 0 && (
                        <View style={styles.reactionsRow}>
                            {groupReactions(item.reactions).map(({ emoji, count, reacted }) => (
                                <TouchableOpacity
                                    key={emoji}
                                    style={[styles.reactionBadge, reacted && styles.reactionBadgeMine]}
                                    onPress={() => handleReaction(item.id, emoji)}
                                >
                                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                                    {count > 1 && (
                                        <Text style={[styles.reactionCount, reacted && styles.reactionCountMine]}>
                                            {count}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    // Group reactions by emoji
    const groupReactions = (reactions: Reaction[]) => {
        const map: Record<string, { count: number; reacted: boolean }> = {};
        reactions.forEach((r) => {
            if (!map[r.emoji]) map[r.emoji] = { count: 0, reacted: false };
            map[r.emoji].count += 1;
            if (r.user_id === currentUserId) map[r.emoji].reacted = true;
        });
        return Object.entries(map).map(([emoji, { count, reacted }]) => ({ emoji, count, reacted }));
    };

    const canEditMessage = (message: Message) => {
        if (message.sender_id !== currentUserId) return false;
        if (message.type !== 'text') return false;
        const age = Date.now() - new Date(message.created_at).getTime();
        return age < FIFTEEN_MINUTES;
    };

    const getEditTimeLeft = (message: Message) => {
        const age = Date.now() - new Date(message.created_at).getTime();
        return Math.ceil((FIFTEEN_MINUTES - age) / 60000);
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={BG_GRADIENT} style={styles.background} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={COLORS.neutral[700]} />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {title || 'Chat'}
                    </Text>
                    {typingText ? (
                        <Text style={styles.typingText}>{typingText}</Text>
                    ) : (
                        <Text style={[
                            styles.headerSubtitle,
                            isOtherOnline && conversation?.type !== 'group' && styles.onlineText,
                        ]}>
                            {getHeaderSubtitle()}
                        </Text>
                    )}
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={() => setShowSearch(!showSearch)} style={styles.headerBtn}>
                        <Search size={20} color={COLORS.neutral[600]} />
                    </TouchableOpacity>
                    {pinnedMessages.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setShowPinnedPanel((p) => !p)}
                            style={styles.headerBtn}
                        >
                            <Pin size={20} color={COLORS.primary[600]} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Search Bar */}
            {showSearch && (
                <View style={styles.searchBar}>
                    <Search size={16} color={COLORS.neutral[400]} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search messages..."
                        placeholderTextColor={COLORS.neutral[400]}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        autoFocus
                    />
                    {searchQuery && searchResults.length > 0 && (
                        <View style={styles.searchNav}>
                            <Text style={styles.searchCount}>
                                {searchIndex + 1}/{searchResults.length}
                            </Text>
                            <TouchableOpacity onPress={() => navigateSearch(-1)}>
                                <ChevronUp size={18} color={COLORS.neutral[600]} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigateSearch(1)}>
                                <ChevronDown size={18} color={COLORS.neutral[600]} />
                            </TouchableOpacity>
                        </View>
                    )}
                    <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
                        <X size={20} color={COLORS.neutral[500]} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Pinned Messages Panel */}
            {pinnedMessages.length > 0 && (
                <TouchableOpacity
                    style={styles.pinnedBar}
                    onPress={() => setShowPinnedPanel((p) => !p)}
                    activeOpacity={0.85}
                >
                    <Pin size={12} color={COLORS.primary[600]} />
                    <Text style={styles.pinnedBarText} numberOfLines={1}>
                        {pinnedMessages.length === 1
                            ? pinnedMessages[0].content?.slice(0, 60) || 'Pinned message'
                            : `${pinnedMessages.length} pinned messages`}
                    </Text>
                    {showPinnedPanel
                        ? <ChevronUp size={14} color={COLORS.neutral[500]} />
                        : <ChevronDown size={14} color={COLORS.neutral[500]} />
                    }
                </TouchableOpacity>
            )}

            {/* Pinned Panel Expanded */}
            {showPinnedPanel && pinnedMessages.length > 0 && (
                <View style={styles.pinnedPanel}>
                    {pinnedMessages.map((pm) => (
                        <View key={pm.id} style={styles.pinnedItem}>
                            <View style={styles.pinnedItemContent}>
                                <Text style={styles.pinnedSender}>{pm.sender_name}</Text>
                                <Text style={styles.pinnedContent} numberOfLines={2}>
                                    {pm.content}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => { handlePin(pm.id, true); }}
                                style={styles.unpinBtn}
                            >
                                <X size={14} color={COLORS.neutral[500]} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            {/* Messages */}
            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={COLORS.primary[600]} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={renderMessage}
                    ListEmptyComponent={
                        <GlassCard style={styles.emptyCard}>
                            <Text style={styles.emptyText}>No messages yet</Text>
                            <Text style={styles.emptySub}>Start the conversation!</Text>
                        </GlassCard>
                    }
                />
            )}

            {/* Edit mode bar */}
            {editingMessage && (
                <View style={styles.editBar}>
                    <Edit2 size={14} color={COLORS.warning[600]} />
                    <Text style={styles.editBarText} numberOfLines={1}>
                        Editing message
                    </Text>
                    <TouchableOpacity onPress={() => { setEditingMessage(null); setInput(''); }}>
                        <X size={18} color={COLORS.neutral[500]} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Reply preview */}
            {replyingTo && !editingMessage && (
                <View style={styles.replyBar}>
                    <Reply size={14} color={COLORS.primary[600]} />
                    <View style={styles.replyBarContent}>
                        <Text style={styles.replyBarName}>{replyingTo.sender_name}</Text>
                        <Text style={styles.replyBarText} numberOfLines={1}>
                            {replyingTo.content}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => setReplyingTo(null)}>
                        <X size={18} color={COLORS.neutral[500]} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Input */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.composer}>
                    <TouchableOpacity
                        style={styles.emojiBtn}
                        onPress={() => setShowEmojiPicker(true)}
                    >
                        <Smile size={24} color={COLORS.neutral[500]} />
                    </TouchableOpacity>

                    <TextInput
                        style={styles.input}
                        value={input}
                        onChangeText={(text) => {
                            setInput(text);
                            handleTyping();
                        }}
                        placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
                        placeholderTextColor={COLORS.neutral[400]}
                        multiline
                        maxLength={1000}
                    />

                    <TouchableOpacity
                        style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                        onPress={editingMessage
                            ? () => handleEdit(editingMessage.id, input)
                            : sendMessage}
                        disabled={!input.trim()}
                    >
                        <Send size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Message Actions Modal */}
            <Modal
                visible={!!selectedMessage}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedMessage(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />

                        {/* Quick Reactions */}
                        <View style={styles.reactionsRowLarge}>
                            {REACTION_EMOJIS.map((emoji) => (
                                <TouchableOpacity
                                    key={emoji}
                                    style={styles.reactionBtn}
                                    onPress={() => {
                                        handleReaction(selectedMessage!.id, emoji);
                                        setSelectedMessage(null);
                                    }}
                                >
                                    <Text style={styles.reactionEmojiLarge}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.actionButtons}>
                            {/* Reply */}
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => {
                                    setReplyingTo(selectedMessage);
                                    setSelectedMessage(null);
                                }}
                            >
                                <Reply size={20} color={COLORS.primary[600]} />
                                <Text style={styles.actionText}>Reply</Text>
                            </TouchableOpacity>

                            {/* Copy */}
                            {selectedMessage?.type === 'text' && selectedMessage?.content && (
                                <TouchableOpacity
                                    style={styles.actionBtn}
                                    onPress={() => {
                                        handleShare(selectedMessage.content || '');
                                        setSelectedMessage(null);
                                    }}
                                >
                                    <Copy size={20} color={COLORS.neutral[600]} />
                                    <Text style={styles.actionText}>Copy / Share</Text>
                                </TouchableOpacity>
                            )}

                            {/* Edit (15-min window) */}
                            {selectedMessage && canEditMessage(selectedMessage) && (
                                <TouchableOpacity
                                    style={styles.actionBtn}
                                    onPress={() => {
                                        setEditingMessage(selectedMessage);
                                        setInput(selectedMessage?.content || '');
                                        setSelectedMessage(null);
                                    }}
                                >
                                    <Edit2 size={20} color={COLORS.warning[600]} />
                                    <Text style={styles.actionText}>
                                        Edit{' '}
                                        <Text style={styles.actionSubtext}>
                                            ({getEditTimeLeft(selectedMessage!)}m left)
                                        </Text>
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* Pin/Unpin */}
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => {
                                    handlePin(selectedMessage!.id, selectedMessage!.is_pinned || false);
                                    setSelectedMessage(null);
                                }}
                            >
                                <Pin size={20} color={COLORS.success[600]} />
                                <Text style={styles.actionText}>
                                    {selectedMessage?.is_pinned ? 'Unpin' : 'Pin'}
                                </Text>
                            </TouchableOpacity>

                            {/* Delete (own messages only) */}
                            {selectedMessage?.sender_id === currentUserId && !selectedMessage?.is_deleted && (
                                <TouchableOpacity
                                    style={styles.actionBtn}
                                    onPress={() => {
                                        handleDelete(selectedMessage!);
                                        setSelectedMessage(null);
                                    }}
                                >
                                    <Trash2 size={20} color={COLORS.error[600]} />
                                    <Text style={[styles.actionText, styles.deleteText]}>
                                        {Date.now() - new Date(selectedMessage.created_at).getTime() < TEN_MINUTES
                                            ? 'Delete'
                                            : 'Remove'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={() => setSelectedMessage(null)}
                        >
                            <Text style={styles.closeText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Emoji Picker Modal */}
            <Modal
                visible={showEmojiPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowEmojiPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.emojiPickerContent}>
                        <View style={styles.modalHandle} />
                        <View style={styles.reactionsRowLarge}>
                            {REACTION_EMOJIS.map((emoji) => (
                                <TouchableOpacity
                                    key={emoji}
                                    style={styles.reactionBtn}
                                    onPress={() => {
                                        setInput((prev) => prev + emoji);
                                        setShowEmojiPicker(false);
                                    }}
                                >
                                    <Text style={styles.reactionEmojiLarge}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[200],
        ...SHADOWS.sm,
    },
    backBtn: {
        padding: SPACING.sm,
    },
    headerCenter: {
        flex: 1,
        marginHorizontal: SPACING.md,
    },
    headerTitle: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[900],
    },
    headerSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
    },
    onlineText: {
        color: COLORS.success[600],
        fontWeight: '600',
    },
    typingText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.primary[600],
        fontWeight: '600',
    },
    headerActions: {
        flexDirection: 'row',
        gap: SPACING.xs,
    },
    headerBtn: {
        padding: SPACING.sm,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.neutral[200],
        gap: SPACING.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: COLORS.neutral[800],
    },
    searchNav: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    searchCount: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        minWidth: 36,
        textAlign: 'right',
    },
    pinnedBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        backgroundColor: COLORS.primary[50],
        borderBottomWidth: 1,
        borderBottomColor: COLORS.primary[100],
    },
    pinnedBarText: {
        flex: 1,
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[700],
    },
    pinnedPanel: {
        backgroundColor: COLORS.primary[25] || '#f8f8ff',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.primary[100],
        maxHeight: 160,
    },
    pinnedItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.primary[50],
    },
    pinnedItemContent: {
        flex: 1,
    },
    pinnedSender: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[600],
        marginBottom: 2,
    },
    pinnedContent: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[700],
    },
    unpinBtn: {
        padding: SPACING.xs,
        marginLeft: SPACING.sm,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: SPACING.md,
        paddingBottom: SPACING.xxl,
    },
    bubbleRow: {
        flexDirection: 'row',
        marginBottom: SPACING.sm,
    },
    bubbleRowMine: {
        justifyContent: 'flex-end',
    },
    highlightedRow: {
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: `${COLORS.primary[100]}60`,
    },
    searchMatchRow: {
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: `${COLORS.primary[50]}80`,
    },
    bubble: {
        maxWidth: '78%',
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
    bubbleOptimistic: {
        opacity: 0.75,
    },
    deletedBubble: {
        backgroundColor: COLORS.neutral[100],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        borderStyle: 'dashed',
    },
    deletedText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        fontStyle: 'italic',
    },
    pinIndicator: {
        position: 'absolute',
        top: 6,
        right: 6,
    },
    replyPreview: {
        backgroundColor: 'rgba(0,0,0,0.06)',
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.sm,
        marginBottom: SPACING.xs,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary[300],
    },
    replyPreviewMine: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderLeftColor: 'rgba(255,255,255,0.5)',
    },
    replyName: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[500],
        marginBottom: 2,
    },
    replyContent: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
    },
    senderName: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[600],
        marginBottom: 2,
    },
    msgText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[800],
        lineHeight: 20,
    },
    msgTextMine: {
        color: '#fff',
    },
    messageImage: {
        width: 220,
        height: 160,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.xs,
    },
    fileCard: {
        paddingVertical: SPACING.xs,
    },
    fileName: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
    },
    fileNameMine: {
        color: '#fff',
    },
    fileType: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    fileTypeMine: {
        color: 'rgba(255,255,255,0.6)',
    },
    audioCard: {
        paddingVertical: SPACING.xs,
    },
    audioLabel: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[700],
    },
    audioLabelMine: {
        color: '#fff',
    },
    editedText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        fontSize: 10,
        fontStyle: 'italic',
        marginTop: 2,
    },
    editedTextMine: {
        color: 'rgba(255,255,255,0.6)',
    },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        justifyContent: 'flex-end',
    },
    timeText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        fontSize: 10,
    },
    timeTextMine: {
        color: 'rgba(255,255,255,0.7)',
    },
    reactionsRow: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 6,
        flexWrap: 'wrap',
    },
    reactionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.06)',
        borderRadius: 12,
        paddingHorizontal: 7,
        paddingVertical: 3,
        gap: 3,
    },
    reactionBadgeMine: {
        backgroundColor: COLORS.primary[100],
        borderWidth: 1,
        borderColor: COLORS.primary[300],
    },
    reactionEmoji: {
        fontSize: 13,
    },
    reactionCount: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.neutral[600],
    },
    reactionCountMine: {
        color: COLORS.primary[700],
    },
    emptyCard: {
        margin: SPACING.xl,
        padding: SPACING.xxl,
        alignItems: 'center',
    },
    emptyText: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[600],
    },
    emptySub: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[500],
        marginTop: SPACING.xs,
    },
    editBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fffbeb',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.warning[200],
        gap: SPACING.sm,
    },
    editBarText: {
        flex: 1,
        ...TYPOGRAPHY.captionBold,
        color: COLORS.warning[700],
    },
    replyBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary[50],
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.primary[100],
        gap: SPACING.sm,
    },
    replyBarContent: {
        flex: 1,
    },
    replyBarName: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.primary[600],
    },
    replyBarText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
    },
    composer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.neutral[200],
        gap: SPACING.sm,
        ...SHADOWS.sm,
    },
    emojiBtn: {
        padding: SPACING.xs,
    },
    input: {
        flex: 1,
        maxHeight: 100,
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        fontSize: 16,
        color: COLORS.neutral[800],
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary[600],
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: COLORS.neutral[300],
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: BORDER_RADIUS.xxl,
        borderTopRightRadius: BORDER_RADIUS.xxl,
        padding: SPACING.xl,
        paddingBottom: 40,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: COLORS.neutral[300],
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: SPACING.lg,
    },
    reactionsRowLarge: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    reactionBtn: {
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.round,
        backgroundColor: COLORS.neutral[50],
    },
    reactionEmojiLarge: {
        fontSize: 26,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.neutral[200],
        marginVertical: SPACING.sm,
    },
    actionButtons: {
        gap: 2,
        marginBottom: SPACING.md,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
    },
    actionText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[700],
    },
    actionSubtext: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[400],
    },
    deleteText: {
        color: COLORS.error[600],
    },
    closeBtn: {
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.neutral[200],
        marginTop: SPACING.xs,
    },
    closeText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[500],
    },
    emojiPickerContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: BORDER_RADIUS.xxl,
        borderTopRightRadius: BORDER_RADIUS.xxl,
        padding: SPACING.xl,
        paddingBottom: 40,
    },
});
