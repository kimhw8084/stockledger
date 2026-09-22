export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  massive: 64,
} as const;

export const strokeWidths = {
  standard: 1,
  emphasis: 1.5,
} as const;

export const radii = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

export const controlHeights = {
  sm: 36,
  md: 44,
  lg: 52,
} as const;

export const iconSizes = {
  xs: 16,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const breakpoints = {
  compact: 0,
  medium: 600,
  expanded: 900,
  wide: 1200,
} as const;

export const contentWidths = {
  reading: 680,
  form: 760,
  standard: 1040,
  dashboard: 1280,
  wide: 1440,
} as const;

export const layers = {
  content: 0,
  sticky: 100,
  navigation: 200,
  dropdown: 300,
  popover: 400,
  sheet: 500,
  modal: 600,
  toast: 700,
} as const;

export const motion = {
  duration: {
    instant: 0,
    fast: 120,
    normal: 200,
    slow: 320,
  },
  spring: {
    snappy: { damping: 24, stiffness: 360, mass: 0.72 },
    standard: { damping: 24, stiffness: 260, mass: 0.9 },
    gentle: { damping: 26, stiffness: 180, mass: 1 },
  },
} as const;


export const componentMetrics = {
  badgeHeight: 24,
  tagHeight: 26,
  brandMark: 30,
  navigationBadge: 18,
  bottomNavigationItem: 52,
  menuMinWidth: 220,
  dialogMaxWidth: 440,
  sheetHandleWidth: 40,
  sheetHandleHeight: 4,
  sheetMaxHeight: '88%' as const,
  sheetMaxWidth: 640,
  dataListRowMinHeight: 62,
  metricMinWidth: 220,
} as const;

export const interactionFeedback = {
  pressedOpacity: 0.82,
  disabledOpacity: 0.42,
  focusRingWidth: 3,
  compactHitSlop: 4,
} as const;

export const visualizationMetrics = {
  sparklineHeight: 48,
  compactHeight: 160,
  standardHeight: 220,
  largeHeight: 300,
  lineWidth: 2.25,
  pointRadius: 4,
  progressHeight: 8,
  ringStroke: 10,
  ringSizeSm: 48,
  ringSizeMd: 64,
  ringSizeLg: 80,
  chartInset: 8,
  gridLineWidth: 1,
  areaOpacity: 0.12,
  mutedSeriesOpacity: 0.72,
} as const;

export const feedbackTiming = {
  toastVisible: 4000,
} as const;

export const feedbackMetrics = {
  toastMaxWidth: 440,
  toastProgressHeight: 3,
  stateIconBox: 56,
  stateMinHeight: 240,
  skeletonLineHeight: 12,
  skeletonTitleHeight: 18,
  skeletonAvatar: 40,
  bannerIconBox: 28,
} as const;

export const formMetrics = {
  fieldGap: spacing.sm,
  sectionGap: spacing.xxl,
  inputHorizontalPadding: spacing.md,
  textAreaMinHeight: 112,
  helperGap: spacing.xs,
  checkboxSize: 20,
  radioDotSize: 10,
  switchWidth: 44,
  switchHeight: 26,
  switchThumb: 20,
} as const;

export const typographyMetrics = {
  compact: {
    display: { fontSize: 36, lineHeight: 40 },
    h1: { fontSize: 28, lineHeight: 34 },
    h2: { fontSize: 22, lineHeight: 28 },
  },
} as const;

export const typography = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: '700', letterSpacing: -1.2 },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.7 },
  h2: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
  h3: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0 },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '400', letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '400', letterSpacing: 0.1 },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: '600', letterSpacing: 0.2 },
  code: { fontSize: 13, lineHeight: 20, fontWeight: '400', letterSpacing: 0, fontFamily: 'monospace' },
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
export type ControlSize = keyof typeof controlHeights;
export type IconSize = keyof typeof iconSizes;
export type BreakpointName = keyof typeof breakpoints;
export type ContentWidth = keyof typeof contentWidths;
