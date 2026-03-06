
// app/api/requests/submit/route.ts
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { secureRoute } from "@/lib/security/secure-route";

/** Local fallback in case RPC is unavailable */
function localTrackingId(prefix = "REQ") {
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
      expectedAction: "submit_request",
      minScore: 0.7,                // higher threshold for public-ish submission
      requireCaptcha: true,
      requireOrg: true,             // request belongs to user's org
      requiredRoles: ["owner", "admin", "manager"],
      logCaptcha: true,             // secureRoute already logs a small captcha audit row
    },
    async ({ user, profile, supabase, body, captcha }) => {
      // ---------- 1) Validate input ----------
      const { govType, extracted, formData } = body ?? {};

      if (!govType || !extracted?.title || !extracted?.description) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      // ---------- 2) Generate tracking id (prefer RPC, fallback to local) ----------
      let trackingId: string | null = null;
      try {
        const { data: rpcVal, error: rpcErr } = await supabase.rpc("generate_tracking_id", {
          prefix: "REQ",
        });
        if (rpcErr) throw rpcErr;
        trackingId = rpcVal ?? null;
      } catch {
        trackingId = localTrackingId("REQ");
      }

      // ---------- 3) Insert service request (typed) ----------
      const { data, error } = await supabase
        .from("service_requests")
        .insert({
          org_id: profile.org_id,         // 🔐 tenant isolation
          gov_type: String(govType),
          submitted_by: user.id,
          requester_email: user.email ?? null,
          title: String(extracted.title),
          description: String(extracted.description),
          form_data: formData ?? {},      // Json
          status: "pending",
          admin_status: "submitted",
          awarded: false,
          tracking_id: trackingId,        // nullable in schema, but we provide one
          updated_at: new Date().toISOString(),
        } satisfies Database["public"]["Tables"]["service_requests"]["Insert"])
        .select("tracking_id")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // ---------- 4) (Optional) Additional audit record ----------
      // If you still want your custom audit (besides secureRoute's captcha log),
      // uncomment this block. It is non-blocking by design.
      
      try {
        await supabase.from("audit_logs").insert({
          record_id: crypto.randomUUID(),
          table_name: "service_requests",
          org_id: profile.org_id,
          user_id: user.id,
          action: "submit_request",
          entity_type: "service_request",
          entity_id: data.tracking_id, // we log by tracking id as external ref
          metadata: {
            gov_type: govType,
            captcha_score: captcha?.score,
          },
        });
      } catch (e) { /* swallow audit errors */ }
      

      // ---------- 5) Response ----------
      return { trackingId: data.tracking_id };
    }
  );
}
