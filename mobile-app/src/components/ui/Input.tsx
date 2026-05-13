import React from 'react';
import { View, TextInput, Text, StyleSheet, ViewStyle, TextInputProps } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../theme';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerStyle?: ViewStyle;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export function Input({
    label,
    error,
    containerStyle,
    leftIcon,
    rightIcon,
    ...textInputProps
}: InputProps) {
    const hasLabel = label !== undefined && label !== null && label !== '';
    const hasError = error !== undefined && error !== null && error !== '';
    const hasLeftIcon = leftIcon !== undefined && leftIcon !== null;
    const hasRightIcon = rightIcon !== undefined && rightIcon !== null;

    return (
        <View style={[styles.container, containerStyle]}>
            {hasLabel === true ? <Text style={styles.label}>{label}</Text> : null}
            <View style={[styles.inputContainer, hasError === true ? styles.inputError : null]}>
                {hasLeftIcon === true ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
                <TextInput
                    style={[
                        styles.input,
                        hasLeftIcon === true ? styles.inputWithLeftIcon : null,
                        hasRightIcon === true ? styles.inputWithRightIcon : null,
                    ]}
                    placeholderTextColor={COLORS.neutral[400]}
                    {...textInputProps}
                />
                {hasRightIcon === true ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
            </View>
            {hasError === true ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.lg,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.neutral[600],
        marginBottom: SPACING.sm,
        marginLeft: 2,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: COLORS.neutral[200],
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
    },
    inputError: {
        borderColor: COLORS.error[500],
    },
    input: {
        flex: 1,
        height: 54,
        paddingHorizontal: SPACING.lg,
        fontSize: 16,
        color: COLORS.neutral[800],
    },
    inputWithLeftIcon: {
        paddingLeft: SPACING.sm,
    },
    inputWithRightIcon: {
        paddingRight: SPACING.sm,
    },
    leftIcon: {
        paddingLeft: SPACING.lg,
    },
    rightIcon: {
        paddingRight: SPACING.lg,
    },
    errorText: {
        fontSize: 12,
        color: COLORS.error[500],
        marginTop: SPACING.xs,
    },
});
