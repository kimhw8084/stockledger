import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { AppLanguage, t } from "../lib/i18n";
import { useReducedMotion } from "../hooks/useReducedMotion";

const fontFamily = "System";

export const Reveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (reduced) { opacity.setValue(1); translateY.setValue(0); return; }
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        delay,
        useNativeDriver: true,
      }),
    ]);
    animation.start(); return () => animation.stop();
  }, [delay, opacity, translateY, reduced]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};

export const Card = ({
  children,
  highlighted,
  style,
}: {
  children: React.ReactNode;
  highlighted?: boolean;
  style?: any;
}) => (
  <View style={[styles.card, highlighted ? styles.cardHighlighted : null, style]}>
    {children}
  </View>
);

export const Button = ({
  label,
  onPress,
  tone = "primary",
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void | Promise<unknown>;
  tone?: "primary" | "secondary" | "ghost" | "risk";
  disabled?: boolean;
  style?: any;
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  return <><Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || pending, busy: pending }}
    disabled={disabled || pending}
    onPress={async () => {
      if (disabled || busy.current) return;
      busy.current = true; setPending(true); setError("");
      try { await onPress(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not complete action. Please try again."); }
      finally { busy.current = false; setPending(false); }
    }}
    style={({ pressed }) => [
      styles.button,
      tone === "primary"
        ? styles.buttonPrimary
        : tone === "secondary"
          ? styles.buttonSecondary
          : tone === "risk"
            ? styles.buttonRisk
            : styles.buttonGhost,
      pressed && !disabled ? styles.buttonPressed : null,
      disabled ? styles.buttonDisabled : null,
      style,
    ]}
  >
    <Text
      style={[
        styles.buttonText,
        tone === "primary"
          ? styles.buttonPrimaryText
          : tone === "secondary"
          ? styles.buttonSecondaryText
          : tone === "risk"
            ? styles.buttonRiskText
            : styles.buttonGhostText,
        disabled ? styles.buttonDisabledText : null,
      ]}
    >
      {pending ? "…" : label}
    </Text>
  </Pressable>{error ? <Text accessibilityRole="alert" style={{ color: "#a12935", fontSize: 14, lineHeight: 20 }}>{error}</Text> : null}</>;
};

export const Input = ({
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  onSubmitEditing,
  returnKeyType,
  invalid,
  autoFocus,
  secureTextEntry,
  autoComplete,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  secureTextEntry?: boolean;
  autoComplete?: TextInputProps["autoComplete"];
  autoCapitalize?: "none" | "sentences" | "characters";
  onSubmitEditing?: () => void;
  returnKeyType?: "done" | "go" | "next" | "search";
  invalid?: boolean;
  autoFocus?: boolean;
}) => (
  <TextInput
    accessibilityLabel={placeholder}
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#8da0b7"
    multiline={multiline}
    keyboardType={keyboardType}
    autoCapitalize={autoCapitalize}
    onSubmitEditing={onSubmitEditing}
    returnKeyType={returnKeyType}
    autoFocus={autoFocus}
    secureTextEntry={secureTextEntry}
    autoComplete={autoComplete}
    style={[styles.input, invalid ? styles.inputInvalid : null, multiline ? styles.textArea : null]}
  />
);

export const NumberStepper = ({
  label,
  value,
  onChange,
  step,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step: number;
  min: number;
  max: number;
  unit?: string;
}) => (
  <View style={styles.stepper}>
    <Text style={styles.stepperLabel}>{label}</Text>
    <View style={styles.stepperTrack}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={() => onChange(Math.max(min, Number((value - step).toFixed(2))))} style={styles.stepperButton}>
        <Text style={styles.stepperButtonText}>-</Text>
      </Pressable>
      <View style={styles.stepperValueWrap}>
        <Text style={styles.stepperValue}>
          {value}
          {unit ? ` ${unit}` : ""}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={() => onChange(Math.min(max, Number((value + step).toFixed(2))))} style={styles.stepperButton}>
        <Text style={styles.stepperButtonText}>+</Text>
      </Pressable>
    </View>
  </View>
);

export const DenseStat = ({ label, value, tone = "neutral", style }: { label: string; value: string; tone?: "neutral" | "strong" | "risk" | "success"; style?: any }) => (
  <View style={[
    styles.denseStat, 
    tone === "strong" ? styles.denseStatStrong : 
    tone === "risk" ? styles.denseStatRisk : 
    tone === "success" ? styles.denseStatSuccess : null,
    style
  ]}>
    <Text style={styles.denseStatLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.denseStatValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

export const MetaPill = ({ label, tone = "neutral", style }: { label: string; tone?: "neutral" | "success" | "risk" | "info"; style?: any }) => (
  <View style={[
    styles.metaPill, 
    tone === "success" ? styles.metaPillSuccess : 
    tone === "risk" ? styles.metaPillRisk : 
    tone === "info" ? styles.metaPillInfo : null,
    style
  ]}>
    <Text style={[
      styles.metaPillText,
      tone !== "neutral" ? styles.metaPillTextWhite : null
    ]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

export const HorizontalChoice = <T extends string>({
  options,
  value,
  onSelect,
  variant = "chip",
  labelForOption,
}: {
  options: readonly T[];
  value: T;
  onSelect: (next: T) => void;
  variant?: "chip" | "segmented";
  labelForOption?: (option: T) => string;
}) => {
  if (variant === "segmented") {
    return (
      <View style={styles.segmentedChoice}>
        {options.map((option, index) => (
          <Pressable
            key={option}
            accessibilityRole="button" accessibilityLabel={labelForOption ? labelForOption(option) : option} accessibilityState={{ selected: option === value }} aria-pressed={option === value}
            onPress={() => onSelect(option)}
            style={({ pressed }) => [
              styles.segmentedChoiceItem,
              option === value ? styles.segmentedChoiceItemActive : null,
              index > 0 ? styles.segmentedChoiceItemDivider : null,
              pressed ? styles.choiceChipPressed : null,
            ]}
          >
            <Text
              style={[
                styles.segmentedChoiceText,
                option === value ? styles.segmentedChoiceTextActive : null,
              ]}
              numberOfLines={1}
            >
              {labelForOption ? labelForOption(option) : option}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button" accessibilityLabel={labelForOption ? labelForOption(option) : option} accessibilityState={{ selected: option === value }} aria-pressed={option === value}
          onPress={() => onSelect(option)}
          style={({ pressed }) => [
            styles.choiceChip,
            option === value ? styles.choiceChipActive : null,
            pressed ? styles.choiceChipPressed : null,
          ]}
        >
          <Text style={[styles.choiceChipText, option === value ? styles.choiceChipTextActive : null]} numberOfLines={1}>
            {labelForOption ? labelForOption(option) : option}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};

export const SectionHeader = ({
  title,
  note,
  action,
  compact = false,
}: {
  title?: string;
  note?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) => (
  <View style={[styles.sectionHeader, compact ? styles.sectionHeaderCompact : null]}>
    {title ? (
      <View style={styles.sectionHeaderTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action ? <View style={styles.sectionHeaderAction}>{action}</View> : null}
      </View>
    ) : null}
    {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
  </View>
);

export const LogicBlock = ({
  eyebrow,
  title,
  summary,
  meta,
  children,
  defaultExpanded = false,
  status,
}: {
  eyebrow?: string;
  title: string;
  summary: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  status?: "Passed" | "Failed" | "Warning" | "Blocked" | "Neutral";
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card style={[styles.logicBlockCard, status === "Blocked" ? styles.borderBlocked : status === "Warning" ? styles.borderWarning : null]}>
      <Pressable onPress={() => setExpanded((current) => !current)} style={styles.logicBlockHeader}>
        <View style={styles.flexOne}>
          <View style={styles.logicBlockTopRow}>
            {eyebrow ? <Text style={styles.cardEyebrow}>{eyebrow}</Text> : null}
            {status && status !== "Neutral" && (
               <View style={[styles.statusMiniDot, status === "Passed" ? styles.dotSuccess : status === "Failed" ? styles.dotRisk : styles.dotWarning]} />
            )}
          </View>
          <View style={styles.logicBlockTitleRow}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.logicBlockToggle}>{expanded ? "−" : "+"}</Text>
          </View>
          <Text style={styles.cardBody} numberOfLines={expanded ? 10 : 2}>{summary}</Text>
        </View>
      </Pressable>
      {meta ? <View style={styles.metaRow}>{meta}</View> : null}
      {expanded ? <View style={styles.expandedContent}>{children}</View> : null}
    </Card>
  );
};

export const SearchableSelect = <T extends string | { id: string; label: string; sublabel?: string }>({
  options,
  value,
  onSelect,
  placeholder = "Select an option...",
  label,
  renderOption,
  disabled = false,
}: {
  options: readonly T[];
  value: string;
  onSelect: (option: T) => void;
  placeholder?: string;
  label?: string;
  renderOption?: (option: T) => React.ReactNode;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const reduced = useReducedMotion();
  const [search, setSearch] = useState("");

  const getLabel = (opt: T) => (typeof opt === "string" ? opt : opt.label);
  const getId = (opt: T) => (typeof opt === "string" ? opt : opt.id);

  const filteredOptions = options.filter((opt) => {
    const searchStr = search.toLowerCase();
    if (typeof opt === "string") return opt.toLowerCase().includes(searchStr);
    return opt.label.toLowerCase().includes(searchStr) || opt.sublabel?.toLowerCase().includes(searchStr);
  });

  const selectedOption = options.find((opt) => getId(opt) === value);

  return (
    <View style={styles.selectContainer}>
      {label && <Text style={styles.selectLabel}>{label}</Text>}
      <Pressable disabled={disabled} accessibilityState={{ disabled }} accessibilityRole="button" accessibilityLabel={label ?? placeholder} aria-expanded={isOpen} onPress={() => setIsOpen(true)} style={styles.selectTrigger}>
        <Text style={[styles.selectValue, !selectedOption ? styles.selectPlaceholder : null]}>
          {selectedOption ? getLabel(selectedOption) : placeholder}
        </Text>
        <Text style={styles.selectArrow}>▼</Text>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType={reduced ? "none" : "slide"}
        onRequestClose={() => { setIsOpen(false); setSearch(""); }}
      >
        <View style={styles.dropdownOverlay}>
          <View style={styles.dropdownContent}>
             <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>{label || "SELECT"}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close options" onPress={() => { setIsOpen(false); setSearch(""); }} style={styles.dropdownClose}>
                   <Text style={styles.dropdownCloseText}>✕</Text>
                </Pressable>
             </View>
             <View style={styles.dropdownSearchBox}>
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search options..."
                  autoFocus
                />
             </View>
             <ScrollView style={styles.dropdownList} keyboardShouldPersistTaps="handled">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => (
                    <Pressable
                      key={getId(opt)}
                      accessibilityRole="button" accessibilityLabel={getLabel(opt)}
                      onPress={() => {
                        onSelect(opt);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      style={({ pressed }) => [
                        styles.dropdownItem,
                        getId(opt) === value ? styles.dropdownItemActive : null,
                        pressed ? styles.dropdownItemPressed : null
                      ]}
                    >
                      {renderOption ? renderOption(opt) : (
                        <View>
                          <Text style={[styles.dropdownItemText, getId(opt) === value ? styles.dropdownItemTextActive : null]}>
                             {getLabel(opt)}
                          </Text>
                          {typeof opt !== "string" && opt.sublabel && (
                            <Text style={styles.dropdownItemSubtext}>{opt.sublabel}</Text>
                          )}
                        </View>
                      )}
                    </Pressable>
                  ))
                ) : (
                  <View style={styles.dropdownEmpty}>
                     <Text style={styles.dropdownEmptyText}>No results matching "{search}"</Text>
                  </View>
                )}
             </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#f3f4f6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHighlighted: {
    borderColor: "#111827",
    borderWidth: 2,
  },
  button: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonPrimary: {
    backgroundColor: "#111827",
  },
  buttonSecondary: {
    backgroundColor: "#f3f4f6",
  },
  buttonRisk: {
    backgroundColor: "#fee2e2",
  },
  buttonGhost: {
    backgroundColor: "transparent",
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "800",
    fontFamily,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  buttonPrimaryText: {
    color: "#ffffff",
  },
  buttonSecondaryText: {
    color: "#111827",
  },
  buttonRiskText: {
    color: "#ef4444",
  },
  buttonGhostText: {
    color: "#6b7280",
  },
  buttonDisabledText: {
    color: "#9ca3af",
  },
  input: {
    height: 48,
    backgroundColor: "#f9fafb",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
    fontFamily,
  },
  inputInvalid: {
    borderColor: "#ef4444",
    backgroundColor: "#fff1f2",
  },
  textArea: {
    height: 120,
    paddingTop: 14,
    textAlignVertical: "top",
  },
  stepper: {
    marginVertical: 12,
  },
  stepperLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  stepperTrack: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 6,
  },
  stepperButton: {
    width: 36,
    height: 36,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  stepperValueWrap: {
    flex: 1,
    alignItems: "center",
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  denseStat: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    minWidth: 85,
    borderWidth: 1.5,
    borderColor: "#f3f4f6",
  },
  denseStatStrong: {
    backgroundColor: "#f8fafc",
    borderColor: "#111827",
  },
  denseStatRisk: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
  },
  denseStatSuccess: {
    backgroundColor: "#ecfdf5",
    borderColor: "#d1fae5",
  },
  denseStatLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  denseStatValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },
  metaPill: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  metaPillSuccess: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  metaPillRisk: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  metaPillInfo: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  metaPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4b5563",
    textTransform: "uppercase",
  },
  metaPillTextWhite: {
    color: "#ffffff",
  },
  segmentedChoice: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 3,
    marginVertical: 12,
  },
  segmentedChoiceItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
  },
  segmentedChoiceItemActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentedChoiceItemDivider: {
    marginLeft: 2,
  },
  segmentedChoiceText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  segmentedChoiceTextActive: {
    color: "#111827",
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 6,
  },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#f3f4f6",
  },
  choiceChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  choiceChipPressed: {
    opacity: 0.8,
  },
  choiceChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4b5563",
    textTransform: "uppercase",
  },
  choiceChipTextActive: {
    color: "#ffffff",
  },
  sectionHeader: {
    marginVertical: 20,
    paddingHorizontal: 4,
  },
  sectionHeaderCompact: {
    marginVertical: 8,
  },
  sectionHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionHeaderAction: {
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    letterSpacing: -0.8,
    flex: 1,
  },
  sectionNote: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    marginTop: 6,
    fontWeight: "500",
  },
  logicBlockCard: {
    padding: 18,
  },
  borderBlocked: {
    borderColor: "#ef4444",
  },
  borderWarning: {
    borderColor: "#f59e0b",
  },
  logicBlockHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  logicBlockTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  statusMiniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotSuccess: { backgroundColor: "#10b981" },
  dotRisk: { backgroundColor: "#ef4444" },
  dotWarning: { backgroundColor: "#f59e0b" },
  flexOne: {
    flex: 1,
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
    fontStyle: "italic",
  },
  logicBlockTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    letterSpacing: -0.3,
  },
  logicBlockToggle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#d1d5db",
  },
  cardBody: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
    fontWeight: "500",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
  },
  expandedContent: {
    gap: 14,
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  stack: {
    gap: 12,
    marginTop: 12,
  },
  selectContainer: {
    marginVertical: 10,
  },
  selectLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
    fontStyle: "italic",
  },
  selectTrigger: {
    height: 48,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  selectPlaceholder: {
    color: "#94a3b8",
  },
  selectArrow: {
    fontSize: 10,
    color: "#94a3b8",
  },
  dropdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: -500, // Large enough to cover scroll area if needed, though usually used in a Portal
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    zIndex: 1000,
    justifyContent: "flex-end",
  },
  dropdownContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: "80%",
    padding: 24,
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  dropdownTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontStyle: "italic",
  },
  dropdownClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownCloseText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#64748b",
  },
  dropdownSearchBox: {
    marginBottom: 16,
  },
  dropdownList: {
    flex: 1,
  },
  dropdownItem: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownItemActive: {
    backgroundColor: "#f8fafc",
  },
  dropdownItemPressed: {
    backgroundColor: "#f1f5f9",
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#334155",
  },
  dropdownItemTextActive: {
    color: "#0f172a",
  },
  dropdownItemSubtext: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 2,
  },
  dropdownEmpty: {
    paddingVertical: 40,
    alignItems: "center",
  },
  dropdownEmptyText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
    fontStyle: "italic",
  },
});
