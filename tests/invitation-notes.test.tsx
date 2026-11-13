import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClosingNote } from "@/components/invitation/ClosingNote";
import { StoryNote } from "@/components/invitation/StoryNote";
import { demoInvitations } from "@/data/demo-invitations";
import { invitationSchema } from "@/lib/invitation-schema";
import { Afterglow } from "@/templates/afterglow/Afterglow";
import { shellDemoInvitation } from "@/templates/internal/demo-invitation";

afterEach(cleanup);

const origin = "https://invites.example.com";
const photo = {
  src: `${origin}/media/invitations/family.jpg`,
  alt: "The couple laughing with their family",
  caption: "An evening together",
  focalPosition: { x: 0.2, y: 0.8 },
};

describe("StoryNote", () => {
  it("shows the supplied note in a named section", () => {
    render(<StoryNote welcomeNote="We are happy to share this day." />);
    const story = screen.getByRole("region", { name: "A note from us" });
    expect(
      within(story).getByText("We are happy to share this day."),
    ).toBeVisible();
    expect(within(story).queryByRole("img")).toBeNull();
  });

  it("renders nothing without text or trusted media", () => {
    const { container } = render(<StoryNote />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a trusted gallery photo with alt text, caption, and crop", () => {
    render(<StoryNote gallery={[photo]} trustedImageOrigin={origin} />);
    const image = screen.getByRole("img", { name: photo.alt });
    expect(image.getAttribute("src")).toContain(
      encodeURIComponent("/media/invitations/family.jpg"),
    );
    expect(image).toHaveStyle({ objectPosition: "20% 80%" });
    expect(screen.getByText(photo.caption)).toBeVisible();
  });

  it.each([
    "https://other.example.com/media/invitations/family.jpg",
    "https://invites.example.com/api/photo.jpg",
    "https://invites.example.com/media/invitations/family.svg",
    "javascript:alert(1)",
  ])("keeps the note and omits unsupported media (%s)", (src) => {
    render(
      <StoryNote
        welcomeNote="Our story"
        gallery={[{ ...photo, src }]}
        trustedImageOrigin={origin}
      />,
    );
    expect(screen.getByText("Our story")).toBeVisible();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("removes a broken photo and keeps the note", () => {
    render(
      <StoryNote
        welcomeNote="Our story"
        gallery={[photo]}
        trustedImageOrigin={origin}
      />,
    );
    fireEvent.error(screen.getByRole("img", { name: photo.alt }));
    expect(screen.getByText("Our story")).toBeVisible();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText(photo.caption)).toBeNull();
  });

  it("removes the entire section when its only photo fails", () => {
    const { container } = render(
      <StoryNote gallery={[photo]} trustedImageOrigin={origin} />,
    );
    fireEvent.error(screen.getByRole("img", { name: photo.alt }));
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ClosingNote", () => {
  it("renders a message without an empty host list", () => {
    render(
      <ClosingNote closingNote="See you on the dance floor." hosts={[]} />,
    );
    expect(screen.getByText("See you on the dance floor.")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Hosts" })).toBeNull();
  });

  it("supports hosts without a message and keeps long names intact", () => {
    const name = "N".repeat(80);
    render(<ClosingNote hosts={[name, "The other family"]} />);
    expect(
      within(screen.getByRole("list", { name: "Hosts" })).getByText(name),
    ).toBeVisible();
    expect(screen.getByText("The other family")).toBeVisible();
  });

  it("omits the entire closing when all fields are absent", () => {
    const { container } = render(<ClosingNote />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Afterglow notes", () => {
  it("keeps story, schedule and closing in guest reading order without truncating the messages", () => {
    const message = "A".repeat(500);
    const closingNote = "Z".repeat(500);
    const invitation = invitationSchema.parse({
      ...shellDemoInvitation,
      welcomeNote: message,
      closingNote,
    });
    render(<Afterglow invitation={invitation} />);
    const story = screen.getByRole("region", { name: "A note from us" });
    const schedule = screen.getByRole("region", { name: "Celebrate with us" });
    const closing = screen.getByText(closingNote);
    expect(
      story.compareDocumentPosition(schedule) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      schedule.compareDocumentPosition(closing) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(story).getByText(message)).toBeVisible();
    expect(closing).toBeVisible();
    const venues = screen.getByRole("region", { name: "Wedding venues" });
    expect(
      schedule.compareDocumentPosition(venues) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      venues.compareDocumentPosition(closing) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(venues).getByRole("link", { name: /Get Directions/ }),
    ).toBeVisible();
    expect(screen.getByText("The families of Tara and Neel")).toBeVisible();
  });

  it("preserves legacy canonical fixtures and normalizes blank closing notes", () => {
    for (const fixture of demoInvitations) {
      expect(invitationSchema.parse(fixture).closingNote).toBeUndefined();
    }
    expect(
      invitationSchema.parse({ ...shellDemoInvitation, closingNote: "  " })
        .closingNote,
    ).toBeUndefined();
    expect(
      invitationSchema.parse({
        ...shellDemoInvitation,
        closingNote: "  See you soon!  ",
      }).closingNote,
    ).toBe("See you soon!");
    expect(
      invitationSchema.safeParse({
        ...shellDemoInvitation,
        closingNote: "A".repeat(501),
      }).success,
    ).toBe(false);
  });
});
