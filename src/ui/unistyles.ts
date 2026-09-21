import { StyleSheet } from "react-native-unistyles";
import { breakpoints, createExpoBaseThemes } from "@expo-base/tokens";
import { stockLedgerBrand } from "./brand";

const themes = createExpoBaseThemes(stockLedgerBrand);
type StockLedgerThemes = typeof themes;
type StockLedgerBreakpoints = typeof breakpoints;

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends StockLedgerThemes {}
  export interface UnistylesBreakpoints extends StockLedgerBreakpoints {}
}

StyleSheet.configure({
  themes,
  breakpoints,
  settings: {
    // R11 preserves StockLedger's current light product experience. The dark palette is
    // registered for future compatibility, but there is intentionally no theme switch here.
    initialTheme: "light",
    nativeBreakpointsMode: "points",
  },
});

export { themes };
