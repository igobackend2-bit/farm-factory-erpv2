import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Link,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Calendar, X, ExternalLink, PriorityHigh } from 'lucide-react-native';
import { format, parseISO, formatDistanceToNow, isToday, isTomorrow, isYesterday } from 'date-fns';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { announcementService, Announcement } from '../../services/commService';

interface AnnouncementsScreenProps {
  navigation: any;
}

export default function AnnouncementsScreen({ navigation }: AnnouncementsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    const data = await announcementService.getActive();
    setAnnouncements(data);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnnouncements();
    setRefreshing(false);
  };

  const handleRead = async (announcement: Announcement) => {
    if (!announcement.has_read) {
      await announcementService.markAsRead(announcement.id!);
      loadAnnouncements();
    }
    setSelectedAnnouncement(announcement);
  };

  const formatDate = (dateStr: string): string => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  const getPriorityColor = (priority?: string): string => {
    switch (priority) {
      case 'urgent': return '#dc2626';
      case 'high': return '#f59e0b';
      case 'normal': return COLORS.primary[600];
      case 'low': return COLORS.neutral[500];
      default: return COLORS.primary[600];
    }
  };

  const getCategoryIcon = (category?: string): string => {
    switch (category) {
      case 'hr': return 'Users';
      case 'it': return 'Monitor';
      case 'finance': return 'DollarSign';
      case 'operations': return 'Settings';
      case 'safety': return 'Shield';
      default: return 'Bell';
    }
  };

  const unreadCount = announcements.filter(a => !a.has_read).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary[600]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={COLORS.neutral[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Announcements</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {announcements.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Bell size={64} color={COLORS.neutral[300]} />
            <Text style={styles.emptyText}>No announcements</Text>
            <Text style={styles.emptySubtext}>Check back later for updates</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {announcements.map((announcement, index) => (
              <TouchableOpacity
                key={announcement.id}
                style={[
                  styles.card,
                  !announcement.has_read && styles.unreadCard,
                ]}
                onPress={() => handleRead(announcement)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    {!announcement.has_read && (
                      <View style={styles.unreadDot} />
                    )}
                    <View>
                      <Text style={[
                        styles.cardTitle,
                        !announcement.has_read && styles.unreadTitle,
                      ]}>
                        {announcement.title}
                      </Text>
                      <Text style={styles.cardDate}>
                        {formatDate(announcement.created_at!)}
                      </Text>
                    </View>
                  </View>
                  {announcement.priority === 'urgent' && (
                    <View style={[styles.priorityBadge, { backgroundColor: '#fef2f2' }]}>
                      <PriorityHigh size={14} color="#dc2626" />
                      <Text style={styles.priorityText}>Urgent</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardPreview} numberOfLines={2}>
                  {announcement.content}
                </Text>
                <View style={styles.cardFooter}>
                  <View style={[styles.categoryBadge, { backgroundColor: COLORS.neutral[100] }]}>
                    <Text style={styles.categoryText}>
                      {announcement.category || 'General'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!selectedAnnouncement}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedAnnouncement(null)}
      >
        {selectedAnnouncement && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => setSelectedAnnouncement(null)}
                style={styles.closeButton}
              >
                <X size={24} color={COLORS.neutral[800]} />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Details</Text>
              <View style={{ width: 40 }} />
            </View>
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalContentInner}>
                {selectedAnnouncement.priority === 'urgent' && (
                  <View style={[styles.urgentBanner, { backgroundColor: '#fef2f2' }]}>
                    <PriorityHigh size={16} color="#dc2626" />
                    <Text style={styles.urgentText}>Urgent Announcement</Text>
                  </View>
                )}
                <Text style={styles.modalTitle}>
                  {selectedAnnouncement.title}
                </Text>
                <View style={styles.modalMeta}>
                  <Calendar size={14} color={COLORS.neutral[500]} />
                  <Text style={styles.modalMetaText}>
                    {format(parseISO(selectedAnnouncement.created_at!), 'MMMM d, yyyy')}
                  </Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.modalBodyText}>
                    {selectedAnnouncement.content}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
    backgroundColor: '#fff',
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.neutral[800],
  },
  badge: {
    backgroundColor: COLORS.primary[600],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  list: {
    padding: SPACING.md,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
  },
  unreadCard: {
    borderColor: COLORS.primary[300],
    backgroundColor: COLORS.primary[50],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary[600],
    marginTop: 6,
    marginRight: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.neutral[800],
  },
  unreadTitle: {
    color: COLORS.primary[700],
  },
  cardDate: {
    fontSize: 12,
    color: COLORS.neutral[500],
    marginTop: 2,
  },
  cardPreview: {
    fontSize: 14,
    color: COLORS.neutral[600],
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.neutral[600],
    textTransform: 'capitalize',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.neutral[600],
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.neutral[500],
    marginTop: SPACING.xs,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
    backgroundColor: '#fff',
  },
  closeButton: {
    padding: SPACING.xs,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.neutral[800],
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: SPACING.md,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  urgentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.neutral[800],
    marginBottom: SPACING.md,
  },
  modalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  modalMetaText: {
    fontSize: 14,
    color: COLORS.neutral[500],
  },
  modalBody: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  modalBodyText: {
    fontSize: 16,
    color: COLORS.neutral[700],
    lineHeight: 24,
  },
});