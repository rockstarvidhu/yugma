"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";
import { DemoWatermark } from "@/components/preview/DemoWatermark";
import { InvitationRenderer } from "@/invitations/renderer/InvitationRenderer";
import {
  MAX_EVENTS,
  timeZoneSchema,
  type Invitation,
  type InvitationDraft,
} from "@/lib/invitation-schema";
import type { Draft } from "@/lib/drafts/contract";
import { localEventTime } from "@/lib/preview-invitation";
import {
  getStudioDraft,
  saveStudioDraft,
  type FieldIssue,
} from "@/lib/studio/draft-client";
import {
  prepareStudioPreview,
  readEditorSnapshot,
  type DateFields,
  type DraftEvent,
} from "@/lib/studio/draft-fields";
import { StudioShell } from "./StudioShell";
import { StudioField } from "./StudioField";
import { StudioEventFields } from "./StudioEventFields";

type Problem = {
  message: string;
  status?: number;
  issues?: FieldIssue[];
  signIn?: boolean;
};

function requestProblem(status: number, issues?: FieldIssue[]): Problem {
  switch (status) {
    case 400:
    case 422:
      return {
        status,
        message: "Check the highlighted details and try again.",
        issues,
      };
    case 401:
      return {
        status,
        message:
          "Your session has ended. Sign in again before saving. Your edits are still here.",
      };
    case 404:
      return {
        status,
        message:
          "This draft is unavailable. Your edits are still visible, but this draft cannot be saved.",
      };
    case 409:
      return {
        status,
        message:
          "This draft changed in another session. Your edits are still here. Load the latest saved copy before editing it again.",
      };
    case 413:
      return {
        status,
        message:
          "This draft is too large. Shorten the text or remove details, then try again. Your edits are still here.",
      };
    default:
      return {
        status,
        message:
          "We couldn’t confirm the save. Your edits are still here. Try again.",
      };
  }
}

