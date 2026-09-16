/** Only public configuration belongs in an Expo bundle. Provider credentials
 * are configured on the worker/server, never with EXPO_PUBLIC_* variables. */
export const providerConfig = {
  apiUrl: process.env.EXPO_PUBLIC_STOCKLEDGER_API_URL?.trim() ?? "",
};
