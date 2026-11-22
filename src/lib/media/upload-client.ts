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
      else if (xhr.status === 401 || xhr.status === 403)
        reject(
          new Error(
            "The upload link expired or was rejected. Try again for a fresh link.",
          ),
        );
      else reject(new Error("The photo upload failed. Try again."));
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

class MediaResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class PhotoVerificationError extends Error {
  constructor(
    message: string,
    readonly assetId: string,
  ) {
    super(message);
  }
}

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
    throw new MediaResponseError(
      error.success
        ? error.data.message
        : "Couldn’t confirm the photo upload. Try again.",
      response.status,
    );
  }
  return body;
}

export async function uploadPrivatePhoto(
  draft: string,
  file: File,
  signal: AbortSignal,
  progress: (value: number | "verifying") => void,
  retryAssetId?: string,
) {
  if (retryAssetId) return verifyPhoto(draft, retryAssetId, signal, progress);
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
  return verifyPhoto(draft, assetId, signal, progress);
}

async function verifyPhoto(
  draft: string,
  assetId: string,
  signal: AbortSignal,
  progress: (value: "verifying") => void,
) {
  signal.throwIfAborted();
  progress("verifying");
  try {
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
  } catch (error) {
    signal.throwIfAborted();
    // A missing, expired, or invalid upload needs a new ticket. Transient
    // verification failures can safely reuse the object that already arrived.
    if (error instanceof MediaResponseError && error.status < 500) throw error;
    throw new PhotoVerificationError(
      error instanceof Error
        ? error.message
        : "Couldn’t verify the photo. Try again.",
      assetId,
    );
  }
}
