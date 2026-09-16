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
      note: "API 키가 없습니다.",
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
          ? "무료 키는 동작하지만 한도가 낮으므로 아껴서 사용해야 합니다."
          : payload.Note || payload.Information || "예상하지 못한 Alpha Vantage 응답입니다.",
      endpoint: "SYMBOL_SEARCH",
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      provider: "Alpha Vantage",
      configured: true,
      status: "Error",
      mode: "On Demand",
      note: error instanceof Error ? error.message : "알 수 없는 Alpha Vantage 오류입니다.",
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
      note: "API 키가 없습니다.",
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
          ? "시세 엔드포인트는 정상입니다. 무료 구간에서는 비용이 큰 재무 엔드포인트를 자동 조회하지 않습니다."
          : payload.message || "예상하지 못한 Twelve Data 응답입니다.",
      endpoint: "/time_series",
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      provider: "Twelve Data",
      configured: true,
      status: "Error",
      mode: "On Demand",
      note: error instanceof Error ? error.message : "알 수 없는 Twelve Data 오류입니다.",
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
      note: "API 토큰이 없습니다.",
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
          ? "뉴스 엔드포인트는 정상입니다. 무료 구간에서는 백그라운드 폴링 대신 종목 상세나 알림 검토 때만 써야 합니다."
          : payload.error?.message || "예상하지 못한 Marketaux 응답입니다.",
      endpoint: "/v1/news/all",
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      provider: "Marketaux",
      configured: true,
      status: "Error",
      mode: "On Demand",
      note: error instanceof Error ? error.message : "알 수 없는 Marketaux 오류입니다.",
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
    note: "연결은 가능하지만 앱이 더미 데이터 모드인 동안은 대기 상태로 둡니다.",
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
