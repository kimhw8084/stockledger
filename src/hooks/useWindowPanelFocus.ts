import { useCallback, useRef } from "react";
import { Platform } from "react-native";

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
    const sourceIsEvent = Boolean(source && typeof source === "object" && "currentTarget" in source);
    const explicitWebElement =
      Platform.OS === "web" &&
      explicitTarget &&
      typeof explicitTarget === "object" &&
      (explicitTarget as { nodeType?: unknown }).nodeType === 1 &&
      typeof (explicitTarget as { focus?: unknown }).focus === "function";
    if (Platform.OS !== "web" && explicitTarget) {
      returnFocusRef.current = explicitTarget;
      return;
    }

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const activeElement = document.activeElement;
      if (sourceIsEvent && activeElement && activeElement !== document.body && activeElement.nodeType === 1) {
        returnFocusRef.current = activeElement;
        return;
      }
      if (explicitWebElement) {
        returnFocusRef.current = explicitTarget;
        return;
      }
      returnFocusRef.current = activeElement && activeElement !== document.body && activeElement.nodeType === 1 ? activeElement : null;
      return;
    }

    returnFocusRef.current = null;
  }, []);

  return { returnFocusRef, fallbackFocusRef, captureInvoker };
};
