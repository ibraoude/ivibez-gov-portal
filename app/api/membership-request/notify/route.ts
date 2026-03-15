import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

type RequestBody = {
  org_id: string;
  user_id: string;
};

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { org_id, user_id } = body;

    if (!org_id || !user_id) {
      return NextResponse.json(
        { error: "Missing org_id or user_id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get organization owner
    const { data: owner, error: ownerError } = await supabase
      .from("profiles")
      .select("id,email,first_name,last_name")
      .eq("org_id", org_id)
      .eq("role", "owner")
      .maybeSingle();

    if (ownerError) {
      console.error("Owner lookup failed:", ownerError);
      return NextResponse.json({ error: "Failed to find owner" }, { status: 500 });
    }

    if (!owner?.email) {
      return NextResponse.json({ ok: true });
    }

    // Get requesting user
    const { data: requester, error: requesterError } = await supabase
      .from("profiles")
      .select("email,first_name,last_name")
      .eq("id", user_id)
      .maybeSingle();

    if (requesterError) {
      console.error("Requester lookup failed:", requesterError);
    }

    const requesterName =
      `${requester?.first_name ?? ""} ${requester?.last_name ?? ""}`.trim() ||
      requester?.email ||
      "A user";

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const { error: emailError } = await resend.emails.send({
      from: "Portal <noreply@ivibezsolutions.com>",
      to: owner.email,
      subject: "New membership request",
      html: `
        <h2>New Organization Membership Request</h2>

        <p><strong>${requesterName}</strong> requested to join your organization.</p>

        <p>Please review the request in your dashboard.</p>

        <p>
          <a href="${appUrl}/dashboard/membership-requests">
            Review Request
          </a>
        </p>
      `,
    });

    if (emailError) {
      console.error("Email send failed:", emailError);
      return NextResponse.json(
        { error: "Email failed to send" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Membership email error:", error);

    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}