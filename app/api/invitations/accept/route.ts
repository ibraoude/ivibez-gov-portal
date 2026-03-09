import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";


export async function POST(req: NextRequest) {

  try {
    const body = await req.json();
    const token = String(body.inviteToken ?? "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Missing invitation token" },
        { status: 400 }
      );
    }

    // Use service role client here if needed
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: inv, error } = await supabase
  .from("invitations")
  .select("*")
  .eq("token", token)
  .maybeSingle();

  if (!inv) {
    return NextResponse.json(
      { error: "Invalid invitation token" },
      { status: 404 }
    );
  }

  if (inv.revoked_at) {
    return NextResponse.json(
      { error: "Invitation was revoked" },
      { status: 410 }
    );
  }

  if (inv.accepted_at) {
    return NextResponse.json(
      { error: "Invitation already accepted" },
      { status: 409 }
    );
  }

  if (inv.expires_at && new Date(inv.expires_at) <= new Date()) {
    return NextResponse.json(
      { error: "Invitation expired" },
      { status: 410 }
    );
  }
    // Mark accepted
    await supabase
      .from("invitations")
      .update({
        accepted_at: new Date().toISOString(),
        token: null,
      })
      .eq("id", inv.id);

    return NextResponse.json({ success: true });

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Server error" },
      { status: 500 }
    );
  }
}