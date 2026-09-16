import { ScannerSettings, UniverseMode, UniverseSnapshot } from "../types";
import { contentHash } from "../domain/contentHash";
import { parseCsvRows } from "./csv";
import { fetchText } from "./network";
import { ScannerSector, frozenScannerRules } from "./frozenScannerRules";

const SP500_CONSTITUENTS_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv";

const sectorNameToEtf: Record<string, ScannerSector | undefined> = {
  "Consumer Discretionary": "XLY",
  Industrials: "XLI",
  "Information Technology": "XLK",
};

const parseConstituentsCsv = (csv: string) => {
  const [header, ...rows] = parseCsvRows(csv, 2000);
  if (!header || header[0] !== "Symbol" || header[2] !== "Sector") throw new Error("Unexpected universe columns.");
  if (rows.length < 400 || rows.length > 600) throw new Error("Unexpected constituent count.");
  return rows.map(parts => ({ symbol: parts[0].trim(), name: parts[1].trim(), sector: parts[2].trim() }));
};

const buildSnapshot = (
  universeMode: UniverseMode,
  universeSource: string,
  universeSourceStatus: UniverseSnapshot["universeSourceStatus"],
  sectorMembers: Record<ScannerSector, string[]>,
  warning?: string,
  addedTickers?: string[],
  removedTickers?: string[],
): UniverseSnapshot => {
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const sectorSnapshots = Object.entries(sectorMembers).map(([sector, tickers]) => ({
    sector,
    tickers: [...new Set(tickers)].sort(),
  }));
  const snapshotHash = contentHash(sectorSnapshots);
  return {
    id: `universe-${snapshotDate}-${snapshotHash}`,
    universeMode,
    universeSource,
    universeSourceStatus,
    snapshotDate,
    snapshotHash,
    fetchedAtUtc: new Date().toISOString(),
    sectorSnapshots,
    addedTickers,
    removedTickers,
    warning,
  };
};

const buildFrozenFallback = (
  settings: ScannerSettings,
  warning: string,
) =>
  buildSnapshot(
    "frozen_research_universe",
    "manual_frozen_config",
    "frozen_import_fallback",
    {
      XLY: settings.frozenUniverseBySector?.XLY ?? [],
      XLI: settings.frozenUniverseBySector?.XLI ?? [],
      XLK: settings.frozenUniverseBySector?.XLK ?? [],
    },
    warning,
  );

export const loadDynamicCurrentUniverse = async (
  settings: ScannerSettings,
  previousSnapshot?: UniverseSnapshot,
): Promise<UniverseSnapshot> => {
  if (settings.universeMode === "frozen_research_universe") {
    return buildFrozenFallback(settings, "Explicit frozen research universe; no dynamic membership request.");
  }
  try {
    const rows = parseConstituentsCsv(await fetchText(SP500_CONSTITUENTS_URL));
    const targetSectors = new Set(frozenScannerRules.map((rule) => rule.sector));
    const sectorMembers = rows.reduce<Record<ScannerSector, string[]>>(
      (acc, row) => {
        const mapped = sectorNameToEtf[row.sector];
        if (mapped && targetSectors.has(mapped)) {
          acc[mapped].push(row.symbol.replace(/\./g, "-").toUpperCase());
        }
        return acc;
      },
      { XLY: [], XLI: [], XLK: [] },
    );

    if (Object.values(sectorMembers).some(members => members.length === 0)) throw new Error("Universe is missing a required sector.");
    const previousSymbols = new Set(previousSnapshot?.sectorSnapshots.flatMap((item) => item.tickers) ?? []);
    const nextSymbols = new Set(Object.values(sectorMembers).flat());
    const addedTickers = [...nextSymbols].filter((ticker) => !previousSymbols.has(ticker)).sort();
    const removedTickers = [...previousSymbols].filter((ticker) => !nextSymbols.has(ticker)).sort();

    return buildSnapshot(
      "dynamic_current_universe",
      SP500_CONSTITUENTS_URL,
      "dynamic_current_universe",
      sectorMembers,
      undefined,
      addedTickers,
      removedTickers,
    );
  } catch (error) {
    if (settings.fallbackToFrozenUniverse && settings.frozenUniverseBySector) {
      return buildFrozenFallback(
        settings,
        error instanceof Error ? error.message : "current universe unavailable",
      );
    }
    return buildSnapshot(
      "dynamic_current_universe",
      SP500_CONSTITUENTS_URL,
      "current_universe_unavailable",
      { XLY: [], XLI: [], XLK: [] },
      error instanceof Error ? error.message : "current universe unavailable",
    );
  }
};

export const requiredSymbolsForRules = (snapshot: UniverseSnapshot) => {
  const sectorMap = snapshot.sectorSnapshots.reduce<Record<string, string[]>>((acc, item) => {
    acc[item.sector] = item.tickers;
    return acc;
  }, {});
  const symbols = new Set<string>(["SPY", "XLY", "XLI", "XLK"]);
  frozenScannerRules.forEach((rule) => {
    (sectorMap[rule.sector] ?? []).forEach((ticker) => symbols.add(ticker));
  });
  return [...symbols];
};
