import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type LeadInput = Record<string, any>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function isYes(value: unknown): boolean {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "yes";
}

function calculateLeadScore(lead: LeadInput): number {
  let score = 20;

  const motivation = String(lead.motivation || "").toLowerCase();
  const timeline = String(lead.sell_timeline || "").toLowerCase();

  if (lead.motivation) score += 15;

  if (
    motivation.includes("divorce") ||
    motivation.includes("probate") ||
    motivation.includes("inherit") ||
    motivation.includes("vacant") ||
    motivation.includes("foreclosure") ||
    motivation.includes("job") ||
    motivation.includes("relocat")
  ) {
    score += 15;
  }

  if (timeline.includes("asap") || timeline.includes("30")) {
    score += 20;
  } else if (timeline.includes("1-3") || timeline.includes("1–3")) {
    score += 10;
  }

  if (isYes(lead.price_negotiable)) score += 10;
  if (isYes(lead.quick_close_negotiable)) score += 10;
  if (isYes(lead.decision_ready)) score += 10;

  if (toNumber(lead.amount_behind_mortgage) > 0) score += 10;
  if (toNumber(lead.amount_back_taxes) > 0) score += 10;

  return Math.min(score, 100);
}

function estimateRepairs(lead: LeadInput): number {
  let repairs = 0;

  if (lead.structural) repairs += 15000;
  if (lead.mechanical) repairs += 10000;
  if (lead.foundation) repairs += 20000;

  return repairs;
}

function calculateOffer(arv: number, repairs: number): number {
  if (!arv) return 0;
  return Math.max(arv * 0.7 - repairs, 0);
}

function calculateProfit(arv: number, offer: number): number {
  if (!arv || !offer) return 0;
  return Math.max(arv - offer, 0);
}

function buildAddress(lead: LeadInput): string {
  return [
    lead.property_address,
    lead.city,
    lead.state,
    lead.zip,
  ]
    .filter(Boolean)
    .join(", ");
}

async function verifyCaptcha(captchaToken: string | undefined): Promise<boolean> {
  const recaptchaSecret = process.env.RECAPTCHA_SECRET;

  if (!recaptchaSecret) {
    throw new Error("Missing RECAPTCHA_SECRET environment variable.");
  }

  if (!captchaToken) return false;

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret: recaptchaSecret,
      response: captchaToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`reCAPTCHA verification failed with status ${response.status}`);
  }

  const captcha = await response.json();
  return Boolean(captcha?.success) && Number(captcha?.score ?? 0) >= 0.5;
}

async function fetchPropertyDataFromRentCast(lead: LeadInput) {
  const rentCastApiKey = process.env.RENTCAST_API_KEY;
  if (!rentCastApiKey) {
    throw new Error("Missing RENTCAST_API_KEY environment variable.");
  }

  const address = buildAddress(lead);
  if (!address) return null;

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
    throw new Error(`RentCast lookup failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0];
}

function extractEstimatedArv(propertyApiPayload: any): number {
  return (
    toNumber(propertyApiPayload?.value) ||
    toNumber(propertyApiPayload?.price) ||
    toNumber(propertyApiPayload?.avm) ||
    0
  );
}

function enrichLeadWithPropertyData(lead: LeadInput, propertyApiPayload: any): LeadInput {
  const enrichedLead = { ...lead };

  if (!enrichedLead.property_sqft && propertyApiPayload?.squareFootage) {
    enrichedLead.property_sqft = propertyApiPayload.squareFootage;
  }

  if (!enrichedLead.year_built && propertyApiPayload?.yearBuilt) {
    enrichedLead.year_built = propertyApiPayload.yearBuilt;
  }

  if (!enrichedLead.bedrooms && propertyApiPayload?.bedrooms) {
    enrichedLead.bedrooms = propertyApiPayload.bedrooms;
  }

  if (!enrichedLead.bathrooms && propertyApiPayload?.bathrooms) {
    enrichedLead.bathrooms = propertyApiPayload.bathrooms;
  }

  return enrichedLead;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase environment variables.");
      return jsonResponse(
        { success: false, error: "server_configuration_error" },
        500
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.json();
    const { captchaToken, ...rawLead } = body ?? {};

    const captchaPassed = await verifyCaptcha(captchaToken);
    if (!captchaPassed) {
      return jsonResponse({ success: false, error: "captcha_failed" }, 400);
    }

    let lead: LeadInput = { ...rawLead };
    let propertyApiPayload: any = null;
    let estimatedArv = 0;

    try {
      propertyApiPayload = await fetchPropertyDataFromRentCast(lead);
      estimatedArv = extractEstimatedArv(propertyApiPayload);
      lead = enrichLeadWithPropertyData(lead, propertyApiPayload);
    } catch (error) {
      console.error("Property enrichment error:", error);
    }

    const leadScore = calculateLeadScore(lead);
    const estimatedRepairs = estimateRepairs(lead);
    const suggestedOffer = calculateOffer(estimatedArv, estimatedRepairs);
    const estimatedProfit = calculateProfit(estimatedArv, suggestedOffer);

    const insertPayload = {
      ...lead,
      lead_score: leadScore,
      estimated_arv: estimatedArv,
      estimated_repairs: estimatedRepairs,
      suggested_offer: suggestedOffer,
      estimated_profit: estimatedProfit,
      property_api_source: propertyApiPayload ? "rentcast" : null,
      property_api_payload: propertyApiPayload,
    };

    const { error } = await supabase.from("seller_leads").insert([insertPayload]);

    if (error) {
      console.error("Supabase insert error:", error);
      return jsonResponse({ success: false, error: "insert_failed" }, 500);
    }

    return jsonResponse({
      success: true,
      leadScore,
      estimatedArv,
      estimatedRepairs,
      suggestedOffer,
      estimatedProfit,
    });
  } catch (error) {
    console.error("API /property-lookup error:", error);
    return jsonResponse({ success: false, error: "server_error" }, 500);
  }
}