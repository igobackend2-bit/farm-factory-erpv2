import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    StatusBar,
    ViewStyle,
    StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, TYPOGRAPHY } from '../../theme';

interface AppScreenProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    scrollable?: boolean;
    contentStyle?: StyleProp<ViewStyle>;
    headerRight?: React.ReactNode;
}

export function AppScreen({
    children,
    title,
    subtitle,
    scrollable = false,
    contentStyle,
    headerRight,
}: AppScreenProps) {
    const hasHeader = Boolean(title) || Boolean(subtitle) || Boolean(headerRight);

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" />
            <LinearGradient
                colors={['#eef4ff', '#f7fbff', '#f8fafc']}
                style={StyleSheet.absoluteFillObject}
            />
            <SafeAreaView style={styles.safeArea}>
                {hasHeader ? (
                    <View style={styles.header}>
                        <View style={styles.headerTextWrap}>
                            {title ? <Text style={styles.title}>{title}</Text> : null}
                            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                        </View>
                        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
                    </View>
                ) : null}

                {scrollable ? (
                    <ScrollView
                        contentContainerStyle={[styles.scrollContent, contentStyle]}
                        showsVerticalScrollIndicator={false}
                    >
                        {children}
                    </ScrollView>
                ) : (
                    <View style={[styles.content, contentStyle]}>{children}</View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: COLORS.background.primary,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTextWrap: {
        flex: 1,
    },
    title: {
        ...TYPOGRAPHY.h3,
        color: COLORS.neutral[900],
    },
    subtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        marginTop: 4,
    },
    headerRight: {
        marginLeft: SPACING.md,
    },
    content: {
        flex: 1,
        paddingHorizontal: SPACING.lg,
    },
    scrollContent: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.xxxl,
    },
});
