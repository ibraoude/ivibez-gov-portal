import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function calculateLeadScore(lead: Record<string, any>): number {
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

  if (timeline.includes("asap") || timeline.includes("30")) score += 20;
  else if (timeline.includes("1-3") || timeline.includes("1–3")) score += 10;

  if (String(lead.price_negotiable || "").toLowerCase() === "yes") score += 10;
  if (String(lead.quick_close_negotiable || "").toLowerCase() === "yes") score += 10;
  if (String(lead.decision_ready || "").toLowerCase() === "yes") score += 10;

  if (toNumber(lead.amount_behind_mortgage) > 0) score += 10;
  if (toNumber(lead.amount_back_taxes) > 0) score += 10;

  return Math.min(score, 100);
}

function estimateRepairs(lead: Record<string, any>): number {
  let repairs = 0;
  if (lead.structural) repairs += 15000;
  if (lead.mechanical) repairs += 10000;
  if (lead.foundation) repairs += 20000;
  return repairs;
}

function calculateOffer(arv: number, repairs: number): number {
  if (!arv) return 0;
  return Math.max((arv * 0.7) - repairs, 0);
}

function calculateProfit(arv: number, offer: number): number {
  if (!arv || !offer) return 0;
  return Math.max(arv - offer, 0);
}

async function fetchPropertyDataFromRentCast(lead: Record<string, any>) {
  const address = [
    lead.property_address,
    lead.city,
    lead.state,
    lead.zip
  ].filter(Boolean).join(", ");

  if (!address) return null;

  const url = new URL("https://api.rentcast.io/v1/properties");
  url.searchParams.set("address", address);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Api-Key": process.env.RENTCAST_API_KEY!,
      "Accept": "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RentCast lookup failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0];
}

export async function POST(req: Request) {
  const body = await req.json();
  const { captchaToken, ...lead } = body;

  // 1) Verify reCAPTCHA v3
  const captchaVerify = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `secret=${process.env.RECAPTCHA_SECRET}&response=${captchaToken}`
    }
  );

  const captcha = await captchaVerify.json();

  if (!captcha.success || captcha.score < 0.5) {
    return Response.json({ success: false, error: "captcha_failed" }, { status: 400 });
  }

  // 2) Enrich property data
  let propertyApiPayload: any = null;
  let estimatedArv = 0;

  try {
    propertyApiPayload = await fetchPropertyDataFromRentCast(lead);

    // Adjust these field names based on the actual RentCast response you receive
    estimatedArv =
      toNumber(propertyApiPayload?.value) ||
      toNumber(propertyApiPayload?.price) ||
      toNumber(propertyApiPayload?.avm) ||
      0;

    if (!lead.property_sqft && propertyApiPayload?.squareFootage) {
      lead.property_sqft = propertyApiPayload.squareFootage;
    }

    if (!lead.year_built && propertyApiPayload?.yearBuilt) {
      lead.year_built = propertyApiPayload.yearBuilt;
    }

    if (!lead.bedrooms && propertyApiPayload?.bedrooms) {
      lead.bedrooms = propertyApiPayload.bedrooms;
    }

    if (!lead.bathrooms && propertyApiPayload?.bathrooms) {
      lead.bathrooms = propertyApiPayload.bathrooms;
    }
  } catch (err) {
    console.error("Property enrichment error:", err);
  }

  // 3) Compute metrics
  const leadScore = calculateLeadScore(lead);
  const estimatedRepairs = estimateRepairs(lead);
  const suggestedOffer = calculateOffer(estimatedArv, estimatedRepairs);
  const estimatedProfit = calculateProfit(estimatedArv, suggestedOffer);

  // 4) Insert into Supabase
  const { error } = await supabase
    .from("seller_leads")
    .insert([{
      ...lead,
      lead_score: leadScore,
      estimated_arv: estimatedArv,
      estimated_repairs: estimatedRepairs,
      suggested_offer: suggestedOffer,
      estimated_profit: estimatedProfit,
      property_api_source: propertyApiPayload ? "rentcast" : null,
      property_api_payload: propertyApiPayload
    }]);

  if (error) {
    console.error(error);
    return Response.json({ success: false, error: "insert_failed" }, { status: 500 });
  }

  return Response.json({
    success: true,
    leadScore,
    estimatedArv,
    estimatedRepairs,
    suggestedOffer,
    estimatedProfit
  });
}