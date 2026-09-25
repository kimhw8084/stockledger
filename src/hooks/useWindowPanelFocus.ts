import { useCallback, useRef } from "react";
import { Platform } from "react-native";
import { chooseWebFocusInvoker } from "../lib/webFocusEligibility";

export type WindowPanelFocusSource = unknown;

const eventInvoker = (source: WindowPanelFocusSource) => {
  if (!source || typeof source !== "object") return source;
  if ("currentTarget" in source) return (source as { currentTarget?: unknown }).currentTarget;
  return source;
};

/**
 * Owns the focus transaction for one WindowPanel opening path. When a caller
 * does not pass an explicit source, the focused control is read synchronously
 * before the caller mounts the panel; WindowPanel never discovers it after
 * mount.
 */
export const useWindowPanelFocus = (fallbackFocusRef?: React.RefObject<any>) => {
  const returnFocusRef = useRef<any>(null);

  const captureInvoker = useCallback((source?: WindowPanelFocusSource) => {
    const explicitTarget = eventInvoker(source);
    if (Platform.OS !== "web" && explicitTarget) {
      returnFocusRef.current = explicitTarget;
      return;
    }

    if (Platform.OS === "web" && typeof document !== "undefined") {
      returnFocusRef.current = chooseWebFocusInvoker(
        source === undefined ? undefined : explicitTarget,
        document.activeElement,
      );
      return;
    }

    returnFocusRef.current = null;
  }, []);

  return { returnFocusRef, fallbackFocusRef, captureInvoker };
};
