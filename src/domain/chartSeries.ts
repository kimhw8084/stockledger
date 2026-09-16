import type { MockSnapshot } from "../types";
export const lookbackSessions = { "20D": 21, "3M": 64, "6M": 127 } as const;
export function buildChartData(snapshot: MockSnapshot | undefined, lookback: keyof typeof lookbackSessions, benchmark: string) {
  const count = lookbackSessions[lookback];
  const prices = snapshot?.priceHistorySeries?.slice(-count) ?? [];
  const dates = snapshot?.historyDates?.slice(-count) ?? prices.map((_, i) => `Sample ${i + 1}`);
  const availableBenchmark = benchmark === (snapshot?.benchmarkSymbol ?? "SPY");
  const benchmarkMap = new Map((snapshot?.benchmarkDates ?? []).map((date, i) => [date, snapshot?.benchmarkHistorySeries?.[i]]));
  const aligned = availableBenchmark ? dates.map((date, i) => snapshot?.isMock && !snapshot.benchmarkDates ? snapshot.benchmarkHistorySeries?.slice(-count)[i] : benchmarkMap.get(date)) : [];
  // Do not plot incomplete comparisons as if both endpoints were synchronized.
  const benchmarkPrices = aligned.length && aligned.every(value => value !== undefined && value > 0) ? aligned as number[] : [];
  const rebased = (values: number[]) => values.length && values[0] > 0 ? values.map(value => (value / values[0] - 1) * 100) : [];
  return { prices, dates, benchmarkPrices, returns: rebased(prices), benchmarkReturns: rebased(benchmarkPrices) };
}
