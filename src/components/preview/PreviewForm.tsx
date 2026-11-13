import { useId, useState, type FormEvent } from "react";
import { previewFields, validatePreview } from "@/lib/preview-invitation";
import type { Invitation } from "@/types/invitation";

type FieldProps = {
  id: string;
  label: string;
  value: string;
  update: (value: string) => void;
  error?: string;
  type?: "text" | "date" | "time" | "textarea";
  maxLength?: number;
  required?: boolean;
};

function Field({
  id,
  label,
  value,
  update,
  error,
  type = "text",
  maxLength,
  required = true,
}: FieldProps) {
  const props = {
    id,
    value,
    maxLength,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
  return (
    <div className="preview-field">
      <label htmlFor={id}>{label}</label>
      {type === "textarea" ? (
        <textarea
          {...props}
          rows={3}
          onChange={(event) => update(event.target.value)}
        />
      ) : (
        <input
          {...props}
          type={type}
          onChange={(event) => update(event.target.value)}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="preview-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function PreviewForm({
  sample,
  apply,
  reset,
}: {
  sample: Invitation;
  apply: (invitation: Invitation) => void;
  reset: () => void;
}) {
  const id = useId();
  const [fields, setFields] = useState(() => previewFields(sample));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validatePreview(sample, fields);
    if (result.invitation) {
      setErrors({});
      apply(result.invitation);
    } else {
      setErrors(result.errors);
      const controls = event.currentTarget.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >("input, textarea");
      const firstInvalid = [...controls].find(
        (control) => result.errors[control.id.slice(id.length + 1)],
      );
      firstInvalid?.focus();
    }
  }

  return (
    <form
      id="preview-editor"
      className="preview-form"
      aria-labelledby={`${id}-heading`}
      onSubmit={onSubmit}
      autoComplete="off"
      noValidate
    >
      <h3 id={`${id}-heading`}>Your invitation details</h3>
      <p>
        Dates and times use {sample.timeZone}. Fields are required unless marked
        optional.
      </p>
      <div className="preview-fields">
        {(["partnerOne", "partnerTwo"] as const).map((key, index) => (
          <Field
            key={key}
            id={`${id}-couple.${key}`}
            label={`Partner ${index + 1} name`}
            value={fields[key]}
            maxLength={80}
            error={errors[`couple.${key}`]}
            update={(value) =>
              setFields((current) => ({ ...current, [key]: value }))
            }
          />
        ))}
      </div>
      <Field
        id={`${id}-welcomeNote`}
        label="Welcome message (optional)"
        type="textarea"
        required={false}
        value={fields.welcomeNote}
        maxLength={500}
        error={errors.welcomeNote}
        update={(value) =>
          setFields((current) => ({ ...current, welcomeNote: value }))
        }
      />
      {sample.events.map((event, index) => (
        <fieldset key={event.id}>
          <legend>{event.title}</legend>
          <div className="preview-fields">
            {(
              [
                ["date", "Celebration date", "date", undefined, "date"],
                ["time", "Celebration time", "time", undefined, "time"],
                ["venueName", "Venue name", "text", 120, "venue.name"],
                [
                  "venueAddress",
                  "Venue address",
                  "textarea",
                  240,
                  "venue.address",
                ],
              ] as const
            ).map(([key, label, type, maxLength, errorKey]) => (
              <Field
                key={key}
                id={`${id}-events.${index}.${errorKey}`}
                label={label}
                type={type}
                value={fields.events[index][key]}
                maxLength={maxLength}
                error={errors[`events.${index}.${errorKey}`]}
                update={(value) =>
                  setFields((current) => ({
                    ...current,
                    events: current.events.map((details, position) =>
                      position === index
                        ? { ...details, [key]: value }
                        : details,
                    ),
                  }))
                }
              />
            ))}
          </div>
        </fieldset>
      ))}
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="preview-error">
          Review the highlighted fields before applying your details.
        </p>
      )}
      <div className="preview-actions">
        <button type="submit" className="preview-primary">
          Apply to Preview
        </button>
        <button type="button" onClick={reset}>
          Reset to Sample
        </button>
      </div>
    </form>
  );
}
