import { templateRegistry } from "@/templates/registry";
export function getStorefrontCatalogue(registry = templateRegistry) {
  return registry
    .list()
    .flatMap((entry) => (entry.listing ? [entry.listing] : []));
}
