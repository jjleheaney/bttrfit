import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("keeps same-origin paths, query and fragment included", () => {
    expect(safeNextPath("/today")).toBe("/today");
    expect(safeNextPath("/block/2?week=3")).toBe("/block/2?week=3");
  });

  it("falls back to the root for anything missing or relative", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("today")).toBe("/");
  });

  it("rejects off-origin targets", () => {
    expect(safeNextPath("https://evil.example/")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("rejects control characters used to smuggle headers", () => {
    expect(safeNextPath("/today\nSet-Cookie: a=b")).toBe("/");
  });
});
