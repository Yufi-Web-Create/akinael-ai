import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ChatScreen from "./ChatScreen";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("customer chat keyboard behavior", () => {
  test("Enter alone does not send, while Ctrl+Enter sends", () => {
    const onSend = vi.fn();
    render(
      <ChatScreen
        messages={[]}
        chatContext={null}
        busy={false}
        ready={false}
        onSend={onSend}
        onGoToSummary={() => undefined}
      />
    );

    const input = screen.getByLabelText("メッセージ");
    fireEvent.change(input, { target: { value: "相談したい内容" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter", code: "Enter", ctrlKey: true });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("相談したい内容");
  });
});
