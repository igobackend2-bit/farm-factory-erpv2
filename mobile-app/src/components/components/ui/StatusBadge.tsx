import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';

interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'warning' | 'error' | 'info';
  style?: ViewStyle;
}

export function StatusBadge({ status, variant = 'info', style }: StatusBadgeProps) {
  const getColors = () => {
    switch (variant) {
      case 'success': return { bg: '#dcfce7', text: '#16a34a' };
      case 'warning': return { bg: '#fef3c7', text: '#d97706' };
      case 'error': return { bg: '#fee2e2', text: '#dc2626' };
      default: return { bg: '#dbeafe', text: '#2563eb' };
    }
  };
  
  const colors = getColors();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.text, { color: colors.text }]}>
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});