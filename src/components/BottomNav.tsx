import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const fontFamily = "System";

interface BottomNavProps<T extends string> {
  tabs: readonly T[];
  currentTab: T;
  onSelect: (tab: T) => void;
}

export const BottomNav = <T extends string>({ tabs, currentTab, onSelect }: BottomNavProps<T>) => (
  <View style={styles.bottomNav}>
    <View style={styles.bottomNavRow}>
      {tabs.map((item) => (
        <Pressable
          key={item}
          onPress={() => onSelect(item)}
          style={({ pressed }) => [
            styles.navItem,
            currentTab === item ? styles.navItemActive : null,
            pressed ? styles.navItemPressed : null,
          ]}
        >
          <View style={[styles.navIndicator, currentTab === item ? styles.navIndicatorActive : null]} />
          <Text style={[styles.navLabel, currentTab === item ? styles.navLabelActive : null]} numberOfLines={1}>
            {item}
          </Text>
        </Pressable>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fbfbfd",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    paddingBottom: 28,
    paddingHorizontal: 10,
  },
  bottomNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 68,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eceef2",
    shadowColor: "#111827",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 52,
    borderRadius: 14,
    marginHorizontal: 2,
    overflow: "hidden",
  },
  navItemActive: {
    backgroundColor: "#111827",
  },
  navItemPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  navIndicator: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
  },
  navIndicatorActive: {
    backgroundColor: "#ffffff",
  },
  navLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "800",
    fontFamily,
  },
  navLabelActive: {
    color: "#ffffff",
  },
});
