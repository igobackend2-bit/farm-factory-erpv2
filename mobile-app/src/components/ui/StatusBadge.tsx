import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../theme';

interface StatusBadgeProps {
    status: 'on_duty' | 'off_duty' | 'on_time' | 'late' | 'severe_late' | 'completed' | 'live' | 'missed' | 'upcoming' | 'pending';
    label?: string;
    size?: 'sm' | 'md' | 'lg';
    showDot?: boolean;
    style?: ViewStyle;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
    on_duty: { bg: COLORS.success[100], text: COLORS.success[700], dot: COLORS.success[500] },
    off_duty: { bg: COLORS.neutral[100], text: COLORS.neutral[600], dot: COLORS.neutral[400] },
    on_time: { bg: COLORS.success[100], text: COLORS.success[700], dot: COLORS.success[500] },
    late: { bg: COLORS.warning[100], text: COLORS.warning[600], dot: COLORS.warning[500] },
    severe_late: { bg: COLORS.error[100], text: COLORS.error[700], dot: COLORS.error[500] },
    completed: { bg: COLORS.success[100], text: COLORS.success[700], dot: COLORS.success[500] },
    live: { bg: COLORS.primary[100], text: COLORS.primary[700], dot: COLORS.primary[500] },
    missed: { bg: COLORS.error[100], text: COLORS.error[700], dot: COLORS.error[500] },
    upcoming: { bg: COLORS.neutral[100], text: COLORS.neutral[600], dot: COLORS.neutral[400] },
    pending: { bg: COLORS.warning[100], text: COLORS.warning[600], dot: COLORS.warning[500] },
};

const STATUS_LABELS: Record<string, string> = {
    on_duty: 'ON DUTY',
    off_duty: 'OFF DUTY',
    on_time: 'ON TIME',
    late: 'LATE',
    severe_late: 'SEVERE LATE',
    completed: 'COMPLETED',
    live: 'LIVE',
    missed: 'MISSED',
    upcoming: 'UPCOMING',
    pending: 'PENDING',
};

export function StatusBadge({ status, label, size = 'md', showDot = true, style }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
    const displayLabel = label || STATUS_LABELS[status] || status.toUpperCase();

    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, fontSize: 10 };
            case 'lg':
                return { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, fontSize: 14 };
            default:
                return { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, fontSize: 12 };
        }
    };

    const sizeConfig = getSizeStyles();

    const dotSize = size === 'sm' ? 6 : 8;
    const shouldShowDot = showDot === true;

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: config.bg, paddingVertical: sizeConfig.paddingVertical, paddingHorizontal: sizeConfig.paddingHorizontal },
                style,
            ]}
        >
            {shouldShowDot === true ? (
                <View style={[styles.dot, { backgroundColor: config.dot, width: dotSize, height: dotSize }]} />
            ) : null}
            <Text style={[styles.text, { color: config.text, fontSize: sizeConfig.fontSize }]}>
                {displayLabel}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.round,
    },
    dot: {
        borderRadius: BORDER_RADIUS.round,
        marginRight: SPACING.sm,
    },
    text: {
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
