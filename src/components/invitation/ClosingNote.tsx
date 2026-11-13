import type { Invitation } from "@/types/invitation";

export function ClosingNote({
  closingNote,
  hosts,
}: Pick<Invitation, "closingNote" | "hosts">) {
  if (!closingNote && !hosts?.length) return null;

  return (
    <footer className="invitation-closing">
      <span className="afterglow-ornament" aria-hidden="true">
        ✧
      </span>
      <h2>With love</h2>
      {closingNote && <p className="invitation-note-copy">{closingNote}</p>}
      {!!hosts?.length && (
        <ul aria-label="Hosts" className="invitation-closing-hosts">
          {hosts.map((name, index) => (
            <li key={`${index}-${name}`}>{name}</li>
          ))}
        </ul>
      )}
    </footer>
  );
}
