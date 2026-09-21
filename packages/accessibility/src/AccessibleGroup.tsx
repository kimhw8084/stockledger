import type{PropsWithChildren}from'react';import{View,type AccessibilityRole}from'react-native';
export interface AccessibleGroupProps extends PropsWithChildren{label:string;hint?:string | undefined;role?:AccessibilityRole | undefined;}
export function AccessibleGroup({children,label,hint,role}:AccessibleGroupProps){return <View accessible accessibilityLabel={label} accessibilityHint={hint} accessibilityRole={role}>{children}</View>}
