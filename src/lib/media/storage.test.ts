// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { openStorage } from "./storage";
vi.mock("server-only", () => ({}));

afterEach(() => vi.unstubAllEnvs());

it("signs a 90-second grant for exactly one staging object with write-once constraints", async () => {
  vi.stubEnv("R2_ACCOUNT_ID", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("R2_ACCESS_KEY_ID", "unit-test-key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "unit-test-secret");
  vi.stubEnv("R2_PRIVATE_BUCKET", "private-unit-test");
  vi.stubEnv("R2_LOCAL_ENDPOINT", "");
  const bucket = openStorage();
  const url = new URL(
    await bucket!.signUpload("id-one", "id-two", {
      type: "image/jpeg",
      bytes: 41,
    }),
  );
  expect(url.hostname).toBe(
    "0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
  );
  expect(url.pathname).toBe("/private-unit-test/incoming/id-one/id-two");
  expect(url.searchParams.get("X-Amz-Expires")).toBe("90");
  expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe(
    "content-length;content-type;host;if-none-match",
  );
  expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  expect(url.toString()).not.toContain("unit-test-secret");
});
