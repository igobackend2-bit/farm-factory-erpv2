import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING, SHADOWS } from '../../theme';

interface ButtonProps {
    title?: string;
    label?: string;
    children?: React.ReactNode;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
    style?: StyleProp<ViewStyle>;
    textStyle?: TextStyle;
    fullWidth?: boolean;
}

export function Button({
    title,
    label,
    children,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    iconPosition = 'left',
    style,
    textStyle,
    fullWidth = false,
}: ButtonProps) {
    // Resolve text content from title, label, or children
    const displayTitle = title || label || (typeof children === 'string' ? children : '');
    const isDisabled = disabled || loading;

    const getVariantStyles = (): ViewStyle => {
        switch (variant) {
            case 'secondary':
                return { backgroundColor: '#ffffff', borderWidth: 1, borderColor: COLORS.neutral[200] };
            case 'success':
                return { backgroundColor: COLORS.success[500], ...SHADOWS.glow(COLORS.success[500]) };
            case 'danger':
                return { backgroundColor: COLORS.error[500], ...SHADOWS.glow(COLORS.error[500]) };
            case 'outline':
                return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary[500] };
            case 'ghost':
                return { backgroundColor: 'transparent' };
            default:
                return { backgroundColor: COLORS.primary[600], ...SHADOWS.glow(COLORS.primary[600]) };
        }
    };

    const getTextColor = (): string => {
        switch (variant) {
            case 'secondary':
                return COLORS.neutral[800];
            case 'outline':
            case 'ghost':
                return COLORS.primary[600];
            default:
                return '#ffffff';
        }
    };

    const getSizeStyles = (): ViewStyle => {
        switch (size) {
            case 'sm':
                return { paddingVertical: 10, paddingHorizontal: SPACING.lg };
            case 'lg':
                return { paddingVertical: 16, paddingHorizontal: SPACING.xxxl };
            default:
                return { paddingVertical: 13, paddingHorizontal: SPACING.xl };
        }
    };

    const getFontSize = (): number => {
        switch (size) {
            case 'sm':
                return 14;
            case 'lg':
                return 18;
            default:
                return 16;
        }
    };

    const hasIcon = icon !== undefined && icon !== null;
    const isLoading = loading === true;
    const showLeftIcon = hasIcon === true && iconPosition === 'left';
    const showRightIcon = hasIcon === true && iconPosition === 'right';

    return (
        <TouchableOpacity
            style={[
                styles.button,
                getVariantStyles(),
                getSizeStyles(),
                fullWidth === true ? styles.fullWidth : null,
                isDisabled === true ? styles.disabled : null,
                style,
            ]}
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.8}
        >
            {isLoading === true ? (
                <ActivityIndicator color={getTextColor()} size="small" />
            ) : (
                <>
                    {showLeftIcon === true ? <>{icon}</> : null}
                    <Text
                        style={[
                            styles.text,
                            { color: getTextColor(), fontSize: getFontSize() },
                            showLeftIcon === true ? styles.textWithLeftIcon : null,
                            showRightIcon === true ? styles.textWithRightIcon : null,
                            textStyle,
                        ]}
                    >
                        {displayTitle}
                    </Text>
                    {showRightIcon === true ? <>{icon}</> : null}
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.lg,
    },
    fullWidth: {
        width: '100%',
    },
    text: {
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    textWithLeftIcon: {
        marginLeft: SPACING.sm,
    },
    textWithRightIcon: {
        marginRight: SPACING.sm,
    },
    disabled: {
        opacity: 0.5,
    },
});
