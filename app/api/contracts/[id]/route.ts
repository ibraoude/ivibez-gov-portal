
// app/api/contracts/[id]/route.ts
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { secureRoute } from "@/lib/security/secure-route";

export const runtime = "nodejs";

export async function PUT(req: Request,
  context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; // ✅ await it

  return secureRoute(
    req,
    {
      expectedAction: "contract_update",
      requireCaptcha: true,
      requireOrg: true,
      requiredRoles: ["admin", "owner", "super_admin"], // adjust to your model
      logCaptcha: true,
    },
    async ({ supabase, profile, body, formData }) => {
      // 1) Fetch contract to get org context (and to validate existence)
      const { data: existing, error: getErr } = await supabase
        .from("contracts")
        .select("id, org_id")
        .eq("id", id)
        .single();

      if (getErr || !existing) {
        return NextResponse.json({ error: "Contract not found" }, { status: 404 });
      }
      if (profile.org_id && existing.org_id && profile.org_id !== existing.org_id) {
        return NextResponse.json({ error: "Cross-organization access denied" }, { status: 403 });
      }

      // 2) Prepare patch with correct nullability
      //    - use toStrOrUndef for non-nullable string update fields (contract_number, source_type)
      //    - use toStrOrNull for nullable string fields (gov_type, title, description, period_*, client_id, status, admin_status)
      const patch: Database["public"]["Tables"]["contracts"]["Update"] = {
        contract_number: toStrOrUndef(body.contract_number),
        source_type: toStrOrUndef(body.source_type),

        gov_type: toStrOrNull(body.gov_type),
        title: toStrOrNull(body.title),
        description: toStrOrNull(body.description),

        final_amount: toNumOrNull(body.final_amount),

        period_start: toStrOrNull(body.period_start),
        period_end: toStrOrNull(body.period_end),

        client_id: toStrOrNull(body.client_id),

        status: toStrOrNull(body.status),
        admin_status: toStrOrNull(body.admin_status),

        last_updated: new Date().toISOString(),
      };

      // Remove keys that are undefined to avoid unintended overwrites
      Object.keys(patch).forEach((k) => {
        const key = k as keyof typeof patch;
        if (patch[key] === undefined) delete patch[key];
      });

      // 3) Update
      const { error: updErr } = await supabase.from("contracts").update(patch).eq("id", id);
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 });
      }

      // 4) Upload new files (if any)
      const uploads: string[] = [];
      const files = (formData?.getAll("files") as File[]) || [];
      if (files.length) {
        const orgId = existing.org_id || profile.org_id || "unknown";
        for (const file of files) {
          if (!(file instanceof File)) continue;
          try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const path = `${orgId}/${id}/${Date.now()}_${file.name}`;
            const { error: upErr } = await supabase.storage
              .from("contracts")
              .upload(path, bytes, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
              });
            if (!upErr) uploads.push(path);
          } catch {
            // ignore single-file failure
          }
        }
      }

      return { ok: true, uploaded: uploads.length };
    }
  );
}

/* ---------------- helpers ---------------- */

// For update fields that are `string` (non-nullable) → send string or omit (undefined)
function toStrOrUndef(v: unknown): string | undefined {
  const s = (v ?? "").toString().trim();
  return s ? s : undefined;
}

// For update fields that are `string | null` (nullable) → send string or explicit null
function toStrOrNull(v: unknown): string | null {
  const s = (v ?? "").toString().trim();
  return s ? s : null;
}

function toNumOrNull(v: unknown): number | null {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
