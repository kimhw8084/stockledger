import React from "react";
import { View } from "react-native";

/**
 * Vitest runs the React Native surface through react-native-web. The native SVG
 * renderer is exercised by Expo/native builds; this keeps the node test lane
 * deterministic without changing the production package resolution.
 */
const SvgPrimitive = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <View ref={ref} {...props}>{children}</View>
));

SvgPrimitive.displayName = "SvgPrimitive";

export const Svg = SvgPrimitive;
export const Circle = SvgPrimitive;
export const ClipPath = SvgPrimitive;
export const Defs = SvgPrimitive;
export const Ellipse = SvgPrimitive;
export const G = SvgPrimitive;
export const Line = SvgPrimitive;
export const LinearGradient = SvgPrimitive;
export const Mask = SvgPrimitive;
export const Path = SvgPrimitive;
export const Polygon = SvgPrimitive;
export const Polyline = SvgPrimitive;
export const Rect = SvgPrimitive;
export const Stop = SvgPrimitive;
export default SvgPrimitive;
