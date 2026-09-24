import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  findNodeHandle,
  Modal,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { t, type AppLanguage } from "../lib/i18n";

const fontFamily = "System";

interface WindowPanelProps {
  title: string;
  subtitle?: string;
  subtitleNumberOfLines?: number;
  onClose: () => void;
  children: React.ReactNode | ((close: () => void, closeAfterCommit: () => void) => React.ReactNode);
  language?: AppLanguage;
  closeLabel?: string;
  closeDisabled?: boolean;
  returnFocusRef?: React.RefObject<any>;
  fallbackFocusRef?: React.RefObject<any>;
}

export const WindowPanel = ({
  title,
  subtitle,
  subtitleNumberOfLines = 2,
  onClose,
  children,
  language = "en",
  closeLabel = t(language, "common.done"),
  closeDisabled = false,
  returnFocusRef,
  fallbackFocusRef,
}: WindowPanelProps) => {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetOffset = useRef(new Animated.Value(28)).current;
  const sheetScale = useRef(new Animated.Value(0.985)).current;
  const closingRef = useRef(false);
  const closeDisabledRef = useRef(closeDisabled);
  closeDisabledRef.current = closeDisabled;
  const closeButtonRef = useRef<any>(null);

  useEffect(() => {
    const focusInitialControl = () => {
      if (Platform.OS === "web") {
        closeButtonRef.current?.focus?.();
        return;
      }
      const node = findNodeHandle(closeButtonRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    };
    const timer = setTimeout(focusInitialControl, 0);
    return () => clearTimeout(timer);
  }, []);

  const canRestoreFocus = (candidate: any) => {
    if (!candidate || candidate.isConnected === false) return false;
    if (Platform.OS === "web") {
      if (candidate === document.body) return false;
      if (candidate.nodeType !== 1) return false;
      if (typeof candidate.focus !== "function") return false;
      if (candidate.disabled || candidate.getAttribute?.("aria-disabled") === "true") return false;
      if (candidate.getAttribute?.("tabindex") === "-1") return false;
      return true;
    }
    return Boolean(findNodeHandle(candidate));
  };

  const restoreFocus = () => {
    const target = [returnFocusRef?.current, fallbackFocusRef?.current].find(canRestoreFocus);
    if (!target) return;
    if (Platform.OS === "web") {
      target.focus?.();
      return;
    }
    const node = findNodeHandle(target);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  };

  const finishClose = () => {
    onClose();
    const restoreAfterCommit = () => {
      restoreFocus();
      if (returnFocusRef) returnFocusRef.current = null;
    };
    setTimeout(() => {
      if (Platform.OS === "web" && typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => requestAnimationFrame(restoreAfterCommit));
        return;
      }
      restoreAfterCommit();
    }, 0);
  };

  const panelKeyboardProps =
    Platform.OS === "web"
      ? ({
          onKeyDown: (event: any) => {
            const key = event?.nativeEvent?.key ?? event?.key;
            if (key === "Escape" && !closeDisabled) {
              event.preventDefault();
              animateClose();
            }
          },
        } as any)
      : {};

  const startClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (reduced) { finishClose(); return; }
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(sheetOffset, {
        toValue: 42,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(sheetScale, {
        toValue: 0.98,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(finishClose);
  };

  const animateClose = () => {
    if (closeDisabledRef.current) return;
    startClose();
  };
  const closeAfterCommit = () => startClose();
  const panelChildren = typeof children === "function" ? children(animateClose, closeAfterCommit) : children;

  const dragResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        const nextOffset = Math.max(0, gesture.dy);
        sheetOffset.setValue(nextOffset);
        overlayOpacity.setValue(Math.max(0.08, 1 - nextOffset / 220));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 96 || gesture.vy > 1.15) {
          animateClose();
          return;
        }
        Animated.parallel([
          Animated.timing(overlayOpacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.spring(sheetOffset, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 180,
          }),
          Animated.spring(sheetScale, {
            toValue: 1,
            useNativeDriver: true,
            damping: 18,
            stiffness: 180,
          }),
        ]).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (reduced) { overlayOpacity.setValue(1); sheetOffset.setValue(0); sheetScale.setValue(1); return; }
    const animation = Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(sheetOffset, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
      }),
      Animated.spring(sheetScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
      }),
    ]);
    animation.start(); return () => animation.stop();
  }, [overlayOpacity, sheetOffset, sheetScale, reduced]);

  return (
    <Modal
      transparent
      animationType="none"
      visible
      onRequestClose={animateClose}
      statusBarTranslucent
      {...({ accessibilityLabel: title } as any)}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Animated.View style={[styles.windowBackdrop, { opacity: overlayOpacity, paddingTop: insets.top }]}>
        <Pressable accessible={false} accessibilityRole="none" style={styles.windowDismissLayer} onPress={animateClose} />
        <Animated.View
          accessible
          accessibilityRole="none"
          accessibilityLabel={title}
          accessibilityViewIsModal
          {...panelKeyboardProps}
          style={[styles.windowPanel, { paddingBottom: Math.max(16, insets.bottom), transform: [{ translateY: sheetOffset }, { scale: sheetScale }] }]}
        >
          <View style={styles.windowHandleTouch} {...dragResponder.panHandlers}>
            <View style={styles.windowGrabber} />
          </View>
          <View style={styles.windowHeader}>
            <View style={styles.flexOne}>
              <Text accessibilityRole="header" style={styles.windowTitle} numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.windowSubtitle} numberOfLines={subtitleNumberOfLines}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable ref={closeButtonRef} accessibilityRole="button" accessibilityLabel={closeLabel} accessibilityState={{ disabled: closeDisabled }} disabled={closeDisabled} onPress={animateClose} style={({ pressed, focused }: any) => [styles.doneButton, pressed ? styles.doneButtonPressed : null, focused ? styles.focusRing : null, closeDisabled ? styles.closeDisabled : null]}>
              <Text style={styles.doneButtonText}>{closeLabel}</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.windowScroll}
            contentContainerStyle={styles.windowScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {panelChildren}
          </ScrollView>
        </Animated.View>
      </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  windowBackdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.24)",
  },
  windowDismissLayer: {
    flex: 1,
  },
  windowPanel: {
    height: "88%",
    minHeight: 0,
    flexShrink: 1,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderColor: "#eceef2",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 26,
    gap: 10,
    overflow: "hidden",
  },
  windowHandleTouch: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 4,
  },
  windowGrabber: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#d1d5db",
    marginBottom: 8,
  },
  windowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  windowTitle: {
    color: "#111827",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    fontFamily,
  },
  windowSubtitle: {
    marginTop: 4,
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    fontFamily,
  },
  doneButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  closeDisabled: {
    opacity: 0.55,
  },
  focusRing: {
    borderColor: "#2563eb",
    borderWidth: 3,
  },
  doneButtonText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "700",
    fontFamily,
  },
  windowScroll: {
    flex: 1,
    minHeight: 0,
  },
  windowScrollContent: {
    gap: 10,
    paddingBottom: 28,
    flexGrow: 1,
  },
});
