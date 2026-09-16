import React, { useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../common";

const fontFamily = "System";
const SWIPE_ACTION_WIDTH = 82;

export interface LogicLevelSwipeAction {
  key: string;
  label: string;
  tone?: "primary" | "secondary" | "danger" | "neutral";
  onPress: () => void;
}

interface LogicLevelCardProps {
  title: string;
  pills?: React.ReactNode;
  swipeActions?: LogicLevelSwipeAction[];
  children?: React.ReactNode;
  defaultExpanded?: boolean;
}

export const LogicLevelCard: React.FC<LogicLevelCardProps> = ({
  title,
  pills,
  swipeActions = [],
  children,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeOffsetRef = useRef(0);
  const hasSwipeActions = swipeActions.length > 0;
  const totalActionWidth = swipeActions.length * SWIPE_ACTION_WIDTH;

  const animateSwipeTo = (toValue: number) => {
    swipeOffsetRef.current = toValue;
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      damping: 20,
      stiffness: 220,
    }).start();
  };

  const closeSwipe = () => animateSwipeTo(0);
  const openSwipe = () => animateSwipeTo(-totalActionWidth);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          hasSwipeActions && Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          translateX.stopAnimation((value) => {
            swipeOffsetRef.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          if (!hasSwipeActions) return;
          const next = Math.max(-totalActionWidth, Math.min(0, swipeOffsetRef.current + gesture.dx));
          translateX.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          if (!hasSwipeActions) return;
          const releaseValue = swipeOffsetRef.current + gesture.dx;
          if (gesture.dx < -36 || releaseValue < -totalActionWidth * 0.45) {
            openSwipe();
            return;
          }
          closeSwipe();
        },
        onPanResponderTerminate: closeSwipe,
      }),
    [hasSwipeActions, totalActionWidth, translateX],
  );

  const handleToggle = () => {
    if (swipeOffsetRef.current < -8) {
      closeSwipe();
      return;
    }
    setExpanded((current) => !current);
  };

  return (
    <Card style={styles.card}>
      {hasSwipeActions ? (
        <View pointerEvents="box-none" style={styles.swipeActionsLayer}>
          {swipeActions.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => {
                closeSwipe();
                action.onPress();
              }}
              style={({ pressed }) => [
                styles.swipeAction,
                action.tone === "primary"
                  ? styles.swipeActionPrimary
                  : action.tone === "secondary"
                    ? styles.swipeActionSecondary
                    : action.tone === "danger"
                      ? styles.swipeActionDanger
                      : styles.swipeActionNeutral,
                pressed ? styles.swipeActionPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.swipeActionLabel,
                  action.tone === "secondary" || action.tone === "neutral"
                    ? styles.swipeActionLabelDark
                    : null,
                ]}
                numberOfLines={2}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable onPress={handleToggle} style={styles.contentPressable}>
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={expanded ? 2 : 1}>
                {title}
              </Text>
            </View>
            <Text style={styles.toggle}>{expanded ? "−" : "+"}</Text>
          </View>
          {pills ? <View style={styles.pills}>{pills}</View> : null}
          {expanded ? <View style={styles.body}>{children}</View> : null}
        </Pressable>
      </Animated.View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 0,
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  contentPressable: {
    padding: 14,
    gap: 10,
    backgroundColor: "#ffffff",
  },
  swipeActionsLayer: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "stretch",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    color: "#0f172a",
    fontWeight: "900",
    fontFamily,
  },
  toggle: {
    width: 18,
    textAlign: "center",
    color: "#64748b",
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "800",
    fontFamily,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  body: {
    gap: 10,
  },
  swipeAction: {
    width: SWIPE_ACTION_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 16,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(15, 23, 42, 0.08)",
  },
  swipeActionPrimary: {
    backgroundColor: "#111827",
  },
  swipeActionSecondary: {
    backgroundColor: "#e2e8f0",
  },
  swipeActionDanger: {
    backgroundColor: "#b91c1c",
  },
  swipeActionNeutral: {
    backgroundColor: "#cbd5e1",
  },
  swipeActionPressed: {
    opacity: 0.88,
  },
  swipeActionLabel: {
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    textAlign: "center",
    fontFamily,
  },
  swipeActionLabelDark: {
    color: "#0f172a",
  },
});
