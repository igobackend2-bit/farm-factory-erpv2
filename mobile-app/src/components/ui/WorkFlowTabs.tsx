import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';

type WorkRouteName = 'DayPlan' | 'HourlyReport' | 'EODReport';

interface WorkFlowTabsProps {
    navigation: any;
    active: WorkRouteName;
}

const TABS: { key: WorkRouteName; label: string }[] = [
    { key: 'DayPlan', label: 'Day Plan' },
    { key: 'HourlyReport', label: 'Hourly Report' },
    { key: 'EODReport', label: 'EOD Summary' },
];

export default function WorkFlowTabs({ navigation, active }: WorkFlowTabsProps) {
    return (
        <View style={styles.wrap}>
            {TABS.map((tab) => {
                const isActive = active === tab.key;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, isActive ? styles.tabActive : null]}
                        onPress={() => {
                            if (!isActive) navigation.navigate(tab.key);
                        }}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, isActive ? styles.tabTextActive : null]}>{tab.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.neutral[200],
        padding: 4,
        marginBottom: SPACING.lg,
        ...SHADOWS.sm,
    },
    tab: {
        flex: 1,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.md,
    },
    tabActive: {
        backgroundColor: COLORS.primary[50],
    },
    tabText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[500],
    },
    tabTextActive: {
        color: COLORS.primary[700],
    },
});
