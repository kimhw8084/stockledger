import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform } from "react-native";
export type WorkspaceTab = "Home" | "Stocks" | "Logic Lab" | "Eyes" | "Alerts" | "Journal" | "Settings";
const paths: Record<WorkspaceTab, string> = { Home: "today", Stocks: "watchlist", "Logic Lab": "recipes", Eyes: "monitoring", Alerts: "alerts", Journal: "journal", Settings: "settings" };
function readRoute(): WorkspaceTab {
  if (Platform.OS !== "web" || typeof window === "undefined") return "Home";
  const path = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return (Object.keys(paths) as WorkspaceTab[]).find(tab => paths[tab] === path) ?? "Home";
}
export function useWorkspaceNavigation() {
  const [tab, setTab] = useState<WorkspaceTab>(readRoute);
  const history = useRef<WorkspaceTab[]>([tab]);
  const navigate = useCallback((next: WorkspaceTab) => {
    if (history.current.at(-1) === next) return;
    history.current.push(next);
    if (Platform.OS === "web") window.history.pushState({}, "", `#/${paths[next]}`);
    setTab(next);
  }, []);
  useEffect(() => {
    if (Platform.OS === "web") {
      const restore = () => { const next = readRoute(); history.current = [next]; setTab(next); };
      window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
      return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (history.current.length <= 1) return false;
      history.current.pop(); setTab(history.current.at(-1)!); return true;
    });
    return () => subscription.remove();
  }, []);
  return [tab, navigate] as const;
}
