import "server-only";
import { AwsClient } from "aws4fetch";
import { UPLOAD_EXPIRY_SECONDS, type PhotoUploadRequest } from "./contract";

const stagingKey = (draft: string, id: string) => `incoming/${draft}/${id}`;
export const finalKey = (draft: string, id: string) =>
  `draft-media/${draft}/${id}`;

function settings() {
  const {
    R2_ACCOUNT_ID: account,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_PRIVATE_BUCKET: bucket,
    R2_LOCAL_ENDPOINT: local,
  } = process.env;
  if (
    !account ||
    !/^[0-9a-f]{32}$/.test(account) ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)
  )
    return;
  const endpoint = local
    ? URL.parse(local)
    : new URL(`https://${account}.r2.cloudflarestorage.com`);
  if (
    !endpoint ||
    (local &&
      (endpoint.hostname !== "127.0.0.1" ||
        endpoint.protocol !== "http:" ||
        endpoint.origin !== local))
  )
    return;
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

export const privateMediaConfigured = () => Boolean(settings());

export function openStorage() {
  const config = settings();
  if (!config) return;
  const signer = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
    retries: 0,
  });
  const url = (key: string) =>
    new URL(`/${config.bucket}/${key}`, config.endpoint);

  async function request(
    key: string,
    method: "GET" | "PUT" | "DELETE",
    headers?: HeadersInit,
    body?: Uint8Array<ArrayBuffer>,
  ) {
    const target = url(key);
    target.searchParams.set("X-Amz-Expires", "30");
    const signed = await signer.sign(target, {
      method,
      headers,
      body,
      aws: { signQuery: true, allHeaders: true },
    });
    return fetch(signed, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  }

  return {
    async signUpload(draft: string, id: string, upload: PhotoUploadRequest) {
      const target = url(stagingKey(draft, id));
      target.searchParams.set("X-Amz-Expires", String(UPLOAD_EXPIRY_SECONDS));
      const signed = await signer.sign(target, {
        method: "PUT",
        headers: {
          "Content-Type": upload.type,
          "Content-Length": String(upload.bytes),
          "If-None-Match": "*",
        },
        aws: { signQuery: true, allHeaders: true },
      });
      return signed.url;
    },
    staging: (draft: string, id: string) =>
      request(stagingKey(draft, id), "GET"),
    final: (draft: string, id: string) => request(finalKey(draft, id), "GET"),
    writeFinal: (draft: string, id: string, bytes: Uint8Array<ArrayBuffer>) =>
      request(
        finalKey(draft, id),
        "PUT",
        {
          "Content-Type": "image/webp",
          "Content-Length": String(bytes.length),
          "If-None-Match": "*",
          "Cache-Control": "private, no-store",
        },
        bytes,
      ),
    async deleteStaging(draft: string, id: string) {
      const result = await request(stagingKey(draft, id), "DELETE");
      if (!result.ok && result.status !== 404)
        throw new Error("R2 delete failed");
    },
    async deleteFinal(draft: string, id: string) {
      const result = await request(finalKey(draft, id), "DELETE");
      if (!result.ok && result.status !== 404)
        throw new Error("R2 delete failed");
    },
  };
}
