import { describe, expect, it } from "vitest";
import { createComposerOperationGate } from "../src/domain/composerOperationGate";

describe("composer async operation scope", () => {
  it("keeps the second A draft intact when the first A acknowledgement arrives after A-to-B-to-A", async () => {
    const gate = createComposerOperationGate();
    let draft = "A submitted";
    let open = true;
    let acknowledge!: () => void;
    const pendingSave = new Promise<void>((resolve) => { acknowledge = resolve; });

    gate.beginSession(); // A
    const tokenA = gate.beginOperation();
    expect(tokenA).not.toBeNull();
    const completionA = (async () => {
      await pendingSave;
      if (tokenA !== null && gate.isCurrent(tokenA)) {
        draft = "";
        open = false;
      }
      gate.endOperation();
    })();

    gate.endSession(); // cancel the first A while its durable write is awaiting acknowledgement
    open = false;
    gate.beginSession(); // B
    draft = "B draft";
    gate.endSession();
    gate.beginSession(); // A again, with a distinct draft session
    draft = "second A draft";
    open = true;
    acknowledge();
    await completionA;

    expect(open).toBe(true);
    expect(draft).toBe("second A draft");
  });

  it("rejects a rapid duplicate while the first consequential save is pending", () => {
    const gate = createComposerOperationGate();
    gate.beginSession();
    expect(gate.beginOperation()).not.toBeNull();
    expect(gate.beginOperation()).toBeNull();
    gate.endOperation();
    expect(gate.beginOperation()).not.toBeNull();
    gate.endOperation();
  });

  it("allows retry after a failed acknowledgement without changing the draft session", () => {
    const gate = createComposerOperationGate();
    gate.beginSession();
    const failedToken = gate.beginOperation();
    gate.endOperation();
    const retryToken = gate.beginOperation();

    expect(retryToken).not.toBeNull();
    expect(failedToken).not.toBeNull();
    expect(retryToken).toBe(failedToken);
    expect(retryToken !== null && gate.isCurrent(retryToken)).toBe(true);
    gate.endOperation();
  });
});
