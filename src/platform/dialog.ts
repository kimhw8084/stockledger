import { Alert, Platform } from "react-native";
type Action = { text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void | Promise<unknown> };
export const appDialog = { alert(title: string, message = "", buttons: Action[] = [{ text: "OK" }]) {
  const invoke = async (action?: Action) => { try { await action?.onPress?.(); } catch (error) { const text = error instanceof Error ? error.message : "Action failed. Your saved data is preserved."; if (Platform.OS === "web") window.alert(text); else Alert.alert("Could not complete action", text); } };
  if (Platform.OS === "web") {
    const proceed = buttons.some(button => button.style === "cancel") ? window.confirm(`${title}\n\n${message}`) : (window.alert(`${title}\n\n${message}`), true);
    if (proceed) void invoke(buttons.find(button => button.style !== "cancel"));
  } else Alert.alert(title, message, buttons.map(button => ({ ...button, onPress: () => { void invoke(button); } })));
} };
