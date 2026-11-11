import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  demoInvitations,
  singleEventInvitation,
  multiEventInvitation,
} from "@/data/demo-invitations";
import {
  invitationSchema,
  weddingEventSchema,
  weddingVenueSchema,
  partnerSchema,
  coupleSchema,
  invitationImageSchema,
  focalPositionSchema,
  MAX_EVENTS,
  MAX_GALLERY_IMAGES,
} from "@/lib/invitation-schema";
import type {
  Invitation,
  WeddingEvent,
  WeddingVenue,
  Partner,
  Couple,
  InvitationImage,
  FocalPosition,
} from "@/types/invitation";

const image = {
  src: "https://example.com/licensed-photo.jpg",
  alt: "The fictional partners walking through a garden",
};
const base = () => structuredClone(singleEventInvitation);
const withDate = (startsAt: string) => ({
  ...base(),
  events: [{ ...base().events[0], startsAt }],
});

describe("canonical invitation contract", () => {
  it("exports only schema-derived public models", () => {
    expectTypeOf<Invitation>().toEqualTypeOf<
      z.infer<typeof invitationSchema>
    >();
    expectTypeOf<WeddingEvent>().toEqualTypeOf<
      z.infer<typeof weddingEventSchema>
    >();
    expectTypeOf<WeddingVenue>().toEqualTypeOf<
      z.infer<typeof weddingVenueSchema>
    >();
    expectTypeOf<Partner>().toEqualTypeOf<z.infer<typeof partnerSchema>>();
    expectTypeOf<Couple>().toEqualTypeOf<z.infer<typeof coupleSchema>>();
    expectTypeOf<InvitationImage>().toEqualTypeOf<
      z.infer<typeof invitationImageSchema>
    >();
    expectTypeOf<FocalPosition>().toEqualTypeOf<
      z.infer<typeof focalPositionSchema>
    >();
  });
  it("parses fictional single and multi-ceremony fixtures without photographs", () => {
    for (const data of demoInvitations) {
      const parsed = invitationSchema.parse(data);
      expect(parsed.coverImage).toBeUndefined();
      expect(parsed.gallery).toBeUndefined();
    }
    expect(invitationSchema.parse(multiEventInvitation).events).toHaveLength(3);
  });
  it.each(["couple", "timeZone", "events"])("requires %s", (key) => {
    expect(
      invitationSchema.safeParse({ ...base(), [key]: undefined }).success,
    ).toBe(false);
  });
  it.each(["partnerOne", "partnerTwo"])("requires partner %s", (key) => {
    expect(
      invitationSchema.safeParse({
        ...base(),
        couple: { ...base().couple, [key]: undefined },
      }).success,
    ).toBe(false);
  });
  it.each(["id", "title", "startsAt", "venue"])("requires event %s", (key) => {
    expect(
      weddingEventSchema.safeParse({ ...base().events[0], [key]: undefined })
        .success,
    ).toBe(false);
  });
  it.each(["name", "address", "mapsUrl"])("requires venue %s", (key) => {
    expect(
      weddingVenueSchema.safeParse({
        ...base().events[0].venue,
        [key]: undefined,
      }).success,
    ).toBe(false);
  });
  it.each(["", "   "])("rejects blank event ID %j", (id) => {
    expect(
      weddingEventSchema.safeParse({ ...base().events[0], id }).success,
    ).toBe(false);
  });
  it("rejects duplicate normalized IDs with an explicit issue path", () => {
    const event = base().events[0];
    const result = invitationSchema.safeParse({
      ...base(),
      events: [
        event,
        { ...event, id: ` ${event.id} `, title: "Another ceremony" },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["events", 1, "id"],
          message: "Event IDs must be unique within an invitation.",
        }),
      ]),
    );
  });
  it("preserves IDs across renamed, reordered and identically titled ceremonies", () => {
    const events = [...multiEventInvitation.events]
      .reverse()
      .map((event) => ({ ...event, title: "Celebration" }));
    expect(
      invitationSchema
        .parse({ ...multiEventInvitation, events })
        .events.map((event) => event.id),
    ).toEqual(events.map((event) => event.id));
  });
  it.each([1, 2, MAX_EVENTS])("accepts %i unique events", (count) => {
    const events = Array.from({ length: count }, (_, i) => ({
      ...base().events[0],
      id: `test-only-${i}`,
    }));
    expect(invitationSchema.parse({ ...base(), events }).events).toHaveLength(
      count,
    );
  });
  it.each([0, MAX_EVENTS + 1])("rejects %i events", (count) => {
    const events = Array.from({ length: count }, (_, i) => ({
      ...base().events[0],
      id: `test-only-${i}`,
    }));
    expect(invitationSchema.safeParse({ ...base(), events }).success).toBe(
      false,
    );
  });
  it.each([79, 80])("accepts a %i-character partner name", (length) => {
    expect(
      invitationSchema.safeParse({
        ...base(),
        couple: { partnerOne: "A".repeat(length), partnerTwo: "Morgan" },
      }).success,
    ).toBe(true);
  });
  it.each(["", " ", "A".repeat(81)])(
    "rejects invalid name boundary %#",
    (name) => {
      expect(partnerSchema.safeParse(name).success).toBe(false);
    },
  );
  it("normalizes blank optional text but rejects non-string values", () => {
    const parsed = invitationSchema.parse({
      ...base(),
      welcomeNote: " ",
      events: [{ ...base().events[0], dressCode: "" }],
      coverImage: { ...image, caption: "\t" },
    });
    expect(parsed.welcomeNote).toBeUndefined();
    expect(parsed.events[0].dressCode).toBeUndefined();
    expect(parsed.coverImage?.caption).toBeUndefined();
    expect(
      invitationSchema.safeParse({ ...base(), welcomeNote: 42 }).success,
    ).toBe(false);
  });
  it("retains nonblank optional text and enforces lengths and host limits", () => {
    expect(
      invitationSchema.parse({ ...base(), welcomeNote: " Welcome " })
        .welcomeNote,
    ).toBe("Welcome");
    expect(
      invitationSchema.safeParse({ ...base(), welcomeNote: "A".repeat(501) })
        .success,
    ).toBe(false);
    expect(
      weddingEventSchema.safeParse({
        ...base().events[0],
        dressCode: "A".repeat(101),
      }).success,
    ).toBe(false);
    expect(
      invitationSchema.safeParse({ ...base(), hosts: Array(11).fill("Host") })
        .success,
    ).toBe(false);
  });
});

