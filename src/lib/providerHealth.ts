import type { ProviderHealthEntry } from "../types";
/** Configuration reporting does not spend provider quota or claim a health check. */
export const getProviderHealth = async (): Promise<ProviderHealthEntry[]> => [
  { provider: "Stooq", configured: false, status: "Unconfigured", mode: "On Demand", note: "Public research adapter available on explicit refresh. No request has been checked. CSV import works offline.", endpoint: "q/d/l" },
  ...(["Alpha Vantage", "Twelve Data", "Marketaux"] as const).map(provider => ({ provider, configured: false, status: "Unconfigured" as const, mode: "Disabled" as const, note: "Configure licensed data on a server or local worker. No provider keys are included in this app." })),
];
