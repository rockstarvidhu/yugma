import "server-only";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/auth/client";
import type { getServerAuth } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/auth/service";
import { DRAFT_SCHEMA_VERSION, draftIdSchema } from "@/lib/drafts/contract";
import { focalPositionSchema, invitationSchema } from "@/lib/invitation-schema";
import { MAX_PHOTO_BYTES } from "@/lib/media/contract";
import { templateRegistry } from "@/templates/registry";
import {
  invitationTitle,
  publicationTitleSchema,
  shareSlugSchema,
  type publishRequestSchema,
} from "./contract";

type Reader = {
  client: NonNullable<Awaited<ReturnType<typeof getServerAuth>>>;
  ownerId: string;
};

export function stagingPublishingEnabled() {
  return process.env.STAGING_INVITATION_PUBLISHING === "true";
}

export function suggestSlug(title: string) {
  const prefix = title
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 55)
    .replace(/-+$/, "");
  return `${prefix || "invitation"}-${randomBytes(6).toString("hex")}`;
}

const ownerPublication = z.object({
  id: draftIdSchema,
  share_slug: shareSlugSchema,
  test_publication_title: publicationTitleSchema,
});

function ownedPublications({ client, ownerId }: Reader) {
  return client
    .from("invitations")
    .select("id,share_slug,test_publication_title")
    .eq("owner_id", ownerId)
    .eq("status", "published")
    .not("test_publication_title", "is", null);
}

export async function loadOwnerPublication(reader: Reader, id: string) {
  if (!stagingPublishingEnabled()) return null;
  const { data, error } = await ownedPublications(reader)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? ownerPublication.parse(data) : null;
}

export async function listOwnerPublications(reader: Reader) {
  if (!stagingPublishingEnabled()) return [];
  const { data, error } = await ownedPublications(reader)
    .order("published_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return ownerPublication.array().parse(data);
}

export async function publishTestInvitation(
  ownerId: string,
  id: string,
  input: z.output<typeof publishRequestSchema>,
) {
  const { data, error } = await createServiceClient().rpc(
    "publish_test_invitation",
    {
      p_owner: ownerId,
      p_id: id,
      p_version: input.expectedVersion,
      p_title: input.title,
      p_slug: input.slug,
    },
  );
  if (error) throw error;
  return z
    .enum([
      "published",
      "missing",
      "unpaid",
      "invalid",
      "invalid_media",
      "stale",
      "slug_taken",
    ])
    .parse(data);
}

const publicRow = z.object({
  registry_key: z.string(),
  schema_version: z.literal(DRAFT_SCHEMA_VERSION),
  data: invitationSchema,
});
const testPublicRow = publicRow.extend({
  title: publicationTitleSchema,
  cover_draft_id: draftIdSchema.nullable(),
  cover_asset_id: draftIdSchema.nullable(),
  cover_size: z.number().int().min(1).max(MAX_PHOTO_BYTES).nullable(),
  cover: z
    .object({
      alt: z.string().min(1).max(240),
      focalPosition: focalPositionSchema.optional(),
    })
    .nullable(),
});

export async function loadTestPublication(slug: string) {
  if (!stagingPublishingEnabled() || !shareSlugSchema.safeParse(slug).success)
    return null;
  const { data, error } = await createServiceClient()
    .rpc("get_test_publication", { p_slug: slug })
    .maybeSingle();
  if (error) throw error;
  const parsed = testPublicRow.safeParse(data);
  return parsed.success && templateRegistry.get(parsed.data.registry_key)
    ? parsed.data
    : null;
}

export async function loadPublicInvitation(slug: string) {
  if (!shareSlugSchema.safeParse(slug).success) return null;
  const test = await loadTestPublication(slug);
  if (test) {
    const { registry_key, title, data, cover } = test;
    return { registry_key, title, data, cover };
  }

  const config = getSupabaseConfig();
  if (!config) return null;
  const client = createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  const { data, error } = await client
    .rpc("get_published_invitation", { p_slug: slug })
    .maybeSingle();
  if (error) throw error;
  const parsed = publicRow.safeParse(data);
  if (!parsed.success || !templateRegistry.get(parsed.data.registry_key))
    return null;
  return {
    ...parsed.data,
    title: invitationTitle(parsed.data.data.couple),
    cover: null,
  };
}
