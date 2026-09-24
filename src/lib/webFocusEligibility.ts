type WebFocusElement = Element & {
  disabled?: boolean;
  focus: () => void;
  hidden?: boolean;
  inert?: boolean;
  isConnected?: boolean;
  parentElement?: WebFocusElement | null;
};

const hasAttribute = (element: WebFocusElement, name: string) =>
  element.hasAttribute?.(name) ?? element.getAttribute(name) !== null;

const isUnavailable = (element: WebFocusElement) => {
  const ariaHidden = element.getAttribute("aria-hidden")?.trim().toLowerCase() === "true";
  const ariaDisabled = element.getAttribute("aria-disabled")?.trim().toLowerCase() === "true";
  if (
    ariaHidden ||
    ariaDisabled ||
    element.hidden === true ||
    element.inert === true ||
    element.disabled === true ||
    hasAttribute(element, "hidden") ||
    hasAttribute(element, "inert") ||
    hasAttribute(element, "disabled")
  ) return true;

  const view = element.ownerDocument?.defaultView;
  if (view) {
    const style = view.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return true;
  }
  return false;
};

/** A web focus target must remain available through its entire ancestor scope. */
export const isWebFocusEligible = (target: unknown): target is WebFocusElement => {
  if (typeof document === "undefined" || !target || typeof target !== "object") return false;
  const element = target as WebFocusElement;
  if (
    target === document.body ||
    element.nodeType !== 1 ||
    element.isConnected !== true ||
    element.getAttribute("tabindex") === "-1" ||
    typeof element.focus !== "function"
  ) return false;

  for (let ancestor: WebFocusElement | null = element; ancestor; ancestor = ancestor.parentElement ?? null) {
    if (isUnavailable(ancestor)) return false;
  }
  try {
    if (element.matches(":disabled")) return false;
  } catch {
    // Minimal DOM shims may not implement selector matching.
  }
  return true;
};

/** Explicit invalid invokers do not fall through to another active control. */
export const chooseWebFocusInvoker = (invoker: unknown, activeElement: unknown) => {
  const candidate = invoker === undefined ? activeElement : invoker;
  return isWebFocusEligible(candidate) ? candidate : null;
};

/** Restore to the exact invoker when eligible, otherwise to the scoped fallback. */
export const chooseWebFocusRestoreTarget = (invoker: unknown, fallback: unknown) =>
  [invoker, fallback].find(isWebFocusEligible) ?? null;
