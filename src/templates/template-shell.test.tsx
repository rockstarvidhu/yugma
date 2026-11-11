import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Afterglow } from "./afterglow/Afterglow";
import { createTemplateRegistry, templateRegistry } from "./registry";
import { shellDemoInvitation } from "./internal/demo-invitation";
import { InvitationRenderer } from "@/invitations/renderer/InvitationRenderer";
import AfterglowDemo, { metadata } from "@/app/demo/afterglow/page";
import type { InvitationTemplateProps } from "./types";

afterEach(cleanup);

describe("template registry and renderer", () => {
  it("looks up the stable Afterglow ID", () => {
    expect(templateRegistry.get("afterglow")?.Component).toBe(Afterglow);
  });
  it.each(["unknown", "", "__proto__", "constructor"])(
    "safely handles unsupported ID %s",
    (id) => {
      expect(templateRegistry.get(id)).toBeUndefined();
      render(
        <InvitationRenderer templateId={id} invitation={shellDemoInvitation} />,
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "template is unavailable",
      );
      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    },
  );
  it("rejects duplicate IDs", () => {
    expect(() =>
      createTemplateRegistry([
        { id: "same", Component: Afterglow },
        { id: "same", Component: Afterglow },
      ]),
    ).toThrow("Duplicate template ID");
  });
  it.each(["", " ", " afterglow"])("rejects invalid registered ID %s", (id) => {
    expect(() =>
      createTemplateRegistry([{ id, Component: Afterglow }]),
    ).toThrow("non-empty and trimmed");
  });
  it("renders supplied names, welcome, events and venues with explicit timezone", () => {
    const invitation = {
      ...shellDemoInvitation,
      names: ["Alex", "Sam"] as const,
      welcome: "Our own welcome",
      timeZone: "UTC",
      events: [
        {
          id: "new",
          title: "An evening together",
          startsAt: "2027-12-12T12:00:00Z",
          venue: "Orchid House",
          address: "Fictional address",
        },
        {
          id: "second",
          title: "Morning gathering",
          startsAt: "2027-12-13T10:00:00Z",
          venue: "Garden Court",
          address: "Another fictional address",
        },
      ],
    };
    render(
      <InvitationRenderer templateId="afterglow" invitation={invitation} />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Alex & Sam",
    );
    expect(screen.getByText("Our own welcome")).toBeInTheDocument();
    expect(screen.queryByText("Tara")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "An evening together" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Morning gathering" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Orchid House")).toBeInTheDocument();
    expect(screen.getByText("Fictional address")).toBeInTheDocument();
    expect(
      screen.getByText(/12 December 2027/).closest("time"),
    ).toHaveAttribute("datetime", "2027-12-12T12:00:00Z");
    expect(screen.getByText(/12 December 2027/)).toHaveTextContent("12:00");
  });
  it("renders another registered component without renderer changes", () => {
    function Second({ invitation }: InvitationTemplateProps) {
      return <h1>A second style for {invitation.names[0]}</h1>;
    }
    const registry = createTemplateRegistry([
      { id: "afterglow", Component: Afterglow },
      { id: "second", Component: Second },
    ]);
    render(
      <InvitationRenderer
        registry={registry}
        templateId="second"
        invitation={shellDemoInvitation}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "A second style for Tara" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Celebrate with us")).not.toBeInTheDocument();
  });
  it("shows a demo watermark and fictional invitation on the route", () => {
    render(<AfterglowDemo />);
    expect(
      screen.getByRole("complementary", { name: "Demo preview" }),
    ).toHaveTextContent("YUGMA DEMO");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Tara & Neel",
    );
    expect(
      screen.getByRole("link", { name: /The celebration/ }),
    ).toHaveAttribute("href", "#celebration");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
  it("does not couple demo branding to the core renderer", () => {
    render(
      <InvitationRenderer
        templateId="afterglow"
        invitation={shellDemoInvitation}
      />,
    );
    expect(screen.queryByText("YUGMA DEMO")).not.toBeInTheDocument();
  });
});
