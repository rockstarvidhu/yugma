import { describe, expect, it } from "vitest";
import { studioReturnPath } from "./studio-path";

describe("studio sign-in return path", () => {
  const draft = "/studio/e1000000-0000-4000-8000-000000000001";

  it("preserves the studio and its draft route", () => {
    expect(studioReturnPath("/studio")).toBe("/studio");
    expect(studioReturnPath(draft)).toBe(draft);
    const checkout = draft.replace("/studio/", "/checkout/");
    expect(studioReturnPath(checkout)).toBe(checkout);
    expect(studioReturnPath("/create/afterglow")).toBe("/create/afterglow");
  });

  it.each([
    "https://example.com/studio",
    "//example.com/studio",
    "/studio/../checkout",
    "/create/../checkout",
    "/create/afterglow?next=https://example.com",
    "/create/%2f%2fexample.com",
    "/studio/%2e%2e/checkout",
    "/studio\\example.com",
    `${draft}?next=https://example.com`,
    null,
  ])("falls back to the studio for %j", (next) => {
    expect(studioReturnPath(next)).toBe("/studio");
  });

  it("rejects repeated next parameters", () => {
    expect(studioReturnPath([draft, "/studio"])).toBe("/studio");
  });
});
