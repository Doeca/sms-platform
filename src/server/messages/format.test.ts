import { describe, expect, it } from "vitest";
import { formatSourceLabel } from "./format";

describe("formatSourceLabel", () => {
  it("prefers device name plus SIM slot", () => {
    expect(
      formatSourceLabel({
        receivedPhoneNumber: "+8613800000000",
        deviceName: "Redmi 1",
        simSlot: 2
      })
    ).toBe("Redmi 1 · SIM 2");
  });

  it("falls back to device name", () => {
    expect(
      formatSourceLabel({
        receivedPhoneNumber: "+8613800000000",
        deviceName: "Redmi 1",
        simSlot: null
      })
    ).toBe("Redmi 1");
  });

  it("falls back to receiving phone number", () => {
    expect(
      formatSourceLabel({
        receivedPhoneNumber: "+8613800000000",
        deviceName: null,
        simSlot: null
      })
    ).toBe("+8613800000000");
  });
});
