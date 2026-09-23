import React, { useState } from "react";
import { TextInput } from "../../ui";
import type { KeyboardTypeOptions, TextInputProps } from "react-native";
import { StyleSheet, Text, View } from "../../ui";

export interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  secureTextEntry?: boolean;
  testID?: string;
}

export function FormField(props: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.root}>
      <Text variant="label">{props.label}</Text>
      <TextInput
        accessibilityLabel={props.label}
        aria-invalid={props.invalid}
        autoCapitalize={props.autoCapitalize}
        autoComplete={props.autoComplete}
        editable={!props.disabled}
        keyboardType={props.keyboardType}
        multiline={props.multiline}
        onBlur={() => setFocused(false)}
        onChangeText={props.onChangeText}
        onFocus={() => setFocused(true)}
        placeholder={props.placeholder}
        secureTextEntry={props.secureTextEntry}
        testID={props.testID}
        value={props.value}
        style={[styles.input, props.multiline && styles.multiline, focused && styles.focused, props.invalid && styles.invalid, props.disabled && styles.disabled]}
      />
      {props.invalid ? <Text variant="caption" tone="negative">{props.label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0, gap: theme.spacing.xs },
  input: {
    minWidth: 0,
    width: "100%",
    minHeight: theme.controlHeights.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: theme.strokeWidths.standard,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.background.surface,
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  focused: { borderColor: theme.colors.border.focus, boxShadow: `0 0 0 ${theme.interactionFeedback.focusRingWidth}px ${theme.colors.border.focus}` },
  invalid: { borderColor: theme.colors.feedback.negative },
  disabled: { opacity: theme.interactionFeedback.disabledOpacity },
}));
