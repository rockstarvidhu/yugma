import { describe, expect, it } from "vitest";
import { readEditorSnapshot } from "./draft-fields";

describe("Studio local ceremony dates", () => {
  const timeZone = "Australia/Lord_Howe";
  it("round-trips a newly entered ambiguous time to its earlier occurrence", () => {
    const result = readEditorSnapshot(
      { timeZone, events: [{ id: "event" }] },
      { event: "2026-04-05T01:45" },
    );
    expect(result.snapshot?.events?.[0].startsAt).toBe(
      "2026-04-04T14:45:00.000Z",
    );
  });
  it("rejects nonexistent local times and retains the field's error path", () => {
    const result = readEditorSnapshot(
      { timeZone, events: [{ id: "event" }] },
      { event: "2026-10-04T02:15" },
    );
    expect(result.issues).toContainEqual({
      path: "events.0.startsAt",
      message: expect.stringMatching(/does not exist/),
    });
  });
  it("keeps the exact original ambiguous timestamp when the local time is unchanged", () => {
    const original = "2026-04-05T01:45:59.123+10:30";
    const result = readEditorSnapshot(
      { timeZone, events: [{ id: "event", startsAt: original }] },
      { event: "2026-04-05T01:45" },
    );
    expect(result.snapshot?.events?.[0].startsAt).toBe(original);
  });
});
