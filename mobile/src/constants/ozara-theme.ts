/**
 * ÖZARA Mobile Design System
 * AXEVIL-inspired ultra-luxury dark aesthetic
 */

export const OzaraTheme = {
  colors: {
    // Pure Obsidian Dark Palette
    background: '#000000',
    backgroundMidnight: '#0B1020',
    backgroundSurface: '#0a0b0e',
    backgroundCard: '#0f1014',
    backgroundCardHover: '#15171d',
    backgroundInput: '#121418',
    
    // Borders
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderMedium: 'rgba(255, 255, 255, 0.16)',
    borderActive: 'rgba(255, 255, 255, 0.28)',

    // Text & Icons
    textPrimary: '#ffffff',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
    textDim: '#4b5563',

    // Accents & Signals
    accentCyan: '#38bdf8',
    accentBlue: '#2563eb',
    accentPurple: '#a855f7',
    accentViolet: '#7C3AED',
    accentVioletBg: 'rgba(124, 58, 237, 0.16)',
    accentGold: '#d4af37',
    accentGoldBg: 'rgba(212, 175, 55, 0.12)',
    accentEmerald: '#10b981',
    accentEmeraldBg: 'rgba(16, 185, 129, 0.12)',
    accentWarning: '#f59e0b',
    accentWarningBg: 'rgba(245, 158, 11, 0.14)',
    accentDanger: '#ef4444',
    accentLime: '#CCFF00',
    accentLimeBg: 'rgba(204, 255, 0, 0.14)',
    accentElectricOrange: '#FF5E00',
    accentElectricOrangeLight: '#FF7A29',
    accentElectricOrangeBg: 'rgba(255, 94, 0, 0.16)',

    // Gradients
    gradientAvatar: ['#38bdf8', '#2563eb', '#818cf8', '#a855f7'],
    gradientGold: ['#f59e0b', '#d4af37', '#b45309'],
  },

  radius: {
    sm: 8,
    md: 14,
    lg: 20,
    xl: 26,
    full: 9999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 20,
    xl: 28,
    xxl: 36,
  },

  typography: {
    headline: {
      fontSize: 28,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
      color: '#ffffff',
    },
    title: {
      fontSize: 20,
      fontWeight: '700' as const,
      letterSpacing: -0.3,
      color: '#ffffff',
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: '#ffffff',
    },
    body: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
      color: '#9ca3af',
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: '#6b7280',
    },
    pill: {
      fontSize: 12,
      fontWeight: '500' as const,
    },
  },
};
