import { afterglowListing } from "./afterglow/listing";
import { Afterglow } from "./afterglow/Afterglow";
import type { TemplateDefinition } from "./types";

export function createTemplateRegistry(
  definitions: readonly TemplateDefinition[],
) {
  const templates = new Map<string, TemplateDefinition>();
  for (const definition of definitions) {
    if (!definition.id.trim() || definition.id !== definition.id.trim())
      throw new Error("Template IDs must be non-empty and trimmed.");
    if (templates.has(definition.id))
      throw new Error(`Duplicate template ID: ${definition.id}`);
    templates.set(definition.id, Object.freeze({ ...definition }));
  }
  return {
    list: () => Array.from(templates.values()),
    get: (id: string) => templates.get(id),
  };
}

export const templateRegistry = createTemplateRegistry([
  { id: "afterglow", Component: Afterglow, listing: afterglowListing },
]);
