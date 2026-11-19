import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const path = process.argv[2];
if (!path) throw new Error("Pass the path to the kit's internal WebP file.");
const photo = await readFile(path);

createServer((request, response) => {
  if (
    request.method !== "GET" ||
    request.url !== "/hero.webp" ||
    request.headers.host !== "127.0.0.1:3161"
  ) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Content-Type": "image/webp",
    "Cache-Control": "no-store",
    "Cross-Origin-Resource-Policy": "same-site",
    "X-Content-Type-Options": "nosniff",
    "Content-Length": photo.byteLength,
  });
  response.end(photo);
}).listen(3161, "127.0.0.1", () => {
  console.log(
    "Internal hero available on loopback at http://127.0.0.1:3161/hero.webp",
  );
});
