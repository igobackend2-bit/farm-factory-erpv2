import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../theme';

export default function TasksScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Tasks</Text>
            <Text style={styles.subtitle}>Tasks management coming soon.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background.primary,
    },
    title: {
        ...TYPOGRAPHY.h3,
        color: COLORS.neutral[900],
        marginBottom: 8,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[600],
    },
});
