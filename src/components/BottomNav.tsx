import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";

const fontFamily = "System";

interface BottomNavProps<T extends string> {
  tabs: readonly T[];
  currentTab: T;
  onSelect: (tab: T) => void;
  labels?: Partial<Record<T, string>>;
  icons?: Partial<Record<T, string>>;
}

export const BottomNav = <T extends string>({ tabs, currentTab, onSelect, labels, icons }: BottomNavProps<T>) => {
  const reduced = useReducedMotion();
  const [itemFrames, setItemFrames] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const pillX = useRef(new Animated.Value(0)).current;
  const pillY = useRef(new Animated.Value(0)).current;
  const pillWidth = useRef(new Animated.Value(0)).current;
  const pillHeight = useRef(new Animated.Value(0)).current;
  const activeFrame = itemFrames[String(currentTab)];

  useEffect(() => {
    if (!activeFrame) return;
    if (reduced) { pillX.setValue(activeFrame.x + 6); pillY.setValue(activeFrame.y + 6); pillWidth.setValue(Math.max(0, activeFrame.width - 12)); pillHeight.setValue(Math.max(0, activeFrame.height - 12)); return; }
    const animation = Animated.parallel([
      Animated.spring(pillX, {
        toValue: activeFrame.x + 6,
        useNativeDriver: false,
        stiffness: 260,
        damping: 26,
        mass: 0.9,
      }),
      Animated.spring(pillY, {
        toValue: activeFrame.y + 6,
        useNativeDriver: false,
        stiffness: 260,
        damping: 26,
        mass: 0.9,
      }),
      Animated.spring(pillWidth, {
        toValue: Math.max(0, activeFrame.width - 12),
        useNativeDriver: false,
        stiffness: 260,
        damping: 26,
        mass: 0.9,
      }),
      Animated.spring(pillHeight, {
        toValue: Math.max(0, activeFrame.height - 12),
        useNativeDriver: false,
        stiffness: 260,
        damping: 26,
        mass: 0.9,
      }),
    ]);
    animation.start(); return () => animation.stop();
  }, [activeFrame, pillHeight, pillWidth, pillX, pillY, reduced]);

  return (
    <View style={styles.bottomNav}>
      <View style={styles.bottomNavRail}>
        {activeFrame ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activePill,
              {
                left: pillX,
                top: pillY,
                width: pillWidth,
                height: pillHeight,
              },
            ]}
          />
        ) : null}
        <View style={styles.bottomNavRow}>
          {tabs.map((item) => {
            const active = currentTab === item;
            return (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityLabel={labels?.[item] ?? item}
                accessibilityState={{ selected: active }}
                aria-selected={active}
                onPress={() => onSelect(item)}
                onLayout={(event) => {
                  const { x, y, width, height } = event.nativeEvent.layout;
                  setItemFrames((current) => {
                    const previous = current[String(item)];
                    if (
                      previous &&
                      previous.x === x &&
                      previous.y === y &&
                      previous.width === width &&
                      previous.height === height
                    ) {
                      return current;
                    }
                    return {
                      ...current,
                      [String(item)]: { x, y, width, height },
                    };
                  });
                }}
                style={({ pressed }) => [
                  styles.navItem,
                  pressed ? styles.navItemPressed : null,
                ]}
              >
                <Text style={[styles.navIcon, active ? styles.navIconActive : null]}>
                  {icons?.[item] ?? "•"}
                </Text>
                <Text style={[styles.navLabel, active ? styles.navLabelActive : null]} numberOfLines={1}>
                  {labels?.[item] ?? item}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  bottomNavRail: {
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.08)",
    backgroundColor: "rgba(251,251,253,0.98)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
    minHeight: 86,
  },
  activePill: {
    position: "absolute",
    borderRadius: 18,
    backgroundColor: "#111827",
  },
  bottomNavRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 86,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 12,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 64,
    borderRadius: 16,
    marginHorizontal: 0,
    zIndex: 1,
  },
  navItemPressed: {
    transform: [{ scale: 0.975 }],
    opacity: 0.94,
  },
  navIcon: {
    color: "#94a3b8",
    fontSize: 17,
    fontWeight: "900",
    fontFamily,
  },
  navIconActive: {
    color: "#ffffff",
    fontSize: 18,
  },
  navLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    fontFamily,
    lineHeight: 14,
  },
  navLabelActive: {
    color: "#ffffff",
  },
});
