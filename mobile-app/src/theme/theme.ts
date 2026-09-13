
export const themeColors = {
  // Backgrounds — aligned with new Colors token system
  bg_dark: '#0B1015',
  bg_surface: '#111827',
  bg_card: '#1a2234',

  // Text
  text_primary: '#ffffff',
  text_secondary: '#9CA3AF',
  text_muted: '#6B7280',

  // Brand Colors
  primary: '#00A651',        // Green
  primary_light: '#1dd1a1',
  primaryTeal: '#1dd1a1',    // alias used by BillBookScreen
  secondary: '#5f27cd',      // Purple

  // Status
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3498db',

  // Compatibility aliases — used by existing screens (do NOT remove)
  background: '#0B1015',
  surface: '#111827',
  cardBg: '#1a2234',
  cardBgLight: '#1F2937',
  cardSecondaryBg: '#111827',
  inputBg: '#1F2937',

  textPrimary: '#ffffff',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',

  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(0, 166, 81, 0.25)',
};

export const colors = themeColors;

export const themeGradients = {
  purpleMesh: ['#5f27cd', '#341f97'] as const,
  emeraldMesh: ['#00A651', '#00b894'] as const,
  blueMesh: ['#0984e3', '#74b9ff'] as const,
  indigoMesh: ['#4F46E5', '#818CF8'] as const,
  darkHero: ['#00A651', '#1dd1a1'] as const,
  cardGlass: ['#1a2234', '#111827'] as const,
  tealGlow: ['#00A651', '#1dd1a1'] as const,
  redGlow: ['#c0392b', '#ee5a6f'] as const,
};

export const themeShadows = {
  glowTeal: {},
  glowPurple: {},
  glowBlue: {},
  cardFloating: {},
};

export const commonStyles = {
  cardContainer: {
    backgroundColor: themeColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themeColors.border,
    padding: 16,
  },
  input: {
    backgroundColor: themeColors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: themeColors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: themeColors.textPrimary,
    minHeight: 50,
  },
  buttonPrimary: {
    borderRadius: 12,
    minHeight: 50,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: themeColors.primary,
  },
};

export default themeColors;
