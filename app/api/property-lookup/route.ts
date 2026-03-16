import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function buildAddress(data: any) {
  return [
    data.property_address,
    data.city,
    data.state,
    data.zip
  ]
    .filter(Boolean)
    .join(", ");
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const address = buildAddress(body);

    if (!address) {
      return jsonResponse(
        { success: false, error: "missing_address" },
        400
      );
    }

    const rentCastApiKey = process.env.RENTCAST_API_KEY;

    if (!rentCastApiKey) {
      console.error("Missing RENTCAST_API_KEY");
      return jsonResponse(
        { success: false, error: "server_configuration_error" },
        500
      );
    }

    const url = new URL("https://api.rentcast.io/v1/properties");
    url.searchParams.set("address", address);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Api-Key": rentCastApiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("RentCast error:", text);

      return jsonResponse(
        { success: false, error: "property_lookup_failed" },
        500
      );
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      return jsonResponse(
        { success: false, error: "property_not_found" },
        404
      );
    }

    const property = data[0];

    return jsonResponse({
      success: true,
      property
    });

  } catch (error) {
    console.error("Property lookup error:", error);

    return jsonResponse(
      { success: false, error: "server_error" },
      500
    );
  }
}