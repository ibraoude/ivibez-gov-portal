
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { secureRoute } from "@/lib/security/secure-route";

/** Generate a unique tracking id like CON-2026-4821-ABCD */
function generateTrackingId(prefix = "CON") {
  const year = new Date().getFullYear();
  const rand4 = Math.floor(1000 + Math.random() * 9000);
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${year}-${rand4}-${tail}`;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  return secureRoute(
    req,
    {
      expectedAction: "contract_create",
      requireCaptcha: true,
      requireOrg: true,
      requiredRoles: ["admin", "owner", "super_admin"], // adjust if your model differs
      logCaptcha: true, // optional: writes a small audit row
    },
    async ({ supabase, user, profile, body, formData }) => {
      // 0) Required field: contract_number (Insert requires string)
      const contract_number = String(body.contract_number || "").trim();
      if (!contract_number) {
        return NextResponse.json(
          { error: "contract_number is required" },
          { status: 400 }
        );
      }

      // Coerce and sanitize optional fields
      const source_type = String(body.source_type || "manual");
      const gov_type = (String(body.gov_type || "").trim() || null) as string | null;
      const title = (String(body.title || "").trim() || null) as string | null;
      const description = (String(body.description || "").trim() || null) as string | null;

      const final_amount =
        body.final_amount !== undefined &&
        body.final_amount !== null &&
        String(body.final_amount).trim() !== ""
          ? Number(body.final_amount)
          : null;

      const period_start = (String(body.period_start || "").trim() || null) as string | null;
      const period_end = (String(body.period_end || "").trim() || null) as string | null;
      const client_id = (String(body.client_id || "").trim() || null) as string | null;

      // org_id comes from secureRoute profile (RLS-safe)
      const org_id = profile.org_id;
      if (!org_id) {
        return NextResponse.json(
          { error: "User is not attached to an organization" },
          { status: 403 }
        );
      }

      // 1) Derive owner_id for this org (role = 'owner'), fallback to current user
      let owner_id: string | null = null;
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("org_id", org_id)
        .eq("role", "owner")
        .maybeSingle();

      owner_id = ownerProfile?.id ?? user.id ?? null;

      // 2) Generate a tracking_id and ensure uniqueness (reroll up to 3 times)
      let tracking_id = generateTrackingId();
      for (let i = 0; i < 3; i++) {
        const { data: existing } = await supabase
          .from("contracts")
          .select("id")
          .eq("tracking_id", tracking_id)
          .maybeSingle();
        if (!existing) break;
        tracking_id = generateTrackingId();
      }

      // 3) Insert the contract (typed + RLS enforced)
      const { data: inserted, error: insertErr } = await supabase
        .from("contracts")
        .insert({
          org_id,
          contract_number,         // <-- string (required on Insert)
          tracking_id,             // <-- string (required on Insert)
          source_type,             // <-- string (required on Insert)
          gov_type,                // string | null
          title,                   // string | null
          description,             // string | null
          final_amount,            // number | null
          period_start,            // string | null
          period_end,              // string | null
          owner_id,                // string | null
          client_id,               // string | null
          status: "active",        // string | null (Insert allows null; string is fine)
          admin_status: "awarded", // string | null
          last_updated: new Date().toISOString(),
        } satisfies Database["public"]["Tables"]["contracts"]["Insert"])
        .select("id, tracking_id")
        .single();

      if (insertErr || !inserted) {
        return NextResponse.json(
          { error: insertErr?.message || "Insert failed" },
          { status: 400 }
        );
      }

      const contractId = inserted.id;

      // 4) Handle file uploads if present
      const uploads: string[] = [];
      const files = (formData?.getAll("files") as File[]) || [];
      if (files.length) {
        for (const file of files) {
          if (!(file instanceof File)) continue;
          try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const path = `${org_id}/${contractId}/${Date.now()}_${file.name}`;
            const { error: upErr } = await supabase.storage
              .from("contracts")
              .upload(path, bytes, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
              });
            if (!upErr) uploads.push(path);
          } catch {
            // non-fatal: skip file
          }
        }
      }

      // 5) Return success payload
      return {
        success: true,
        contract_id: contractId,
        tracking_id: inserted.tracking_id,
        uploaded: uploads.length,
      };
    }
  );
}
