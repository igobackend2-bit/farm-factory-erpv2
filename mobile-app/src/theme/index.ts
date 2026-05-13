// IGO Group Mobile App - Glassmorphism Design System

export const COLORS = {
    // Primary Palette
    primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
    },
    // Success / Green
    success: {
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        400: '#4ade80',
        500: '#22c55e',
        600: '#16a34a',
        700: '#15803d',
    },
    // Warning / Amber
    warning: {
        50: '#fffbeb',
        100: '#fef3c7',
        400: '#fbbf24',
        500: '#f59e0b',
        600: '#d97706',
    },
    // Error / Red
    error: {
        50: '#fef2f2',
        100: '#fee2e2',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
    },
    // Danger (alias for error)
    danger: {
        50: '#fef2f2',
        100: '#fee2e2',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
    },
    // Neutral
    neutral: {
        50: '#fafafa',
        100: '#f5f5f5',
        200: '#e5e5e5',
        300: '#d4d4d4',
        400: '#a3a3a3',
        500: '#737373',
        600: '#525252',
        700: '#404040',
        800: '#262626',
        900: '#171717',
    },
    // Glass Effects
    glass: {
        white: 'rgba(255, 255, 255, 0.85)',
        whiteSoft: 'rgba(255, 255, 255, 0.6)',
        dark: 'rgba(0, 0, 0, 0.1)',
        border: 'rgba(255, 255, 255, 0.3)',
        borderDark: 'rgba(0, 0, 0, 0.08)',
    },
    // Background
    background: {
        primary: '#f8fafc',
        secondary: '#f1f5f9',
    },
};

// Pre-defined gradient color arrays for LinearGradient compatibility
// CRITICAL: Must be plain string arrays - NOT readonly/const assertions
// Android native bridge requires mutable arrays
export const GRADIENT_COLORS = {
    background: ['#e0e7ff', '#f0f9ff', '#f8fafc'],
    primary: ['#3b82f6', '#1d4ed8'],
    primaryFull: ['#2563eb', '#1e40af'],
    primaryDeep: ['#2563eb', '#1e40af', '#1e3a8a'],
    success: ['#22c55e', '#16a34a'],
    error: ['#ef4444', '#dc2626'],
    startDay: ['#3b82f6', '#1d4ed8'],
    endDay: ['#ef4444', '#dc2626'],
    disabled: ['#d4d4d4', '#a3a3a3'],
};

// Helper function to get gradient colors safely
export function getGradientColors(name: keyof typeof GRADIENT_COLORS): string[] {
    return [...GRADIENT_COLORS[name]];
}

// GRADIENTS export for backward compatibility - returns fresh arrays
export const GRADIENTS = {
    get background() { return ['#e0e7ff', '#f0f9ff', '#f8fafc']; },
    get primary() { return ['#3b82f6', '#1d4ed8']; },
    get primaryFull() { return ['#2563eb', '#1e40af']; },
    get primaryDeep() { return ['#2563eb', '#1e40af', '#1e3a8a']; },
    get success() { return ['#22c55e', '#16a34a']; },
    get error() { return ['#ef4444', '#dc2626']; },
    get startDay() { return ['#3b82f6', '#1d4ed8']; },
    get endDay() { return ['#ef4444', '#dc2626']; },
    get disabled() { return ['#d4d4d4', '#a3a3a3']; },
};

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const BORDER_RADIUS = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    round: 9999,
    full: 9999,
};

export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    glow: (color: string) => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    }),
};

export const TYPOGRAPHY = {
    // Headings
    h1: {
        fontSize: 28,
        fontWeight: '700' as const,
        lineHeight: 36,
        color: COLORS.neutral[900],
    },
    h2: {
        fontSize: 24,
        fontWeight: '700' as const,
        lineHeight: 32,
        color: COLORS.neutral[900],
    },
    h3: {
        fontSize: 20,
        fontWeight: '600' as const,
        lineHeight: 28,
        color: COLORS.neutral[800],
    },
    h4: {
        fontSize: 18,
        fontWeight: '600' as const,
        lineHeight: 24,
        color: COLORS.neutral[800],
    },
    // Body
    body: {
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 24,
        color: COLORS.neutral[700],
    },
    bodyBold: {
        fontSize: 16,
        fontWeight: '600' as const,
        lineHeight: 24,
        color: COLORS.neutral[800],
    },
    // Small
    caption: {
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 20,
        color: COLORS.neutral[500],
    },
    captionBold: {
        fontSize: 14,
        fontWeight: '600' as const,
        lineHeight: 20,
        color: COLORS.neutral[600],
    },
    // Labels
    label: {
        fontSize: 12,
        fontWeight: '600' as const,
        lineHeight: 16,
        color: COLORS.neutral[500],
        textTransform: 'uppercase' as const,
        letterSpacing: 0.5,
    },
    // Numbers / Time
    time: {
        fontSize: 48,
        fontWeight: '200' as const,
        color: COLORS.neutral[800],
    },
    timeSmall: {
        fontSize: 32,
        fontWeight: '300' as const,
        color: COLORS.neutral[700],
    },
};

// Status indicator colors
export const STATUS_COLORS = {
    on_time: COLORS.success[500],
    late: COLORS.warning[500],
    severe_late: COLORS.error[500],
    absent: COLORS.error[600],
    on_duty: COLORS.success[500],
    off_duty: COLORS.neutral[400],
    completed: COLORS.success[500],
    live: COLORS.primary[500],
    missed: COLORS.error[500],
    upcoming: COLORS.neutral[400],
};
