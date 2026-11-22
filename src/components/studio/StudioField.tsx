export function StudioField({
  path,
  label,
  value = "",
  onChange,
  issues,
  type = "text",
  multiline = false,
  hint,
  disabled,
}: {
  path: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  issues: Record<string, string>;
  type?: "text" | "url" | "datetime-local";
  multiline?: boolean;
  hint?: string;
  disabled?: boolean;
}) {
  const id = `studio-${path.replaceAll(".", "-")}`;
  const error = issues[path];
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;
  const control = {
    id,
    value,
    disabled,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };
  return (
    <div className="studio-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          {...control}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          {...control}
          type={type}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="studio-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
