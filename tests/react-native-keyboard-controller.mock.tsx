import React from "react";

export const KeyboardAwareScrollView = ({ children, ...props }: any) => <div {...props}>{children}</div>;
export const KeyboardToolbar = () => null;
export const KeyboardProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
