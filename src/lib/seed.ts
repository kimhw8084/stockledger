import { AppData } from "../types";

const now = new Date().toISOString();

export const seedData: AppData = {
  stocks: [
    {
      id: "stock-amd",
      symbol: "AMD",
      name: "Advanced Micro Devices",
      thesis:
        "High-quality semiconductor leader worth watching for a temporary bargain setup after a broad pullback.",
      createdAt: now,
    },
    {
      id: "stock-meli",
      symbol: "MELI",
      name: "MercadoLibre",
      thesis:
        "High-conviction compounder that can become interesting if a growth scare creates a temporary reset instead of structural damage.",
      createdAt: now,
    },
    {
      id: "stock-uber",
      symbol: "UBER",
      name: "Uber Technologies",
      thesis:
        "Execution story with improving profitability. Worth monitoring for either a quality pullback or thesis-risk deterioration.",
      createdAt: now,
    },
  ],
  recipes: [
    {
      id: "recipe-bargain-sale",
      version: 1,
      name: "Temporary Bargain Sale",
      purpose:
        "Spot a good company that looks temporarily mispriced after a meaningful decline and early stabilization.",
      timeHorizon: "Multi-week to multi-month",
      intendedUseCase: "Quality business in a temporary reset, not a structurally broken company.",
      notes:
        "Use for watchlist names you already trust. Avoid treating a collapsing business as a bargain.",
      createdAt: now,
      conditions: [
        {
          id: "c1",
          label: "Stock is down at least 25% from its recent high.",
          kind: "required",
        },
        {
          id: "c2",
          label: "Price is stabilizing near prior support.",
          kind: "supporting",
        },
        {
          id: "c3",
          label: "Valuation looks more attractive than recent baseline.",
          kind: "supporting",
        },
        {
          id: "c4",
          label: "Analyst revisions remain weak.",
          kind: "negative",
        },
        {
          id: "c5",
          label: "Hard disqualifier: thesis-broken event is present.",
          kind: "disqualifier",
        },
      ],
    },
    {
      id: "recipe-thesis-risk",
      version: 1,
      name: "Thesis Risk Monitor",
      purpose:
        "Watch a stock you already like for signs that the original thesis is weakening faster than price alone implies.",
      timeHorizon: "Daily to multi-week review",
      intendedUseCase: "Protect against silent drift from healthy pullback into value trap.",
      notes:
        "Best used when a stock is already on the watchlist and you want faster visibility into weakening evidence.",
      createdAt: now,
      conditions: [
        {
          id: "c6",
          label: "Analyst revisions are deteriorating or risk flags are accumulating.",
          kind: "required",
        },
        {
          id: "c7",
          label: "Earnings proximity can amplify uncertainty around a weak setup.",
          kind: "negative",
        },
        {
          id: "c8",
          label: "Hard disqualifier: clear thesis-broken event.",
          kind: "disqualifier",
        },
      ],
    },
  ],
  eyes: [
    {
      id: "eye-amd-bargain",
      stockId: "stock-amd",
      recipeId: "recipe-bargain-sale",
      thesisSnapshot:
        "Watch for a quality-led pullback that becomes attractive only if selling pressure slows and no structural damage appears.",
      createdAt: now,
    },
    {
      id: "eye-meli-bargain",
      stockId: "stock-meli",
      recipeId: "recipe-bargain-sale",
      thesisSnapshot:
        "Growth compounder worth attention if macro pressure creates discount without harming the long-run business case.",
      createdAt: now,
    },
    {
      id: "eye-uber-risk",
      stockId: "stock-uber",
      recipeId: "recipe-thesis-risk",
      thesisSnapshot:
        "If execution momentum weakens and risk flags rise, treat the setup as a thesis check rather than a dip-buy signal.",
      createdAt: now,
    },
  ],
  alerts: [],
  decisions: [],
  outcomes: [],
  snapshots: [
    {
      stockId: "stock-amd",
      price: 142.35,
      drawdownPct: -28,
      nearSupport: true,
      stabilizationScore: 71,
      valuationDiscount: true,
      analystRevisionTrend: "flat",
      earningsSoon: true,
      riskFlags: [],
      updatedAt: now,
      sourceName: "Mock Market Adapter",
      freshness: "Mock Data",
      isMock: true,
    },
    {
      stockId: "stock-meli",
      price: 1648.2,
      drawdownPct: -23,
      nearSupport: true,
      stabilizationScore: 67,
      valuationDiscount: true,
      analystRevisionTrend: "improving",
      earningsSoon: false,
      riskFlags: [],
      updatedAt: now,
      sourceName: "Mock Market Adapter",
      freshness: "Mock Data",
      isMock: true,
    },
    {
      stockId: "stock-uber",
      price: 73.18,
      drawdownPct: -14,
      nearSupport: false,
      stabilizationScore: 44,
      valuationDiscount: false,
      analystRevisionTrend: "weak",
      earningsSoon: true,
      riskFlags: ["guidance_pressure"],
      updatedAt: now,
      sourceName: "Mock Market Adapter",
      freshness: "Mock Data",
      isMock: true,
    },
  ],
};
