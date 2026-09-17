import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform } from "react-native";
export type WorkspaceTab = "Home" | "Stocks" | "Logic Lab" | "Eyes" | "Alerts" | "Journal" | "Settings";
const paths: Record<WorkspaceTab, string> = { Home: "today", Stocks: "watchlist", "Logic Lab": "recipes", Eyes: "monitoring", Alerts: "alerts", Journal: "journal", Settings: "settings" };

export type WorkspaceRouteParams = Record<string, string>;
export interface WorkspaceRoute {
  tab: WorkspaceTab;
  params: WorkspaceRouteParams;
}

const tabForPath = (path: string): WorkspaceTab =>
  (Object.keys(paths) as WorkspaceTab[]).find(tab => paths[tab] === path) ?? "Home";

export const parseWorkspaceRoute = (hash: string): WorkspaceRoute => {
  const raw = hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const params: WorkspaceRouteParams = {};
  new URLSearchParams(query).forEach((value, key) => {
    if (value) params[key] = value;
  });
  return { tab: tabForPath(path), params };
};

export const workspaceHash = (tab: WorkspaceTab, params: WorkspaceRouteParams = {}) => {
  const query = new URLSearchParams();
  Object.entries(params)
    .filter(([, value]) => Boolean(value))
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, value]) => query.set(key, value));
  const encodedQuery = query.toString();
  return `#/${paths[tab]}${encodedQuery ? `?${encodedQuery}` : ""}`;
};

const routeKey = (route: WorkspaceRoute) => `${route.tab}?${workspaceHash(route.tab, route.params)}`;

function readRoute(): WorkspaceRoute {
  if (Platform.OS !== "web" || typeof window === "undefined") return { tab: "Home", params: {} };
  return parseWorkspaceRoute(window.location.hash);
}

export type WorkspaceNavigateOptions = { replace?: boolean };

export function useWorkspaceNavigation() {
  const [route, setRoute] = useState<WorkspaceRoute>(readRoute);
  const history = useRef<WorkspaceRoute[]>([route]);
  const navigate = useCallback((next: WorkspaceTab, params: WorkspaceRouteParams = {}, options: WorkspaceNavigateOptions = {}) => {
    const nextRoute = { tab: next, params };
    if (routeKey(history.current.at(-1)!) === routeKey(nextRoute)) return;
    if (options.replace) {
      history.current[history.current.length - 1] = nextRoute;
      if (Platform.OS === "web") window.history.replaceState({}, "", workspaceHash(next, params));
    } else {
      history.current.push(nextRoute);
      if (Platform.OS === "web") window.history.pushState({}, "", workspaceHash(next, params));
    }
    setRoute(nextRoute);
  }, []);
  useEffect(() => {
    if (Platform.OS === "web") {
      const restore = () => { const next = readRoute(); history.current = [next]; setRoute(next); };
      window.addEventListener("popstate", restore); window.addEventListener("hashchange", restore);
      return () => { window.removeEventListener("popstate", restore); window.removeEventListener("hashchange", restore); };
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (history.current.length <= 1) return false;
      history.current.pop(); setRoute(history.current.at(-1)!); return true;
    });
    return () => subscription.remove();
  }, []);
  return [route.tab, navigate, route] as const;
}
