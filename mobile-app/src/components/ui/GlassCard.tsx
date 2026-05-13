import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, BORDER_RADIUS, SHADOWS, SPACING } from '../../theme';

interface GlassCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    intensity?: number;
    variant?: 'default' | 'elevated' | 'subtle';
    noPadding?: boolean;
}

export function GlassCard({
    children,
    style,
    intensity = 60,
    variant = 'default',
    noPadding = false,
}: GlassCardProps) {
    const getVariantStyles = () => {
        switch (variant) {
            case 'elevated':
                return [styles.elevated, SHADOWS.lg];
            case 'subtle':
                return [styles.subtle];
            default:
                return [styles.default, SHADOWS.md];
        }
    };

    return (
        <View style={[styles.container, ...getVariantStyles(), style]}>
            <BlurView intensity={intensity} tint="light" style={styles.blur}>
                <View style={[styles.content, noPadding === true ? styles.noPadding : null]}>
                    {children}
                </View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
    },
    blur: {
        flex: 1,
    },
    content: {
        padding: SPACING.lg,
        backgroundColor: COLORS.glass.white,
    },
    noPadding: {
        padding: 0,
    },
    default: {
        borderWidth: 1,
        borderColor: COLORS.glass.border,
    },
    elevated: {
        borderWidth: 1,
        borderColor: COLORS.glass.border,
    },
    subtle: {
        borderWidth: 1,
        borderColor: COLORS.glass.borderDark,
        backgroundColor: COLORS.glass.whiteSoft,
    },
});
