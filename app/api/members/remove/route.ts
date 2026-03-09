
// app/api/members/remove/route.ts
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { secureRoute } from "@/lib/security/secure-route";
import { logAudit } from "@/lib/audit/log-audit";

export const runtime = "nodejs";

// UUID quick check (optional)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  return secureRoute(
    req,
    {
      // Internal admin tool → no captcha
      requireCaptcha: false,
      requireOrg: true,
      requiredRoles: ["owner", "admin", "manager"],
      logCaptcha: false,
    },
    async ({ supabase, user, profile, body }) => {
      const memberId = String(body?.memberId ?? "").trim();
      if (!memberId) return NextResponse.json({ error: "Member ID required" }, { status: 400 });
      if (!UUID_RE.test(memberId)) return NextResponse.json({ error: "Invalid Member ID" }, { status: 400 });

      // Cannot remove yourself
      if (memberId === user.id) {
        return NextResponse.json({ error: "You cannot remove yourself" }, { status: 409 });
      }

      /* ===================== PLATFORM-ADMIN & TARGET LOOKUP ===================== */
      // platform admin check (already present)
      const { data: platformAdmin } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const isPlatformAdmin = !!platformAdmin;

      // Load target member (works everywhere thanks to profiles_select_same_org)
      const { data: member, error: fetchErr } = await supabase
        .from("profiles")
        .select("id, org_id, role, email")
        .eq("id", memberId)
        .single();

      if (fetchErr || !member) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }

      /* ===================== ORG / ROLE AUTHORIZATION ===================== */
      if (!isPlatformAdmin) {
        if (!profile.org_id) {
          return NextResponse.json({ error: "User not attached to organization" }, { status: 403 });
        }

        // Only block if BOTH orgs are set and different
        const callerOrg = String(profile.org_id);
        const targetOrg = member.org_id ? String(member.org_id) : null;
        if (targetOrg && callerOrg && targetOrg !== callerOrg) {
          return NextResponse.json({ error: "Unauthorized organization access" }, { status: 403 });
        }

        // Org admin hierarchy: admin cannot remove owner/admin
        if (profile.role === "admin" && (member.role === "owner" || member.role === "admin")) {
          return NextResponse.json({ error: "Admins cannot remove owners/admins" }, { status: 403 });
        }
      }

      /* ===================== LAST-OWNER GUARD (applies to everyone) ===================== */
      if (member.role === "owner" && member.org_id) {
        const { count, error: countErr } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("org_id", member.org_id)
          .eq("role", "owner");

        if (countErr) return NextResponse.json({ error: countErr.message }, { status: 400 });
        if ((count ?? 0) <= 1) {
          return NextResponse.json(
            { error: "Cannot remove the last owner of an organization" },
            { status: 409 }
          );
        }
      }

      /* ===================== SOFT-REMOVE ===================== */
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          org_id: null,
          role: "viewer",
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 });
      }

      /* ===================== AUDIT (best effort) ===================== */
      try {
        await logAudit({
          supabase,
          org_id: member.org_id ?? null,
          user_id: user.id,
          action: "member_removed",
          entity_type: "profile",
          entity_id: memberId,
          metadata: {
            removed_email: member.email,
            removed_role: member.role,
            removed_by_platform_admin: isPlatformAdmin,
          },
        });
      } catch {
        /* ignore */
      }

      return NextResponse.json({ success: true, removed_id: memberId });
    }
  );
}
