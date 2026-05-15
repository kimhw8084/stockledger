import { ProviderHealthEntry } from "../types";
import { providerAvailability, providerConfig } from "./providerConfig";

const nowIso = () => new Date().toISOString();

const safeFetch = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response;
};

const parseAlphaVantageHealth = async (): Promise<ProviderHealthEntry> => {
  if (!providerAvailability.alphaVantage) {
    return {
      provider: "Alpha Vantage",
      configured: false,
      status: "Unconfigured",
      mode: "On Demand",
      note: "Missing API key.",
      endpoint: "SYMBOL_SEARCH",
      lastCheckedAt: nowIso(),
    };
  }

  try {
    const response = await safeFetch(
      `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=AAPL&apikey=${providerConfig.alphaVantageKey}`,
    );
    const payload = (await response.json()) as { bestMatches?: unknown[]; Information?: string; Note?: string };
    const status =
      payload.Note || payload.Information
        ? "Plan Limited"
        : Array.isArray(payload.bestMatches)
          ? "Healthy"
          : "Error";

    return {
      provider: "Alpha Vantage",
      configured: true,
      status,
      mode: "On Demand",
      note:
        status === "Healthy"
          ? "Free key works. Use sparingly because the free tier is low-volume."
          : payload.Note || payload.Information || "Unexpected Alpha Vantage response.",
      endpoint: "SYMBOL_SEARCH",
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      provider: "Alpha Vantage",
      configured: true,
      status: "Error",
      mode: "On Demand",
      note: error instanceof Error ? error.message : "Unknown Alpha Vantage error.",
      endpoint: "SYMBOL_SEARCH",
      lastCheckedAt: nowIso(),
    };
  }
};

const parseTwelveDataHealth = async (): Promise<ProviderHealthEntry> => {
  if (!providerAvailability.twelveData) {
    return {
      provider: "Twelve Data",
      configured: false,
      status: "Unconfigured",
      mode: "On Demand",
      note: "Missing API key.",
      endpoint: "/time_series",
      lastCheckedAt: nowIso(),
    };
  }

  try {
    const response = await safeFetch(
      `https://api.twelvedata.com/time_series?symbol=AAPL&interval=1day&outputsize=2&apikey=${providerConfig.twelveDataKey}`,
    );
    const payload = (await response.json()) as { values?: unknown[]; status?: string; message?: string; code?: number };
    const status = Array.isArray(payload.values)
      ? "Healthy"
      : payload.code === 429 || payload.status === "error"
        ? "Plan Limited"
        : "Error";

    return {
      provider: "Twelve Data",
      configured: true,
      status,
      mode: "On Demand",
      note:
        status === "Healthy"
          ? "Market-data endpoint works. Higher-cost fundamental endpoints are not auto-polled on the free tier."
          : payload.message || "Unexpected Twelve Data response.",
      endpoint: "/time_series",
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      provider: "Twelve Data",
      configured: true,
      status: "Error",
      mode: "On Demand",
      note: error instanceof Error ? error.message : "Unknown Twelve Data error.",
      endpoint: "/time_series",
      lastCheckedAt: nowIso(),
    };
  }
};

const parseMarketauxHealth = async (): Promise<ProviderHealthEntry> => {
  if (!providerAvailability.marketaux) {
    return {
      provider: "Marketaux",
      configured: false,
      status: "Unconfigured",
      mode: "On Demand",
      note: "Missing API token.",
      endpoint: "/v1/news/all",
      lastCheckedAt: nowIso(),
    };
  }

  try {
    const response = await safeFetch(
      `https://api.marketaux.com/v1/news/all?symbols=AAPL&filter_entities=true&limit=1&language=en&api_token=${providerConfig.marketauxKey}`,
    );
    const payload = (await response.json()) as { data?: unknown[]; error?: { message?: string } };
    const status = Array.isArray(payload.data) ? "Healthy" : payload.error ? "Plan Limited" : "Error";

    return {
      provider: "Marketaux",
      configured: true,
      status,
      mode: "On Demand",
      note:
        status === "Healthy"
          ? "News endpoint works. The free tier should be used only for stock detail or alert review, not background polling."
          : payload.error?.message || "Unexpected Marketaux response.",
      endpoint: "/v1/news/all",
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      provider: "Marketaux",
      configured: true,
      status: "Error",
      mode: "On Demand",
      note: error instanceof Error ? error.message : "Unknown Marketaux error.",
      endpoint: "/v1/news/all",
      lastCheckedAt: nowIso(),
    };
  }
};

export const getProviderHealth = async (): Promise<ProviderHealthEntry[]> => {
  const stooqEntry: ProviderHealthEntry = {
    provider: "Stooq",
    configured: true,
    status: "Healthy",
    mode: "Disabled",
    note: "Configured and available, but currently parked while the app stays dummy-backed.",
    endpoint: "q/d/l",
    lastCheckedAt: nowIso(),
  };

  const [alpha, twelve, marketaux] = await Promise.all([
    parseAlphaVantageHealth(),
    parseTwelveDataHealth(),
    parseMarketauxHealth(),
  ]);

  return [stooqEntry, alpha, twelve, marketaux];
};
