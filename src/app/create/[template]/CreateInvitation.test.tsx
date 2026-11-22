import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateInvitation } from "./CreateInvitation";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  router.replace.mockClear();
});

describe("CreateInvitation", () => {
  it("locks repeated submits and opens the server-returned draft only once", async () => {
    let resolve!: (response: Response) => void;
    const request = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("fetch", request);
    render(<CreateInvitation templateKey="afterglow" />);
    const create = screen.getByRole("button", { name: "Create private draft" });
    const form = create.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "/api/drafts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          templateKey: "afterglow",
          schemaVersion: 1,
          data: {},
        }),
      }),
    );
    expect(create).toBeDisabled();
    const id = "e1000000-0000-4000-8000-000000000001";
    resolve(
      Response.json(
        {
          draft: {
            id,
            templateId: id,
            templateKey: "afterglow",
            schemaVersion: 1,
            version: 1,
            updatedAt: "2026-11-22T09:00:00Z",
            data: {},
          },
        },
        { status: 201 },
      ),
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/studio/${id}`),
    );
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("preserves the creation destination when sign-in expires", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({}, { status: 401 })),
    );
    render(<CreateInvitation templateKey="afterglow" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Create private draft" }),
    );
    expect(
      await screen.findByRole("link", { name: "Sign in again" }),
    ).toHaveAttribute("href", "/sign-in?next=%2Fcreate%2Fafterglow");
    expect(router.replace).not.toHaveBeenCalled();
  });
});
