import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMySOPs, SOP } from '../../hooks/useMySOPs';
import { GlassCard, Button } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { ChevronLeft, FileText, AlertCircle, CheckCircle, Eye, Download } from 'lucide-react-native';
import { format } from 'date-fns';

const BG_GRADIENT: [string, string, ...string[]] = ['#e0e7ff', '#f0f9ff', '#f8fafc'];
const HEADER_GRADIENT: [string, string, ...string[]] = ['#3b82f6', '#1d4ed8'];

interface DetailModalState {
  visible: boolean;
  sop: SOP | null;
}

export default function MySOPsScreen() {
  const { sops, isLoading, error, refreshing, onRefresh, markAsAcknowledged } = useMySOPs();
  const [detailModal, setDetailModal] = useState<DetailModalState>({ visible: false, sop: null });
  const [acknowledging, setAcknowledging] = useState(false);

  const handleOpenDetail = (sop: SOP) => {
    setDetailModal({ visible: true, sop });
  };

  const handleCloseDetail = () => {
    setDetailModal({ visible: false, sop: null });
  };

  const handleAcknowledge = async (sop: SOP) => {
    if (!sop.assignment?.id) {
      Alert.alert('Error', 'Assignment ID not found');
      return;
    }

    setAcknowledging(true);
    const result = await markAsAcknowledged(sop.assignment.id);
    setAcknowledging(false);

    if (result.success) {
      Alert.alert('Success', 'SOP marked as acknowledged');
      handleCloseDetail();
    } else {
      Alert.alert('Error', result.error || 'Failed to acknowledge SOP');
    }
  };

  const getSOPStatus = (sop: SOP) => {
    if (!sop.assignment?.acknowledged_at) {
      return { label: 'New', color: COLORS.warning[600] };
    }
    return { label: 'Read', color: COLORS.success[600] };
  };

  const groupedSOPs = sops.reduce((acc, sop) => {
    const category = sop.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(sop);
    return acc;
  }, {} as Record<string, SOP[]>);

  const renderSOPCard = ({ item: sop }: { item: SOP }) => {
    const status = getSOPStatus(sop);

    return (
      <GlassCard style={styles.sopCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitle}>
            <FileText size={20} color={COLORS.primary[600]} />
            <View style={styles.titleContainer}>
              <Text style={styles.sopName} numberOfLines={2}>{sop.name}</Text>
              {sop.code && <Text style={styles.sopCode}>{sop.code}</Text>}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
            <Text style={styles.statusLabel}>{status.label}</Text>
          </View>
        </View>

        {sop.description && (
          <Text style={styles.description} numberOfLines={2}>{sop.description}</Text>
        )}

        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>v{sop.version}</Text>
          <Text style={styles.metaText}>
            Assigned {format(new Date(sop.assignment?.assigned_at || sop.created_at), 'MMM d')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => handleOpenDetail(sop)}
        >
          <Eye size={16} color={COLORS.primary[600]} />
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>
      </GlassCard>
    );
  };

  if (isLoading) {
    return (
      <LinearGradient colors={BG_GRADIENT} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary[600]} />
          <Text style={styles.loadingText}>Loading SOPs...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={BG_GRADIENT} style={styles.container}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={COLORS.danger[600]} />
          <Text style={styles.errorText}>{error}</Text>
          <Button
            label="Retry"
            onPress={onRefresh}
            style={styles.retryButton}
          />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={BG_GRADIENT} style={styles.container}>
      {/* Header */}
      <LinearGradient colors={HEADER_GRADIENT} style={styles.header}>
        <Text style={styles.headerTitle}>Standard Operating Procedures</Text>
        <Text style={styles.headerSubtitle}>{sops.length} SOP{sops.length !== 1 ? 's' : ''} assigned</Text>
      </LinearGradient>

      {sops.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FileText size={48} color={COLORS.neutral[400]} />
          <Text style={styles.emptyTitle}>No SOPs Assigned</Text>
          <Text style={styles.emptyText}>You don't have any SOPs assigned yet.</Text>
        </View>
      ) : (
        <FlatList
          data={sops}
          renderItem={renderSOPCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary[600]]}
            />
          }
          scrollEnabled={false}
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={detailModal.visible}
        animationType="slide"
        onRequestClose={handleCloseDetail}
        presentationStyle="pageSheet"
      >
        {detailModal.sop && (
          <View style={styles.detailContainer}>
            <LinearGradient colors={HEADER_GRADIENT} style={styles.detailHeader}>
              <TouchableOpacity onPress={handleCloseDetail}>
                <ChevronLeft size={28} color={COLORS.neutral[50]} />
              </TouchableOpacity>
              <Text style={styles.detailHeaderTitle}>{detailModal.sop.name}</Text>
              <View style={{ width: 28 }} />
            </LinearGradient>

            <ScrollView
              style={styles.detailContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Status Badge */}
              {detailModal.sop.assignment?.acknowledged_at && (
                <View style={styles.acknowledgedBanner}>
                  <CheckCircle size={20} color={COLORS.success[600]} />
                  <Text style={styles.acknowledgedText}>
                    Acknowledged on {format(
                      new Date(detailModal.sop.assignment.acknowledged_at),
                      'PPP'
                    )}
                  </Text>
                </View>
              )}

              {/* SOP Details */}
              <GlassCard style={styles.detailCard}>
                {detailModal.sop.code && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Code</Text>
                    <Text style={styles.detailValue}>{detailModal.sop.code}</Text>
                  </View>
                )}

                {detailModal.sop.category && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>{detailModal.sop.category}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Version</Text>
                  <Text style={styles.detailValue}>v{detailModal.sop.version}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Updated</Text>
                  <Text style={styles.detailValue}>
                    {format(new Date(detailModal.sop.updated_at), 'PPP')}
                  </Text>
                </View>
              </GlassCard>

              {/* Description */}
              {detailModal.sop.description && (
                <GlassCard style={styles.detailCard}>
                  <Text style={styles.sectionTitle}>Description</Text>
                  <Text style={styles.descriptionText}>{detailModal.sop.description}</Text>
                </GlassCard>
              )}

              {/* Content */}
              <GlassCard style={styles.detailCard}>
                <Text style={styles.sectionTitle}>Procedures</Text>
                <Text style={styles.contentText}>{detailModal.sop.content}</Text>
              </GlassCard>

              {/* Attachment */}
              {detailModal.sop.attachment_url && (
                <GlassCard style={styles.detailCard}>
                  <TouchableOpacity style={styles.attachmentButton}>
                    <Download size={20} color={COLORS.primary[600]} />
                    <Text style={styles.attachmentText}>Download PDF</Text>
                  </TouchableOpacity>
                </GlassCard>
              )}

              <View style={styles.detailFooterSpacer} />
            </ScrollView>

            {/* Action Button */}
            {!detailModal.sop.assignment?.acknowledged_at && (
              <View style={styles.detailFooter}>
                <Button
                  label={acknowledging ? 'Acknowledging...' : 'Mark as Acknowledged'}
                  onPress={() => handleAcknowledge(detailModal.sop!)}
                  disabled={acknowledging}
                />
              </View>
            )}
          </View>
        )}
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.neutral[50],
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[200],
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  sopCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: SPACING.md,
  },
  titleContainer: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  sopName: {
    ...TYPOGRAPHY.h4,
    color: COLORS.neutral[900],
    marginBottom: SPACING.xs,
  },
  sopCode: {
    ...TYPOGRAPHY.caption,
    color: COLORS.neutral[600],
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.neutral[50],
    fontWeight: '600',
  },
  description: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[700],
    marginBottom: SPACING.md,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  metaText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.neutral[600],
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary[50],
    borderRadius: BORDER_RADIUS.md,
  },
  viewButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary[600],
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },

  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[700],
    marginTop: SPACING.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[700],
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  retryButton: {
    marginTop: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.neutral[900],
    marginTop: SPACING.md,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[600],
    marginTop: SPACING.xs,
  },

  // Detail Modal
  detailContainer: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingTop: SPACING.xl,
  },
  detailHeaderTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.neutral[50],
    flex: 1,
    marginLeft: SPACING.md,
  },
  acknowledgedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.success[50],
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success[600],
  },
  acknowledgedText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.success[700],
    marginLeft: SPACING.sm,
    flex: 1,
  },
  detailContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  detailCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  detailRow: {
    marginBottom: SPACING.md,
  },
  detailLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.neutral[600],
    marginBottom: SPACING.xs,
  },
  detailValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[900],
  },
  sectionTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.neutral[900],
    marginBottom: SPACING.md,
  },
  descriptionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[700],
    lineHeight: 22,
  },
  contentText: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[700],
    lineHeight: 22,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  attachmentText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary[600],
    marginLeft: SPACING.md,
    fontWeight: '600',
  },
  detailFooterSpacer: {
    height: SPACING.xl,
  },
  detailFooter: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral[200],
  },
});
