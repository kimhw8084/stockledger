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
  ],
};