export function StudioEditor({
  initialDraft,
  templateName,
  checkout,
}: {
  initialDraft: Draft;
  templateName: string;
  checkout?: ReactNode;
}) {
  const [saved, setSaved] = useState(initialDraft);
  const [draft, setDraft] = useState(initialDraft.data);
  const [dates, setDates] = useState<DateFields>({});
  const [hosts, setHosts] = useState(initialDraft.data.hosts?.join("\n") ?? "");
  const [busy, setBusy] = useState<"save" | "reload">();
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState<Problem>();
  const [confirmReload, setConfirmReload] = useState(false);
  const [preview, setPreview] = useState<{
    invitation: Invitation;
    skipped: number;
  }>();
  const running = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLHeadingElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);
  const eventHeading = useRef<HTMLHeadingElement>(null);
  const newEvent = useRef<string | null>(null);
  const restoreFocus = useRef(false);
  const savedHostsText = saved.data.hosts?.join("\n") ?? "";
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(saved.data) ||
    Object.keys(dates).length > 0 ||
    hosts !== savedHostsText;
  const signIn = `/sign-in?next=${encodeURIComponent(`/studio/${saved.id}`)}`;
  const zone = timeZoneSchema.safeParse(draft.timeZone);
  const displayZone = zone.success ? zone.data : "UTC";
  const fieldErrors = Object.fromEntries(
    (problem?.issues ?? []).map(({ path, message }) => [
      path.replace(/^data\./, ""),
      message,
    ]),
  );

  useEffect(() => {
    if (!dirty) return;
    function protect(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  useEffect(() => {
    if (problem) errorRef.current?.focus();
  }, [problem]);
  useEffect(() => {
    if (preview) previewRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      previewButton.current?.focus();
    }
  }, [preview]);

  useEffect(() => {
    if (!newEvent.current) return;
    const index =
      draft.events?.findIndex(({ id }) => id === newEvent.current) ?? -1;
    if (index >= 0) {
      newEvent.current = null;
      document.getElementById(`studio-events-${index}-title`)?.focus();
    }
  }, [draft.events]);

  function markEdited() {
    setNotice("");
    setProblem((current) => {
      if (
        !current ||
        current.status === undefined ||
        current.status === 400 ||
        current.status === 422
      )
        return undefined;
      return current;
    });
  }

  function update(patch: Partial<InvitationDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    markEdited();
  }

  function updateEvent(id: string, patch: Partial<DraftEvent>) {
    setDraft((current) => ({
      ...current,
      events: current.events?.map((event) =>
        event.id === id ? { ...event, ...patch } : event,
      ),
    }));
    markEdited();
  }

  function removeEvent(id: string) {
    eventHeading.current?.focus();
    setDraft((current) => ({
      ...current,
      events: current.events?.filter((event) => event.id !== id),
    }));
    setDates((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    markEdited();
  }

  function addEvent() {
    if ((draft.events?.length ?? 0) >= MAX_EVENTS) return;
    const id = crypto.randomUUID();
    newEvent.current = id;
    setDraft((current) => {
      if ((current.events?.length ?? 0) >= MAX_EVENTS) return current;
      return { ...current, events: [...(current.events ?? []), { id }] };
    });
    markEdited();
  }

  function snapshot(): ReturnType<typeof readEditorSnapshot> {
    const invalidDates = Array.from(
      formRef.current?.querySelectorAll<HTMLInputElement>(
        'input[type="datetime-local"]',
      ) ?? [],
    ).flatMap((input, index) =>
      input.validity.badInput
        ? [
            {
              path: `events.${index}.startsAt`,
              message:
                "Complete the ceremony date and time or clear the field.",
            },
          ]
        : [],
    );
    if (invalidDates.length) return { issues: invalidDates };

    // A host name can already contain a newline in a saved API draft.
    const entries =
      hosts === savedHostsText
        ? saved.data.hosts
        : hosts
            .split("\n")
            .map((host) => host.trim())
            .filter(Boolean);
    return readEditorSnapshot(
      {
        ...draft,
        hosts:
          hosts === savedHostsText || entries?.length ? entries : undefined,
      },
      dates,
    );
  }

  function accept(current: Draft, message: string) {
    setSaved(current);
    setDraft(current.data);
    setDates({});
    setHosts(current.data.hosts?.join("\n") ?? "");
    setProblem(undefined);
    setConfirmReload(false);
    setNotice(message);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      running.current ||
      confirmReload ||
      problem?.status === 409 ||
      problem?.status === 404
    )
      return;
    const parsed = snapshot();
    if (!parsed.snapshot) {
      setProblem({
        message: "Check the highlighted details and try again.",
        issues: parsed.issues,
      });
      return;
    }
    running.current = true;
    setBusy("save");
    setProblem(undefined);
    setNotice("");
    const result = await saveStudioDraft(saved.id, {
      data: parsed.snapshot,
      schemaVersion: saved.schemaVersion,
      expectedVersion: saved.version,
    });
    if (
      "draft" in result &&
      result.draft.id === saved.id &&
      result.draft.templateKey === saved.templateKey &&
      result.draft.version > saved.version
    )
      accept(result.draft, "Draft saved.");
    else
      setProblem(
        "status" in result
          ? requestProblem(result.status, result.issues)
          : requestProblem(0),
      );
    running.current = false;
    setBusy(undefined);
  }

  async function reload() {
    if (running.current) return;
    running.current = true;
    setBusy("reload");
    const result = await getStudioDraft(saved.id);
    if (
      "draft" in result &&
      result.draft.id === saved.id &&
      result.draft.templateKey === saved.templateKey &&
      result.draft.version > saved.version
    ) {
      accept(result.draft, "Latest saved draft loaded.");
    } else {
      const status = "status" in result ? result.status : 0;
      const message =
        status === 401
          ? "Sign in again to load the latest saved copy. Your edits are still here."
          : status === 404
            ? "This draft is unavailable. Your edits are still visible."
            : "We couldn’t load the latest saved copy. Your edits are still here. Try loading it again.";
      setProblem({ message, status: 409, signIn: status === 401 });
    }
    running.current = false;
    setBusy(undefined);
  }

  function showPreview() {
    const parsed = snapshot();
    if (!parsed.snapshot) {
      if (problem?.status === 409 || problem?.status === 404) {
        setNotice("Correct the draft details before previewing.");
      } else {
        setProblem({
          message: "Fix the highlighted details before previewing.",
          issues: parsed.issues,
        });
      }
      return;
    }
    const next = prepareStudioPreview(parsed.snapshot);
    if (next.invitation)
      setPreview({ invitation: next.invitation, skipped: next.skipped });
    else setNotice(next.guidance);
  }

  if (preview)
    return (
      <>
        <header className="studio-preview-header">
          <div>
            <h1 className="studio-heading" ref={previewRef} tabIndex={-1}>
              Private draft preview
            </h1>
            <p className="text-sm">
              This preview includes your current edits.
              {preview.skipped > 0 &&
                " Incomplete ceremonies are hidden until their details are filled in."}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              restoreFocus.current = true;
              setPreview(undefined);
            }}
          >
            Back to editor
          </Button>
        </header>
        <DemoWatermark mode="personalized" />
        <InvitationRenderer
          templateId={saved.templateKey}
          invitation={preview.invitation}
        />
      </>
    );

  return (
    <StudioShell
      title={`Edit ${templateName}`}
      back={
        <Link
          href="/studio"
          prefetch={false}
          className="studio-link"
          onNavigate={(event) => {
            if (
              dirty &&
              !window.confirm("Leave Studio and discard your unsaved edits?")
            )
              event.preventDefault();
          }}
        >
          Back to Studio
        </Link>
      }
    >
      <p>
        Your draft is private. Save what you have, even when details are still
        missing.
      </p>
      <form
        ref={formRef}
        aria-label="Invitation editor"
        className="studio-form"
        onSubmit={save}
        noValidate
      >
        <div className="studio-actions">
          <span role="status">
            {busy === "save"
              ? "Saving draft…"
              : busy === "reload"
                ? "Loading latest draft…"
                : dirty
                  ? "Unsaved changes"
                  : problem
                    ? "Draft needs attention"
                    : notice || "All changes saved"}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              ref={previewButton}
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={showPreview}
            >
              Preview invitation
            </Button>
            <Button
              type="submit"
              disabled={
                Boolean(busy) ||
                confirmReload ||
                problem?.status === 409 ||
                problem?.status === 404
              }
            >
              Save draft
            </Button>
          </div>
        </div>
        {dirty && notice && <p role="status">{notice}</p>}
        {problem && (
          <div
            className="studio-panel studio-error"
            ref={errorRef}
            role="alert"
            tabIndex={-1}
          >
            <p>{problem.message}</p>
            {problem.issues?.length ? (
              <ul className="list-disc pl-5">
                {problem.issues.map(({ path, message }, index) => (
                  <li key={`${path}-${index}`}>{message}</li>
                ))}
              </ul>
            ) : null}
            {(problem.status === 401 || problem.signIn) && (
              <a
                href={signIn}
                target="_blank"
                rel="noopener noreferrer"
                className="studio-link"
              >
                Sign in again in a new tab
              </a>
            )}
            {problem.status === 409 &&
              (!confirmReload ? (
                <div>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmReload(true)}
                  >
                    Load latest saved copy
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2">
                  <p>
                    Loading the latest copy will discard these unsaved edits.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={Boolean(busy)}
                      onClick={reload}
                    >
                      Discard edits and reload
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={Boolean(busy)}
                      onClick={() => setConfirmReload(false)}
                    >
                      Keep editing
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}
        <fieldset disabled={Boolean(busy)} className="studio-events">
          <legend>Invitation details</legend>
          <div className="studio-grid">
            <StudioField
              path="couple.partnerOne"
              label="Partner 1 name"
              value={draft.couple?.partnerOne}
              onChange={(partnerOne) =>
                update({ couple: { ...draft.couple, partnerOne } })
              }
              issues={fieldErrors}
            />
            <StudioField
              path="couple.partnerTwo"
              label="Partner 2 name"
              value={draft.couple?.partnerTwo}
              onChange={(partnerTwo) =>
                update({ couple: { ...draft.couple, partnerTwo } })
              }
              issues={fieldErrors}
            />
          </div>
          <StudioField
            path="timeZone"
            label="Wedding timezone"
            value={draft.timeZone}
            onChange={(timeZone) => update({ timeZone })}
            hint="Use a timezone such as Asia/Kolkata or Europe/London. Dates and times below use this timezone."
            issues={fieldErrors}
          />
          <StudioField
            path="welcomeNote"
            label="Welcome message"
            multiline
            value={draft.welcomeNote}
            onChange={(welcomeNote) => update({ welcomeNote })}
            issues={fieldErrors}
          />
          <StudioField
            path="closingNote"
            label="Closing message"
            multiline
            value={draft.closingNote}
            onChange={(closingNote) => update({ closingNote })}
            issues={fieldErrors}
          />
          <StudioField
            path="hosts"
            label="Hosts"
            multiline
            value={hosts}
            onChange={(value) => {
              setHosts(value);
              markEdited();
            }}
            hint="Enter one host name per line."
            issues={{
              ...fieldErrors,
              hosts:
                fieldErrors.hosts ??
                Object.entries(fieldErrors).find(([key]) =>
                  key.startsWith("hosts."),
                )?.[1] ??
                "",
            }}
          />
        </fieldset>
        <section className="studio-events" aria-labelledby="studio-ceremonies">
          <h2
            id="studio-ceremonies"
            className="font-editorial text-2xl"
            ref={eventHeading}
            tabIndex={-1}
          >
            Wedding ceremonies
          </h2>
          <p className="text-sm">
            Set the wedding date and time on the main ceremony. A date and time
            you enter is interpreted in the wedding timezone.
          </p>
          {draft.events?.map((event, index) => (
            <StudioEventFields
              key={event.id}
              event={event}
              index={index}
              issues={fieldErrors}
              disabled={Boolean(busy)}
              localDate={
                Object.hasOwn(dates, event.id)
                  ? dates[event.id]
                  : event.startsAt
                    ? localEventTime(event.startsAt, displayZone)
                    : ""
              }
              update={(patch) => updateEvent(event.id, patch)}
              remove={() => removeEvent(event.id)}
              updateDate={(value) => {
                setDates((current) => ({ ...current, [event.id]: value }));
                markEdited();
              }}
            />
          ))}
          <div>
            <Button
              variant="secondary"
              disabled={
                Boolean(busy) || (draft.events?.length ?? 0) >= MAX_EVENTS
              }
              onClick={addEvent}
            >
              Add ceremony
            </Button>
          </div>
        </section>
      </form>
      {checkout}
    </StudioShell>
  );
}
