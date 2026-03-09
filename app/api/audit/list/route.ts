
// app/api/audit/list/route.ts

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { secureRoute } from "@/lib/security/secure-route";

export const runtime = "nodejs";

// Core handler shared by GET and POST
async function handle(req: NextRequest) {
  return secureRoute(
    req,
    {
      requireCaptcha: false,     // internal admin tool — no captcha
      requireOrg: false,         // platform-level
      requiredRoles: [],         // gate with isPlatformAdmin only
      logCaptcha: false,
    },
    async ({ supabase, isPlatformAdmin }) => {
      if (!isPlatformAdmin) {
        return NextResponse.json(
          { error: "Platform admin access required" },
          { status: 403 }
        );
      }

      // --- Parse query params (works for GET; also for POST we read from URL) ---
      const url = new URL(req.url);
      const limit = Math.min(
        Math.max(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 1),
        1000
      );
      const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
      const actor = (url.searchParams.get("actor") || "").trim();        // user_id or email in metadata
      const action = (url.searchParams.get("action") || "").trim();
      const entityType = (url.searchParams.get("entity_type") || "").trim();

      // --- Build query ---
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (actor) {
        query = query.or(
          `user_id.eq.${actor},metadata->>requester_email.eq.${actor}`,
        );
      }
      if (action) query = query.ilike("action", `%${action}%`);
      if (entityType) query = query.ilike("entity_type", `%${entityType}%`);

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        total: count ?? 0,
        limit,
        offset,
        logs: data ?? [],
      });
    }
  );
}

// Prefer GET for listing
export async function GET(req: NextRequest) {
  return handle(req);
}

// Keep POST for backward compatibility (delegates to GET logic)
export async function POST(req: NextRequest) {
  return handle(req);
}
