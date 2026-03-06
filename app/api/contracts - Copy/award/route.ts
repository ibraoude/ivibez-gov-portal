import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { requestId } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user = userData.user;

    // Validate admin
    const { data: adminCheck } = await supabase
      .from("app_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminCheck) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Fetch request
    const { data: request, error: fetchError } = await supabase
      .from("service_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Prevent duplicate
    const { data: existing } = await supabase
      .from("contracts")
      .select("id")
      .eq("source_request_id", requestId)
      .maybeSingle();

    if (!existing) {
      const year = new Date().getFullYear();
      const random = Math.floor(1000 + Math.random() * 9000);
      const contractNumber = `${request.gov_type?.toUpperCase() || "CON"}-${year}-${random}`;

      await supabase.from("contracts").insert({
        contract_number: contractNumber,
        tracking_id: request.tracking_id,
        source_request_id: request.id,
        owner_id: request.submitted_by,
        gov_type: request.gov_type,
        title: request.title,
        description: request.description,
        status: "active",
        progress_percentage: 0,
        awarded_by: user.id,          // 🔥 CAPTURE ADMIN
        awarded_at: new Date().toISOString(),
      });
    }

    // Update request lifecycle
    await supabase
      .from("service_requests")
      .update({
        admin_status: "awarded",
        awarded: true,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    // Log audit
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "contract_awarded",
      entity_type: "contract",
      entity_id: requestId,
      metadata: {
        tracking_id: request.tracking_id,
      },
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}