const studioDraftPath =
  /^\/studio\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function studioReturnPath(value: unknown) {
  return typeof value === "string" &&
    (value === "/studio" || studioDraftPath.test(value))
    ? value
    : "/studio";
}
