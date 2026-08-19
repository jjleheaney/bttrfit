import { describe, expect, it, vi } from "vitest";
import { withClockSkewRetry } from "./clock-skew-fetch";

function skewed() {
  return new Response(
    JSON.stringify({ code: "PGRST303", message: "JWT issued at future" }),
    { status: 401 },
  );
}

describe("withClockSkewRetry", () => {
  it("passes a successful response straight through, unread", async () => {
    const inner = vi.fn(async () => new Response("[]", { status: 200 }));
    const response = await withClockSkewRetry(inner, 0)("/rest/v1/blocks");

    expect(inner).toHaveBeenCalledTimes(1);
    expect(response.bodyUsed).toBe(false);
    expect(await response.text()).toBe("[]");
  });

  it("repeats the request once when the token was rejected as issued in the future", async () => {
    const inner = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(skewed())
      .mockResolvedValueOnce(new Response('[{"id":"1"}]', { status: 200 }));

    const response = await withClockSkewRetry(inner, 0)("/rest/v1/blocks");

    expect(inner).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('[{"id":"1"}]');
  });

  it("gives up after one retry rather than looping", async () => {
    const inner = vi.fn(async () => skewed());
    const response = await withClockSkewRetry(inner, 0)("/rest/v1/blocks");

    expect(inner).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(401);
    // The caller still gets a readable body to throw on.
    expect(await response.text()).toContain("PGRST303");
  });

  it("does not retry other failures, and leaves their bodies readable", async () => {
    const inner = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: "42501", message: "permission denied" }), {
          status: 403,
        }),
    );
    const response = await withClockSkewRetry(inner, 0)("/rest/v1/blocks");

    expect(inner).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("permission denied");
  });

  it("waits before repeating, so the retry is not simply the same instant again", async () => {
    vi.useFakeTimers();
    const inner = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(skewed())
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));

    const pending = withClockSkewRetry(inner, 750)("/rest/v1/blocks");
    await vi.advanceTimersByTimeAsync(700);
    expect(inner).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(inner).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
