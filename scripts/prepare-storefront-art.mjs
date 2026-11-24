import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
if (!process.argv[2])
  throw new Error("Pass the extracted YUGMA_Batch_04 directory.");
const manifest = JSON.parse(
  await readFile(resolve(root, "src/lib/storefront-art.json"), "utf8"),
);
const target = resolve(root, "assets/storefront-hero-review");
await mkdir(target, { recursive: true });
for (const entry of manifest) {
  const bytes = await readFile(resolve(process.argv[2], entry.path));
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
    throw new Error("Unexpected asset bytes: " + entry.path);
  await writeFile(resolve(target, basename(entry.path)), bytes);
}
console.log("Prepared " + manifest.length + " verified review assets.");
