export const layoutDimensions = {
  minimumContent: 280,
  compactReadable: 560,
  sidebar: {
    compact: 216,
    standard: 248,
  },
  inspector: {
    minimum: 280,
    standard: 320,
    wide: 360,
  },
  split: {
    primaryMinimum: 360,
    secondaryMinimum: 300,
  },
} as const;

export const actionMetrics = {
  barWidth: {
    medium: 320,
    expanded: 480,
    wide: 600,
  },
  overflowTrigger: {
    icon: 44,
    compact: 72,
    standard: 96,
  },
} as const;

export type OverflowTriggerSize = keyof typeof actionMetrics.overflowTrigger;
