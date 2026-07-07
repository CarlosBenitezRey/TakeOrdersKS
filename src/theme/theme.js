export const COLORS = {
  background: '#0F172A',      // Slate 900
  card: '#1E293B',            // Slate 800
  cardElevated: '#334155',    // Slate 700
  primary: '#E65F2B',         // Premium Rust Orange (Food/Restaurant accent)
  secondary: '#F2A93B',       // Vibrant Warm Amber
  success: '#10B981',         // Emerald Green
  danger: '#EF4444',          // Crimson Red
  border: '#334155',          // Slate 700
  text: '#F8FAFC',            // Slate 50 (Off-white)
  textMuted: '#94A3B8',       // Slate 400 (Muted gray)
  textLight: '#FFFFFF',       // Full white
  overlay: 'rgba(15, 23, 42, 0.75)',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const BORDER_RADIUS = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 30,
  round: 9999,
};

export const TYPOGRAPHY = {
  h1: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.text,
  },
  bodyMuted: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.textMuted,
  },
  button: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
};
