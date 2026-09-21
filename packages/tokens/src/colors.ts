export interface ExpoBaseColors {
  transparent: string;
  white: string;
  black: string;
  background: {
    canvas: string;
    surface: string;
    subtle: string;
    elevated: string;
    inverse: string;
    scrim: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
    disabled: string;
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
    focus: string;
  };
  interactive: {
    primary: string;
    primaryHover: string;
    primaryPressed: string;
    onPrimary: string;
    subtle: string;
    subtleHover: string;
    subtlePressed: string;
  };
  feedback: {
    positive: string;
    positiveSurface: string;
    warning: string;
    warningSurface: string;
    negative: string;
    negativeHover: string;
    negativePressed: string;
    negativeSurface: string;
    negativeSurfaceHover: string;
    negativeSurfacePressed: string;
    info: string;
    infoSurface: string;
    skeleton: string;
  };
  visualization: {
    series1: string;
    series2: string;
    series3: string;
    series4: string;
    series5: string;
    series6: string;
  };
}

const shared = {
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const lightColors = {
  ...shared,
  background: {
    canvas: '#F6F7F8',
    surface: '#FFFFFF',
    subtle: '#F1F3F5',
    elevated: '#FFFFFF',
    inverse: '#111417',
    scrim: 'rgba(5,7,9,0.46)',
  },
  text: {
    primary: '#111417',
    secondary: '#5E666D',
    tertiary: '#687078',
    inverse: '#F7F8F9',
    disabled: '#A7ADB3',
  },
  border: {
    subtle: '#ECEEF0',
    default: '#E0E4E7',
    strong: '#C8CED3',
    focus: '#165DFF',
  },
  interactive: {
    primary: '#165DFF',
    primaryHover: '#0F52E5',
    primaryPressed: '#0A43C2',
    onPrimary: '#FFFFFF',
    subtle: '#EAF0FF',
    subtleHover: '#E2EAFF',
    subtlePressed: '#D7E2FF',
  },
  feedback: {
    positive: '#137A52',
    positiveSurface: '#E7F6EF',
    warning: '#955A00',
    warningSurface: '#FFF3DD',
    negative: '#C23D48',
    negativeHover: '#AC303B',
    negativePressed: '#922732',
    negativeSurface: '#FDECEE',
    negativeSurfaceHover: '#FBE1E4',
    negativeSurfacePressed: '#F8D3D7',
    info: '#225FC2',
    infoSurface: '#EAF2FF',
    skeleton: '#D7DCE0',
  },
  visualization: {
    series1: '#165DFF',
    series2: '#7257D8',
    series3: '#137A52',
    series4: '#C86512',
    series5: '#C23D48',
    series6: '#147D91',
  },
} satisfies ExpoBaseColors;

export const darkColors = {
  ...shared,
  background: {
    canvas: '#090B0D',
    surface: '#111417',
    subtle: '#181C20',
    elevated: '#15191D',
    inverse: '#F4F6F8',
    scrim: 'rgba(0,0,0,0.64)',
  },
  text: {
    primary: '#F4F6F8',
    secondary: '#A0A8AF',
    tertiary: '#777F86',
    inverse: '#111417',
    disabled: '#626A71',
  },
  border: {
    subtle: '#20262B',
    default: '#2A3137',
    strong: '#3B444C',
    focus: '#7EA6FF',
  },
  interactive: {
    primary: '#6F98F7',
    primaryHover: '#82A7FA',
    primaryPressed: '#9AB8FA',
    onPrimary: '#09111F',
    subtle: '#142447',
    subtleHover: '#192D57',
    subtlePressed: '#203765',
  },
  feedback: {
    positive: '#68C99D',
    positiveSurface: '#10271E',
    warning: '#EAB466',
    warningSurface: '#32240F',
    negative: '#EE8B93',
    negativeHover: '#F39BA2',
    negativePressed: '#F8ADB3',
    negativeSurface: '#35171B',
    negativeSurfaceHover: '#432026',
    negativeSurfacePressed: '#512830',
    info: '#8CB5FF',
    infoSurface: '#142541',
    skeleton: '#30373D',
  },
  visualization: {
    series1: '#7EA6FF',
    series2: '#AA94FF',
    series3: '#68C99D',
    series4: '#F0A365',
    series5: '#EE8B93',
    series6: '#61C1D0',
  },
} satisfies ExpoBaseColors;
