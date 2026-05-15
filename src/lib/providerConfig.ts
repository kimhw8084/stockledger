export interface ProviderConfig {
  alphaVantageKey: string;
  twelveDataKey: string;
  marketauxKey: string;
}

export const providerConfig: ProviderConfig = {
  alphaVantageKey: process.env.EXPO_PUBLIC_ALPHA_VANTAGE_KEY?.trim() ?? "",
  twelveDataKey: process.env.EXPO_PUBLIC_TWELVE_DATA_KEY?.trim() ?? "",
  marketauxKey: process.env.EXPO_PUBLIC_MARKETAUX_KEY?.trim() ?? "",
};

export const providerAvailability = {
  alphaVantage: Boolean(providerConfig.alphaVantageKey),
  twelveData: Boolean(providerConfig.twelveDataKey),
  marketaux: Boolean(providerConfig.marketauxKey),
};
