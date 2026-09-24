import { afterEach, describe, expect, it } from "vitest";
import {
  chooseWebFocusInvoker,
  chooseWebFocusRestoreTarget,
  isWebFocusEligible,
} from "../src/lib/webFocusEligibility";

type FakeElement = {
  nodeType: number;
  isConnected: boolean;
  disabled?: boolean;
  hidden?: boolean;
  inert?: boolean;
  parentElement: FakeElement | null;
  attributes: Record<string, string>;
  focus: () => void;
  getAttribute: (name: string) => string | null;
  hasAttribute: (name: string) => boolean;
  matches: (selector: string) => boolean;
};

const body = {
  nodeType: 1,
  isConnected: true,
  parentElement: null,
  attributes: {},
  focus: () => undefined,
  getAttribute(name: string) { return this.attributes[name] ?? null; },
  hasAttribute(name: string) { return Object.prototype.hasOwnProperty.call(this.attributes, name); },
  matches: () => false,
} as FakeElement;
const originalDocument = globalThis.document;

const element = (parentElement: FakeElement | null = body): FakeElement => ({
  nodeType: 1,
  isConnected: true,
  parentElement,
  attributes: {},
  focus: () => undefined,
  getAttribute(name) { return this.attributes[name] ?? null; },
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); },
  matches: () => false,
});

const installDocument = () => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { body },
  });
};

afterEach(() => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument,
  });
});

describe("shared web focus eligibility", () => {
  it("rejects an eligible-looking descendant inside an aria-hidden ancestor", () => {
    installDocument();
    const hiddenScope = element();
    hiddenScope.attributes["aria-hidden"] = "true";
    const invoker = element(hiddenScope);
    const fallback = element();

    expect(isWebFocusEligible(invoker)).toBe(false);
    expect(chooseWebFocusInvoker(invoker, fallback)).toBeNull();
    expect(chooseWebFocusRestoreTarget(invoker, fallback)).toBe(fallback);
  });

  it.each([
    ["hidden", (target: FakeElement) => { target.hidden = true; }],
    ["inert", (target: FakeElement) => { target.inert = true; }],
    ["disabled", (target: FakeElement) => { target.disabled = true; }],
    ["aria-disabled", (target: FakeElement) => { target.attributes["aria-disabled"] = "true"; }],
    ["hidden ancestor", (target: FakeElement) => { target.parentElement!.attributes.hidden = ""; }],
    ["inert ancestor", (target: FakeElement) => { target.parentElement!.attributes.inert = ""; }],
  ])("rejects a %s invoker without capturing another active control", (_label, disable) => {
    installDocument();
    const scope = element();
    const invoker = element(scope);
    const activeControl = element();
    const fallback = element();
    disable(invoker);

    expect(chooseWebFocusInvoker(invoker, activeControl)).toBeNull();
    expect(chooseWebFocusRestoreTarget(invoker, fallback)).toBe(fallback);
  });

  it("rejects a removed invoker and preserves the in-scope fallback", () => {
    installDocument();
    const removed = element();
    removed.isConnected = false;
    const fallback = element();

    expect(isWebFocusEligible(removed)).toBe(false);
    expect(chooseWebFocusRestoreTarget(removed, fallback)).toBe(fallback);
  });

  it("captures and restores the exact eligible invoker", () => {
    installDocument();
    const invoker = element();
    const fallback = element();

    expect(chooseWebFocusInvoker(invoker, fallback)).toBe(invoker);
    expect(chooseWebFocusRestoreTarget(invoker, fallback)).toBe(invoker);
  });

  it("uses the active element only when capture has no explicit invoker", () => {
    installDocument();
    const activeElement = element();

    expect(chooseWebFocusInvoker(undefined, activeElement)).toBe(activeElement);
    expect(chooseWebFocusInvoker(null, activeElement)).toBeNull();
  });
});
