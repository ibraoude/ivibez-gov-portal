async function geocodeAddress(address: string) {
  if (!process.env.GOOGLE_MAPS_SERVER_KEY) {
    throw new Error("Missing GOOGLE_MAPS_SERVER_KEY");
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${process.env.GOOGLE_MAPS_SERVER_KEY}`,
    { cache: "no-store" } // prevent caching during dev
  );

  if (!res.ok) {
    throw new Error(`Google API HTTP error: ${res.status}`);
  }

  const data = await res.json();

  if (data.status !== "OK") {
    throw new Error(
      `Geocoding failed: ${data.status} - ${data.error_message || "No message"}`
    );
  }

  if (!data.results || data.results.length === 0) {
    throw new Error("No geocoding results found");
  }

  const result = data.results[0];

  const components = result.address_components;

  const getComponent = (type: string) =>
    components.find((c: any) => c.types.includes(type))?.long_name || null;

  return {
    formattedAddress: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    state: getComponent("administrative_area_level_1"),
    county: getComponent("administrative_area_level_2"),
    city: getComponent("locality"),
  };
}

import { NextResponse } from "next/server";

type FinishQuality = "basic" | "standard" | "premium" | "luxury";
type PropertyType = "single-family" | "multi-family" | "commercial" | "mixed-use";

type DevelopmentOptions = {
  propertyType: PropertyType;
  squareFeet: number;
  units?: number;
  stories: number;
  finishQuality: FinishQuality;
};

// Optional financing inputs (you can add these later on the UI)
// If you don't pass them, defaults are used.
type FinancingInputs = {
  enabled?: boolean;
  loanToCost?: number;     // e.g. 0.8 = 80% LTC
  interestRate?: number;   // e.g. 0.105 = 10.5%
  points?: number;         // e.g. 0.02 = 2 points
  holdingMonths?: number;  // e.g. 6
  closingCostRate?: number; // e.g. 0.03 = 3% of sale
  downPaymentRate?: number; // fallback if no LTC (for purchase)
};

type Strategy = "flip" | "ground-up" | "government";
type RequestBody = {
  address: string;
  developmentOptions: DevelopmentOptions;
  strategy: Strategy;
  financing?: FinancingInputs;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function money(n: number) {
  return Math.round(n);
}

/**
 * V1 “auto estimates”:
 * - Market price per sqft derived from state-tier defaults (replace later with real comps).
 * - Land value + purchase price derived from market baseline.
 * - Rehab/condition derived from finishQuality + propertyType rules.
 * - Build costs derived from cost-per-sqft tables.
 */
const MARKET_BASELINES: Record<string, { pricePerSqFt: number; daysOnMarket: number }> = {
  // You can expand this later or store in DB
  MD: { pricePerSqFt: 240, daysOnMarket: 22 },
  VA: { pricePerSqFt: 230, daysOnMarket: 24 },
  DC: { pricePerSqFt: 420, daysOnMarket: 18 },
  PA: { pricePerSqFt: 210, daysOnMarket: 28 },
  DE: { pricePerSqFt: 200, daysOnMarket: 27 },
  DEFAULT: { pricePerSqFt: 220, daysOnMarket: 30 },
};

const BUILD_COST_PER_SQFT: Record<FinishQuality, number> = {
  basic: 120,
  standard: 165,
  premium: 230,
  luxury: 310,
};

const REHAB_COST_PER_SQFT: Record<FinishQuality, number> = {
  basic: 25,      // light cosmetic
  standard: 45,   // moderate rehab
  premium: 70,    // heavy rehab
  luxury: 95,     // high-end / full gut
};

function inferStateFromAddress(address: string): string {
  // Very lightweight inference (v1).
  // Later: replace with Google Geocoding to get exact state/county.
  const upper = address.toUpperCase();
  const states = ["MD", "VA", "DC", "PA", "DE"];
  const found = states.find((s) => upper.includes(` ${s}`) || upper.endsWith(s));
  return found ?? "DEFAULT";
}

function computeCondition(finishQuality: FinishQuality) {
  // Auto-calc "condition" label based on finishQuality choice (v1)
  switch (finishQuality) {
    case "basic": return "Fair (cosmetic updates)";
    case "standard": return "Average (moderate rehab)";
    case "premium": return "Poor (heavy rehab)";
    case "luxury": return "Full gut / high complexity";
  }
}

function pickMarketTrend(daysOnMarket: number): "hot" | "moderate" | "slow" {
  if (daysOnMarket <= 21) return "hot";
  if (daysOnMarket <= 45) return "moderate";
  return "slow";
}

function getCountyLandRate(county: string) {
  const rates: Record<string, number> = {
    "Montgomery County": 22,
    "Prince George's County": 18,
    "Fairfax County": 28,
  };

  return rates[county] ?? 20;
}

function calculateLandValue({
  strategy,
  estimatedSellPrice,
  purchasePrice,
  lotSize,
  county,
}: {
  strategy: string;
  estimatedSellPrice: number;
  purchasePrice?: number;
  lotSize?: number;
  county: string;
}) {

  if (strategy === "flip") {
    return purchasePrice
      ? purchasePrice * 0.25
      : estimatedSellPrice * 0.25;
  }

  if (strategy === "ground-up") {
    const landRate = getCountyLandRate(county);
    return lotSize
      ? lotSize * landRate
      : estimatedSellPrice * 0.30;
  }

  if (strategy === "government") {
    return estimatedSellPrice * 0.20;
  }

  return estimatedSellPrice * 0.25;
}

function getFinancingModel(strategy: string) {
  if (strategy === "flip") {
    return {
      leverage: 0.80,      // 80% LTV
      interestRate: 0.12,  // 12% hard money
      termMonths: 9
    };
  }

  if (strategy === "ground-up") {
    return {
      leverage: 0.70,      // 70% LTC
      interestRate: 0.08,  // 8% construction loan
      termMonths: 18
    };
  }

  if (strategy === "government") {
    return {
      leverage: 0.60,
      interestRate: 0.05,
      termMonths: 24
    };
  }

  return {
    leverage: 0.75,
    interestRate: 0.09,
    termMonths: 12
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    if (!body?.address?.trim()) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }
    if (!body?.developmentOptions?.squareFeet || body.developmentOptions.squareFeet < 300) {
      return NextResponse.json({ error: "Square feet must be at least 300" }, { status: 400 });
    }

    const { address, developmentOptions, strategy } = body;
    const geo = await geocodeAddress(address);
    const state = geo.state ?? "DEFAULT";
    const market = MARKET_BASELINES[state] ?? MARKET_BASELINES.DEFAULT;

    // --- Market estimates ---
    const avgPricePerSqFt = market.pricePerSqFt;
    const estimatedSellPrice = money(avgPricePerSqFt * developmentOptions.squareFeet);
    

    // --- Land + Purchase price estimate (v1 heuristic) ---
    // Assume land is ~18% of finished value for SF; increase for commercial/mixed-use.
    let landRatio: number;

      if (strategy === "flip") {
        landRatio =
          developmentOptions.propertyType === "commercial" ? 0.22 :
          developmentOptions.propertyType === "mixed-use" ? 0.20 :
          developmentOptions.propertyType === "multi-family" ? 0.18 :
          0.16;
      }

      else if (strategy === "ground-up") {
        landRatio =
          developmentOptions.propertyType === "commercial" ? 0.35 :
          developmentOptions.propertyType === "mixed-use" ? 0.32 :
          developmentOptions.propertyType === "multi-family" ? 0.28 :
          0.25;
      }

      else if (strategy === "government") {
        landRatio =
          developmentOptions.propertyType === "commercial" ? 0.18 :
          developmentOptions.propertyType === "mixed-use" ? 0.17 :
          developmentOptions.propertyType === "multi-family" ? 0.15 :
          0.14;
      }

      else {
        landRatio = 0.20;
      }

      
    const landValue = money(estimatedSellPrice * landRatio);

    // Purchase price (auto): land + discount factor depending on implied condition (finishQuality)
    const conditionDiscount =
      developmentOptions.finishQuality === "basic" ? 0.92 :
      developmentOptions.finishQuality === "standard" ? 0.88 :
      developmentOptions.finishQuality === "premium" ? 0.83 :
      0.78;

    const purchasePrice = money((estimatedSellPrice - landValue) * conditionDiscount);

    // --- Cost modeling ---
    const buildCostPerSqFt = BUILD_COST_PER_SQFT[developmentOptions.finishQuality];
    const rehabCostPerSqFt = REHAB_COST_PER_SQFT[developmentOptions.finishQuality];

    // Decide if this is "flip" vs "ground-up"
    // v1 rule: single-family = flip if finishQuality != luxury AND stories <=2; otherwise ground-up
    const isFlip =
      developmentOptions.propertyType === "single-family" &&
      developmentOptions.finishQuality !== "luxury";

    // Flip uses rehab; ground-up uses construction
    const construction = isFlip
      ? money(rehabCostPerSqFt * developmentOptions.squareFeet)
      : money(buildCostPerSqFt * developmentOptions.squareFeet);

    // Soft costs + fees (percent-based)
    const permitsAndFees = money(construction * 0.06);
    const architecture = money(construction * (isFlip ? 0.02 : 0.05));
    const softCosts = money(construction * 0.07);
    const contingency = money(construction * 0.10);
    const landPreparation = money(construction * (isFlip ? 0.03 : 0.07));

    const totalBuildCosts =
      landPreparation + construction + permitsAndFees + architecture + softCosts + contingency;

    
    const totalProjectCost = money(
      (purchasePrice ?? 0) + landValue + totalBuildCosts
    );

    // --- Financing model (strategy-aware defaults) ---

      const strategyDefaults =
        strategy === "flip"
          ? {
              loanToCost: 0.80,
              interestRate: 0.12,
              points: 0.02,
              holdingMonths: 6,
              closingCostRate: 0.03,
            }
          : strategy === "ground-up"
          ? {
              loanToCost: 0.70,
              interestRate: 0.08,
              points: 0.015,
              holdingMonths: 18,
              closingCostRate: 0.025,
            }
          : strategy === "government"
          ? {
              loanToCost: 0.60,
              interestRate: 0.05,
              points: 0.01,
              holdingMonths: 24,
              closingCostRate: 0.02,
            }
          : {
              loanToCost: 0.75,
              interestRate: 0.09,
              points: 0.02,
              holdingMonths: 12,
              closingCostRate: 0.03,
            };

      const financing: FinancingInputs = {
        enabled: true,
        ...strategyDefaults,
        ...(body.financing ?? {}),
      };

    const enabled = financing.enabled !== false;

    const loanToCost = clamp(financing.loanToCost ?? 0.8, 0, 0.95);
    const interestRate = clamp(financing.interestRate ?? 0.105, 0, 0.5);
    const points = clamp(financing.points ?? 0.02, 0, 0.08);
    const holdingMonths = clamp(financing.holdingMonths ?? (isFlip ? 6 : 12), 1, 36);
    const closingCostRate = clamp(financing.closingCostRate ?? 0.03, 0, 0.08);

    const loanAmount = enabled ? money(totalProjectCost * loanToCost) : 0;
    const cashNeeded = enabled ? money(totalProjectCost - loanAmount) : totalProjectCost;
    const equityRequired = totalProjectCost - loanAmount;

    const monthlyInterestOnly = enabled ? (loanAmount * interestRate) / 12 : 0;
    const interestTotal = money(monthlyInterestOnly * holdingMonths);

    const originationPoints = enabled ? money(loanAmount * points) : 0;
    const saleClosingCosts = money(estimatedSellPrice * closingCostRate);

    // Total investment includes financing costs as well
    const totalInvestment = money(totalProjectCost + interestTotal + originationPoints + saleClosingCosts);

    const estimatedProfit = money(
      estimatedSellPrice - totalInvestment
    );
    const profitMargin = estimatedSellPrice > 0 ? (estimatedProfit / estimatedSellPrice) * 100 : 0;
    const roi = equityRequired > 0 ? (estimatedProfit / equityRequired) * 100 : 0;
    const breakEvenPrice = totalInvestment;

    // Simple tax estimate (replace later with county assessor data)
    const assessedValue = money(estimatedSellPrice * 0.88);
    const taxRate = state === "MD" ? 1.1 : state === "VA" ? 1.0 : 1.2;
    const annualPropertyTax = money((assessedValue * (taxRate / 100)));

    // Recommendations & risks (v1)
    const recommendations: string[] = [];
    const risks: string[] = [];

    if (roi >= 15) recommendations.push("ROI looks strong for a typical investor target range.");
    if (roi >= 20) recommendations.push("Consider running a premium-finish scenario to see if ARV increase beats added cost.");
    if (roi < 10) recommendations.push("Margin is tight—reduce rehab scope, negotiate purchase price, or validate comps before proceeding.");

    if (isFlip) recommendations.push("For flips: verify repair scope, permits, and timeline assumptions before committing.");
    else recommendations.push("For new builds: confirm zoning/setbacks and utility connections early—these swing feasibility.");

    if (holdingMonths > 12) risks.push("Long holding period increases interest exposure and market risk.");
    if (developmentOptions.finishQuality === "luxury") risks.push("Luxury finishes increase cost volatility and buyer pool sensitivity.");
    if (estimatedProfit < 0) risks.push("Projected profit is negative under current assumptions—treat as a no-go until inputs are validated.");

    const marketTrend = pickMarketTrend(market.daysOnMarket);

    // Return EXACT structure your UI expects
    return NextResponse.json({
      address,
      formattedAddress: geo.formattedAddress,
      coordinates: { lat: geo.lat, lng: geo.lng },

      zoning: {
        code: "UNKNOWN",
        description: "Zoning not yet integrated (v1).",
        allowedUses: [developmentOptions.propertyType],
      },

      landValue,

      existingProperty: isFlip
        ? {
            yearBuilt: 1985,
            squareFeet: developmentOptions.squareFeet,
            condition: computeCondition(developmentOptions.finishQuality),
            estimatedValue: purchasePrice,
          }
        : undefined,

      buildingCosts: {
        landPreparation,
        construction,
        permitsAndFees,
        architecture,
        softCosts,
        contingency,
        total: totalBuildCosts,
        costPerSqFt: isFlip ? rehabCostPerSqFt : buildCostPerSqFt,
      },

      marketAnalysis: {
        averagePricePerSqFt: avgPricePerSqFt,
        estimatedSellPrice,
        daysOnMarket: market.daysOnMarket,
        marketTrend,
        comparables: [], // v1 empty (replace later with comps)
      },

      financialAnalysis: {
        totalInvestment,
        estimatedProfit,
        profitMargin,
        roi,
        breakEvenPrice,
      },

      taxInfo: {
        annualPropertyTax,
        taxRate,
        assessedValue,
      },

      recommendations,
      risks,
    });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}