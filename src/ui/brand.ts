import type { ExpoBaseBrand } from "@expo-base/tokens";

/** StockLedger's restrained research-workspace accent, defined for both themes. */
export const stockLedgerBrand: ExpoBaseBrand = {
  name: "StockLedger",
  shortName: "S",
  light: {
    primary: "#2D5BBD",
    primaryHover: "#244EAA",
    primaryPressed: "#1C3F8C",
    onPrimary: "#FFFFFF",
    subtle: "#EAF0FC",
    subtleHover: "#E1E9FA",
    subtlePressed: "#D4E0F6",
    focus: "#2D5BBD",
    visualizationPrimary: "#2D5BBD",
  },
  dark: {
    primary: "#8EAEF5",
    primaryHover: "#A0BCF8",
    primaryPressed: "#B0C8FA",
    onPrimary: "#0D1628",
    subtle: "#172642",
    subtleHover: "#1E3155",
    subtlePressed: "#29406A",
    focus: "#9DBAF8",
    visualizationPrimary: "#8EAEF5",
  },
};
