import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../theme';

interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    color?: string;
    backgroundColor?: string;
    showLabel?: boolean;
    label?: string;
}

export function ProgressRing({
    progress,
    size = 80,
    strokeWidth = 8,
    color = COLORS.primary[500],
    backgroundColor = COLORS.neutral[200],
    showLabel = true,
    label,
}: ProgressRingProps) {
    // Simplified progress ring using View-based approach (no SVG required)
    const clampedProgress = Math.min(100, Math.max(0, progress));
    const innerSize = size - strokeWidth * 2;
    const hasProgress = clampedProgress > 0;
    const hasLabel = label !== undefined && label !== null && label !== '';

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {/* Background Circle */}
            <View
                style={[
                    styles.circle,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderWidth: strokeWidth,
                        borderColor: backgroundColor,
                    },
                ]}
            />
            
            {/* Progress Indicator - Using colored segments */}
            <View
                style={[
                    styles.progressContainer,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                    },
                ]}
            >
                {/* Top segment indicator */}
                {hasProgress === true ? (
                    <View
                        style={[
                            styles.progressIndicator,
                            {
                                backgroundColor: color,
                                width: strokeWidth,
                                height: strokeWidth,
                                borderRadius: strokeWidth / 2,
                                top: 0,
                                left: (size - strokeWidth) / 2,
                            },
                        ]}
                    />
                ) : null}
            </View>

            {/* Inner content */}
            {showLabel === true ? (
                <View style={[styles.labelContainer, { width: innerSize, height: innerSize }]}>
                    <Text style={[styles.progressText, { fontSize: size * 0.22, color }]}>
                        {Math.round(clampedProgress)}%
                    </Text>
                    {hasLabel === true ? <Text style={styles.label}>{label}</Text> : null}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    circle: {
        position: 'absolute',
    },
    progressContainer: {
        position: 'absolute',
    },
    progressIndicator: {
        position: 'absolute',
    },
    labelContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressText: {
        fontWeight: '700',
    },
    label: {
        ...TYPOGRAPHY.caption,
        marginTop: 2,
    },
});
