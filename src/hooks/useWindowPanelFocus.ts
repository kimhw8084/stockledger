import { useCallback, useRef } from "react";
import { Platform } from "react-native";

export type WindowPanelFocusSource = unknown;

const eventInvoker = (source: WindowPanelFocusSource) => {
  if (!source || typeof source !== "object") return source;
  if ("currentTarget" in source) return (source as { currentTarget?: unknown }).currentTarget;
  return source;
};

const isFocusableWebElement = (target: unknown) => {
  if (typeof document === "undefined" || !target || typeof target !== "object") return false;
  const element = target as {
    disabled?: unknown;
    isConnected?: unknown;
    nodeType?: unknown;
    focus?: unknown;
    getAttribute?: (name: string) => string | null;
  };
  return (
    target !== document.body &&
    element.isConnected !== false &&
    element.nodeType === 1 &&
    typeof element.focus === "function" &&
    element.disabled !== true &&
    element.getAttribute?.("aria-disabled") !== "true" &&
    element.getAttribute?.("tabindex") !== "-1"
  );
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
      if (isFocusableWebElement(explicitTarget)) {
        returnFocusRef.current = explicitTarget;
        return;
      }
      const activeElement = document.activeElement;
      returnFocusRef.current = activeElement && activeElement !== document.body && activeElement.nodeType === 1 ? activeElement : null;
      return;
    }

    returnFocusRef.current = null;
  }, []);

  return { returnFocusRef, fallbackFocusRef, captureInvoker };
};
