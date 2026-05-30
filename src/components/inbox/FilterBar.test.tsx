import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "./FilterBar";

describe("FilterBar", () => {
  it("updates read state, category, and source filters", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <FilterBar
        filters={{ readState: "all" }}
        sources={[
          {
            id: "source-1",
            receivedPhoneNumber: "+8613800000000",
            deviceName: "Redmi 1",
            simSlot: 1,
            label: "Redmi 1 · SIM 1"
          }
        ]}
        onChange={onChange}
      />
    );

    await user.selectOptions(screen.getByLabelText("已读状态"), "unread");
    await user.selectOptions(screen.getByLabelText("分类"), "verification");
    await user.selectOptions(screen.getByLabelText("来源"), "source-1");

    expect(onChange).toHaveBeenCalledWith({ readState: "unread" });
    expect(onChange).toHaveBeenCalledWith({
      readState: "all",
      category: "verification"
    });
    expect(onChange).toHaveBeenCalledWith({
      readState: "all",
      sourceId: "source-1"
    });
  });
});
