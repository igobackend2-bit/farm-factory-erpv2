import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { COLORS, SPACING } from '../../theme';

interface AppScreenProps {
  title?: string;
  children?: React.ReactNode;
  navigation?: any;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export function AppScreen({ title, children, navigation, showBack, rightAction }: AppScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation?.goBack()} 
          style={[styles.backButton, !showBack && styles.hidden]}
          disabled={!showBack}
        >
          {showBack && <ArrowLeft size={24} color={COLORS.neutral[800]} />}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title || ''}</Text>
        <View style={styles.rightAction}>
          {rightAction}
        </View>
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral[200],
    backgroundColor: '#fff',
  },
  backButton: {
    padding: SPACING.xs,
    width: 40,
  },
  hidden: {
    opacity: 0,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.neutral[800],
    textAlign: 'center',
  },
  rightAction: {
    width: 40,
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
  },
});