describe("optional media", () => {
  it.each([0, 1, 3, MAX_GALLERY_IMAGES])(
    "accepts %i gallery images",
    (count) => {
      const parsed = invitationSchema.parse({
        ...base(),
        gallery: Array.from({ length: count }, () => ({ ...image })),
      });
      expect(parsed.gallery).toHaveLength(count);
    },
  );
  it("accepts one cover and preserves captions and normalized focal coordinates", () => {
    const coverImage = {
      ...image,
      caption: " Garden portrait ",
      focalPosition: { x: 0, y: 1 },
    };
    expect(
      invitationSchema.parse({ ...base(), coverImage }).coverImage,
    ).toEqual({ ...coverImage, caption: "Garden portrait" });
  });
  it("rejects too many gallery images", () => {
    expect(
      invitationSchema.safeParse({
        ...base(),
        gallery: Array(MAX_GALLERY_IMAGES + 1).fill(image),
      }).success,
    ).toBe(false);
  });
  it.each([undefined, "", " ", "a".repeat(241)])(
    "requires bounded descriptive alt text %#",
    (alt) => {
      expect(invitationImageSchema.safeParse({ ...image, alt }).success).toBe(
        false,
      );
    },
  );
  it("rejects oversized captions and invalid focal positions", () => {
    expect(
      invitationImageSchema.safeParse({ ...image, caption: "a".repeat(501) })
        .success,
    ).toBe(false);
    for (const focalPosition of [
      { x: -0.1, y: 0 },
      { x: 0, y: 1.1 },
      { x: 0 },
      { x: Infinity, y: 0 },
      { x: "0.5", y: 0 },
    ]) {
      expect(
        invitationImageSchema.safeParse({ ...image, focalPosition }).success,
      ).toBe(false);
    }
  });
  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,abc",
    "file:///tmp/a.png",
    "ftp://example.com/a.jpg",
    "not a URL",
    "https://user:pass@example.com/a.jpg",
    "https://user@example.com/a.jpg",
  ])("rejects unsafe/malformed URL %s in every URL field", (src) => {
    expect(
      invitationSchema.safeParse({ ...base(), coverImage: { ...image, src } })
        .success,
    ).toBe(false);
    expect(
      invitationSchema.safeParse({ ...base(), gallery: [{ ...image, src }] })
        .success,
    ).toBe(false);
    expect(
      weddingVenueSchema.safeParse({ ...base().events[0].venue, mapsUrl: src })
        .success,
    ).toBe(false);
  });
  it.each(["http://example.com/photo.jpg", "https://example.com/photo.jpg"])(
    "accepts credential-free HTTP(S): %s",
    (src) => {
      expect(invitationImageSchema.safeParse({ ...image, src }).success).toBe(
        true,
      );
    },
  );
  it("rejects overlong URLs", () => {
    expect(
      invitationImageSchema.safeParse({
        ...image,
        src: "https://example.com/" + "a".repeat(2048),
      }).success,
    ).toBe(false);
  });
});

describe("time semantics", () => {
  it("accepts equivalent UTC and offset instants", () => {
    const a = invitationSchema.parse(withDate("2027-02-14T10:30:00+05:30"));
    const b = invitationSchema.parse(withDate("2027-02-14T05:00:00Z"));
    expect(Date.parse(a.events[0].startsAt)).toBe(
      Date.parse(b.events[0].startsAt),
    );
  });
  it.each(["Asia/Kolkata", "Europe/London", "America/New_York", "UTC"])(
    "accepts IANA timezone %s",
    (timeZone) => {
      expect(
        invitationSchema.safeParse({
          ...withDate("2027-07-14T05:00:00Z"),
          timeZone,
        }).success,
      ).toBe(true);
    },
  );
  it.each(["", "Mars/Olympus", "+05:30"])(
    "rejects invalid timezone %j",
    (timeZone) => {
      expect(invitationSchema.safeParse({ ...base(), timeZone }).success).toBe(
        false,
      );
    },
  );
  it.each([
    "2027-02-29T10:00:00Z",
    "2028-02-30T10:00:00Z",
    "2027-04-31T10:00:00Z",
    "2027-13-01T10:00:00Z",
    "2027-02-14T25:00:00+05:30",
    "2027-02-14T10:60:00Z",
    "2027-02-14T10:00:00+99:99",
    "2027-02-14T10:00:00",
    "2027-02-14",
    "not a date",
  ])("rejects invalid datetime %s", (startsAt) => {
    expect(invitationSchema.safeParse(withDate(startsAt)).success).toBe(false);
  });
  it("accepts a real leap day and DST offset representations", () => {
    expect(
      invitationSchema.safeParse(withDate("2028-02-29T10:00:00Z")).success,
    ).toBe(true);
    for (const startsAt of [
      "2027-11-07T01:30:00-04:00",
      "2027-11-07T01:30:00-05:00",
    ]) {
      expect(
        invitationSchema.safeParse({
          ...withDate(startsAt),
          timeZone: "America/New_York",
        }).success,
      ).toBe(true);
    }
  });
});
