import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccessForm } from "./AccessForm";

describe("AccessForm", () => {
  it("submits the typed access key", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(<AccessForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.click(screen.getByRole("button", { name: "进入" }));

    expect(onSubmit).toHaveBeenCalledWith("secret");
  });

  it("trims the access key before submit", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const user = userEvent.setup();

    render(<AccessForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("访问密钥"), "  secret  ");
    await user.click(screen.getByRole("button", { name: "进入" }));

    expect(onSubmit).toHaveBeenCalledWith("secret");
  });

  it("prevents duplicate submissions before pending props update", async () => {
    const onSubmit = vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 25))
    );
    const user = userEvent.setup();

    render(<AccessForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("访问密钥"), "secret");
    await user.dblClick(screen.getByRole("button", { name: "进入" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables controls while pending", () => {
    render(<AccessForm onSubmit={async () => undefined} pending />);

    expect(screen.getByLabelText("访问密钥")).toBeDisabled();
    expect(screen.getByRole("button", { name: "验证中" })).toBeDisabled();
  });

  it("shows an error message", () => {
    render(<AccessForm onSubmit={async () => undefined} error="密钥不正确" />);

    expect(screen.getByText("密钥不正确")).toBeInTheDocument();
  });
});
