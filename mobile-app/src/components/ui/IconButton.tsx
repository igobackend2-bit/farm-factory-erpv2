import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, BORDER_RADIUS, SHADOWS } from '../../theme';

interface IconButtonProps {
    icon: React.ReactNode;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    style?: ViewStyle;
}

export function IconButton({
    icon,
    onPress,
    variant = 'secondary',
    size = 'md',
    disabled = false,
    style,
}: IconButtonProps) {
    const getVariantStyles = (): ViewStyle => {
        switch (variant) {
            case 'primary':
                return { backgroundColor: COLORS.primary[500], ...SHADOWS.glow(COLORS.primary[500]) };
            case 'success':
                return { backgroundColor: COLORS.success[500] };
            case 'danger':
                return { backgroundColor: COLORS.error[500] };
            case 'ghost':
                return { backgroundColor: 'transparent' };
            default:
                return { backgroundColor: COLORS.neutral[100] };
        }
    };

    const getSizeStyles = (): ViewStyle => {
        switch (size) {
            case 'sm':
                return { width: 36, height: 36 };
            case 'lg':
                return { width: 56, height: 56 };
            default:
                return { width: 44, height: 44 };
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                getVariantStyles(),
                getSizeStyles(),
                disabled === true ? styles.disabled : null,
                style,
            ]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
        >
            {icon}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabled: {
        opacity: 0.5,
    },
});
