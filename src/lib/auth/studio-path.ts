const studioDraftPath =
  /^\/studio\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createPath = /^\/create\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function studioReturnPath(value: unknown) {
  return typeof value === "string" &&
    (value === "/studio" ||
      studioDraftPath.test(value) ||
      (value.length <= 88 && createPath.test(value)))
    ? value
    : "/studio";
}
