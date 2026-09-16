import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";

export const MotionSwap = ({
  children,
  swapKey,
  y = 10,
  scaleFrom = 0.985,
  duration = 220,
}: {
  children: React.ReactNode;
  swapKey: string;
  y?: number;
  scaleFrom?: number;
  duration?: number;
}) => {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) { opacity.setValue(1); translateY.setValue(0); scale.setValue(1); return; }
    opacity.setValue(0);
    translateY.setValue(y);
    scale.setValue(scaleFrom);

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        stiffness: 240,
        damping: 24,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        stiffness: 260,
        damping: 22,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]);
    animation.start(); return () => animation.stop();
  }, [duration, opacity, scale, scaleFrom, swapKey, translateY, y, reduced]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      {children}
    </Animated.View>
  );
};
