import { describe, expect, it } from "vitest";
import {
  demoInvitations,
  multiEventInvitation,
  singleEventInvitation,
} from "@/data/demo-invitations";
import { invitationSchema } from "@/lib/invitation-schema";

describe("invitation schema", () => {
  it("accepts both fictional demo invitations", () => {
    expect(invitationSchema.safeParse(singleEventInvitation).success).toBe(
      true,
    );
    expect(invitationSchema.safeParse(multiEventInvitation).success).toBe(true);
    expect(demoInvitations).toHaveLength(2);
  });

  it("requires between one and five wedding functions", () => {
    const base = singleEventInvitation;
    expect(invitationSchema.safeParse({ ...base, events: [] }).success).toBe(
      false,
    );
    expect(
      invitationSchema.safeParse({
        ...base,
        events: Array.from({ length: 6 }, (_, index) => ({
          ...base.events[0],
          title: `Function ${index + 1}`,
        })),
      }).success,
    ).toBe(false);
  });

  it("reports invalid image and map URLs clearly", () => {
    const invalidCover = invitationSchema.safeParse({
      ...singleEventInvitation,
      coverImage: "not a URL",
    });
    const invalidMap = invitationSchema.safeParse({
      ...singleEventInvitation,
      events: [
        {
          ...singleEventInvitation.events[0],
          venue: {
            ...singleEventInvitation.events[0].venue,
            mapsUrl: "javascript:alert(1)",
          },
        },
      ],
    });

    expect(invalidCover.success).toBe(false);
    expect(invalidCover.error?.issues[0].message).toMatch(/valid URL/i);
    expect(invalidMap.success).toBe(false);
    expect(invalidMap.error?.issues[0].message).toMatch(/http or https/i);
  });

  it("requires both couple names", () => {
    const result = invitationSchema.safeParse({
      ...singleEventInvitation,
      couple: { partnerOne: "", partnerTwo: "Rohan Iyer" },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(
      /First couple name is required/i,
    );
  });

  it("rejects text that exceeds its field limit", () => {
    const result = invitationSchema.safeParse({
      ...singleEventInvitation,
      welcomeNote: "A".repeat(501),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/500 characters or fewer/i);
  });

  it("requires the explicit Asia/Kolkata offset for event times", () => {
    const result = invitationSchema.safeParse({
      ...singleEventInvitation,
      events: [
        {
          ...singleEventInvitation.events[0],
          startsAt: "2027-02-14T10:30:00Z",
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/Asia\/Kolkata offset/i);
  });
});
