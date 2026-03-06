import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = supabaseService();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const { data: userData, error: userErr } =
      await supabase.auth.getUser(token);

    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user = userData.user;

    /* ===============================
       PLATFORM ADMIN CHECK
    =============================== */

    const { data: platformAdmin } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const isSuperAdmin = !!platformAdmin;

    /* ===============================
       PROFILE CHECK
    =============================== */

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .maybeSingle();

    const orgRole = profile?.role || null;
    const orgId = profile?.org_id || null;

    /* ===============================
       PERMISSION RESOLUTION
    =============================== */

    const canManageMembers =
      isSuperAdmin ||
      ["owner", "admin", "manager"].includes(orgRole || "");

    const canInvite =
      isSuperAdmin ||
      ["owner", "admin", "manager"].includes(orgRole || "");

    const canRemoveMembers =
      isSuperAdmin ||
      ["owner", "admin"].includes(orgRole || "");

    return NextResponse.json({
      isSuperAdmin,
      orgRole,
      orgId,
      canManageMembers,
      canInvite,
      canRemoveMembers,
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}