import type {
  Alert,
  Decision,
  Eye,
  MockSnapshot,
  Outcome,
  ProviderHealthEntry,
  ScanRun,
  Stock,
} from "../../types";

export interface TodayStockItem {
  stock: Stock;
  eyes: Eye[];
  snapshot?: MockSnapshot;
  openAlerts: Alert[];
  dominantEye?: Eye;
  decisions: Decision[];
}

export interface TodayScreenProps {
  language: "en" | "ko";
  stockDirectory: TodayStockItem[];
  urgentStocks: TodayStockItem[];
  opportunityStocks: TodayStockItem[];
  staleReviewStocks: TodayStockItem[];
  openAlertsCount: number;
  outcomes: Outcome[];
  latestScanRun?: Pick<ScanRun, "scanDate" | "latestExpectedTradingDate" | "status">;
  providerHealth: ProviderHealthEntry[];
  providerHealthLoading: boolean;
  onSelectStock: (stockId: string, eyeId?: string) => void;
  onOpenAlerts: () => void;
  onOpenRecipes: () => void;
  onOpenJournal: (eyeId?: string, alertId?: string) => void;
  fallbackFocusRef?: React.RefObject<any>;
}
