import React, { Component, type ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import StockLedgerApp from "./src/app/StockLedgerApp";
import { Button } from "./src/components/common";
class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <View style={{ padding: 24, gap: 16 }}><Text accessibilityRole="header" style={{ fontSize: 24 }}>StockLedger could not open this view</Text><Text>Your saved data has not been reset.</Text><Button label="Try again" onPress={() => this.setState(state => ({ failed: false, attempt: state.attempt + 1 }))} /></View>;
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}
export default function App() {
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1 }}><AppBoundary><StockLedgerApp /></AppBoundary></SafeAreaView></SafeAreaProvider>;
}
