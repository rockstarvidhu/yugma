import { z } from "zod";
import { draftIdSchema } from "@/lib/drafts/contract";
import {
  draftMediaPath,
  uploadRequestSchema,
  uploadTicketSchema,
} from "./contract";

function putPhoto(
  url: string,
  file: File,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.onloadend = () => signal.removeEventListener("abort", abort);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error("The photo upload failed. Select the photo and try again."),
        );
    };
    xhr.onerror = xhr.ontimeout = () =>
      reject(
        new Error(
          "The photo upload failed. Check your connection and try again.",
        ),
      );
    xhr.onabort = () =>
      reject(new DOMException("Upload cancelled.", "AbortError"));
    xhr.upload.onprogress = ({ loaded, total, lengthComputable }) => {
      if (lengthComputable) progress(Math.floor((loaded / total) * 100));
    };
    xhr.open("PUT", url);
    xhr.timeout = 90_000;
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("If-None-Match", "*");
    signal.addEventListener("abort", abort, { once: true });
    xhr.send(file);
  });
}

const completionSchema = z.object({ assetId: draftIdSchema });
const errorSchema = z.object({ message: z.string() });
async function mediaRequest(path: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Error(
      "Couldn’t reach Studio. Check your connection and try again.",
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = errorSchema.safeParse(body);
    throw new Error(
      error.success
        ? error.data.message
        : "Couldn’t confirm the photo upload. Try again.",
    );
  }
  return body;
}

export async function uploadPrivatePhoto(
  draft: string,
  file: File,
  signal: AbortSignal,
  progress: (value: number | "verifying") => void,
) {
  const selected = uploadRequestSchema.safeParse({
    type: file.type,
    bytes: file.size,
  });
  if (!selected.success)
    throw new Error("Choose a JPEG, PNG or WebP photo up to 5 MB.");
  const ticket = uploadTicketSchema.safeParse(
    await mediaRequest(draftMediaPath(draft), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected.data),
      signal,
    }),
  );
  if (!ticket.success)
    throw new Error("Couldn’t start the photo upload. Try again.");

  const { assetId, uploadUrl } = ticket.data;
  await putPhoto(uploadUrl, file, signal, progress);
  signal.throwIfAborted();
  progress("verifying");
  const verified = completionSchema.safeParse(
    await mediaRequest(draftMediaPath(draft, assetId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal,
    }),
  );
  if (!verified.success || verified.data.assetId !== assetId)
    throw new Error("Couldn’t verify the photo upload. Try again.");
  return verified.data.assetId;
}
