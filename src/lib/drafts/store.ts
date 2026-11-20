import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/auth/client";
import type { getServerAuth } from "@/lib/auth/server";
import {
  invitationDraftSchema,
  type InvitationDraft,
} from "@/lib/invitation-schema";
import {
  DRAFT_PAGE_SIZE,
  DRAFT_SCHEMA_VERSION,
  draftIdSchema,
  type Draft,
} from "./contract";

type DraftReader = {
  client: NonNullable<Awaited<ReturnType<typeof getServerAuth>>>;
  ownerId: string;
};

const ownerColumns =
  "id,template_id,schema_version,version,updated_at,data,template:templates!invitations_template_id_fkey(registry_key)";
const draftDataRow = z.object({
  id: draftIdSchema,
  template_id: draftIdSchema,
  schema_version: z.literal(DRAFT_SCHEMA_VERSION),
  version: z.number().int().positive(),
  updated_at: z.iso.datetime({ offset: true }),
  data: invitationDraftSchema,
});
const ownerRow = draftDataRow.extend({
  template: z.object({ registry_key: z.string() }),
});
const mutationRow = draftDataRow.extend({ registry_key: z.string() });

function toDraft(
  row: z.output<typeof draftDataRow>,
  templateKey: string,
): Draft {
  return {
    id: row.id,
    templateId: row.template_id,
    templateKey,
    version: row.version,
    schemaVersion: row.schema_version,
    updatedAt: row.updated_at,
    data: row.data,
  };
}

export async function listDrafts(
  { client, ownerId }: DraftReader,
  after: string | null,
) {
  const query = client
    .from("invitations")
    .select(ownerColumns)
    .eq("owner_id", ownerId)
    .eq("status", "draft")
    .order("id")
    .limit(DRAFT_PAGE_SIZE + 1);
  const { data, error } = await (after ? query.gt("id", after) : query);
  if (error) throw error;
  const rows = ownerRow.array().parse(data);
  const drafts = rows
    .slice(0, DRAFT_PAGE_SIZE)
    .map((row) => toDraft(row, row.template.registry_key));
  return {
    drafts,
    nextCursor:
      rows.length > DRAFT_PAGE_SIZE ? drafts[DRAFT_PAGE_SIZE - 1].id : null,
  };
}

export async function loadDraft({ client, ownerId }: DraftReader, id: string) {
  const { data, error } = await client
    .from("invitations")
    .select(ownerColumns)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .eq("status", "draft")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = ownerRow.parse(data);
  return toDraft(row, row.template.registry_key);
}

function writeClient() {
  const config = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secret?.startsWith("sb_secret_"))
    throw new Error("Draft writes are not configured");

  return createClient(config.url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function createDraft(
  ownerId: string,
  templateKey: string,
  draft: InvitationDraft,
) {
  const { data, error } = await writeClient()
    .rpc("create_private_draft", {
      p_owner_id: ownerId,
      p_registry_key: templateKey,
      p_data: draft,
    })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = mutationRow.parse(data);
  return toDraft(row, row.registry_key);
}

export async function saveDraft(
  ownerId: string,
  id: string,
  expectedVersion: number,
  draft: InvitationDraft,
) {
  const { data, error } = await writeClient()
    .rpc("save_private_draft", {
      p_owner_id: ownerId,
      p_draft_id: id,
      p_expected_version: expectedVersion,
      p_data: draft,
    })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = mutationRow.parse(data);
  return toDraft(row, row.registry_key);
}
