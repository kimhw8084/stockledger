import React from "react";
import { Pressable, Text, View } from "react-native";

import { FreshnessStatus, MockSnapshot, Stock } from "../../types";
import { formatLocaleNumber, t } from "../../lib/i18n";
import { AppLanguage } from "../../lib/preferences";
import { MotionSwap } from "../MotionSwap";

interface StockSuggestionItem {
  stock: Stock;
  snapshot?: MockSnapshot;
}

export const StockSearchPanel = ({
  styles,
  stockSearch,
  setStockSearch,
  topSuggestionId,
  openStockContext,
  hasStockQuery,
  stockSuggestions,
  selectedStockId,
  deferredStockSearch,
  recentStocksCount,
  setRecentStockIds,
  onAddStock,
  isCompactPhone,
  isVeryCompactPhone,
  Input,
  Button,
  stockSuggestionTrustLabel,
  language,
}: {
  styles: any;
  stockSearch: string;
  setStockSearch: (value: string) => void;
  topSuggestionId: string;
  openStockContext: (args: { stockId: string }) => void;
  hasStockQuery: boolean;
  stockSuggestions: StockSuggestionItem[];
  selectedStockId: string;
  deferredStockSearch: string;
  recentStocksCount: number;
  setRecentStockIds: React.Dispatch<React.SetStateAction<string[]>>;
  onAddStock: () => void;
  isCompactPhone: boolean;
  isVeryCompactPhone: boolean;
  Input: React.ComponentType<any>;
  Button: React.ComponentType<any>;
  stockSuggestionTrustLabel: (snapshot?: { isMock: boolean; freshness: FreshnessStatus } | null) => string;
  language: AppLanguage;
}) => (
  <View style={[styles.stockSearchShell, isCompactPhone ? styles.stockSearchShellCompact : null]}>
    <View style={[styles.stockSearchHeader, isVeryCompactPhone ? styles.stockSearchHeaderCompact : null]}>
      <View style={styles.flexOne}>
        <Input
          value={stockSearch}
          onChangeText={setStockSearch}
          placeholder={t(language, "stocks.search.placeholder")}
          autoCapitalize="characters"
          returnKeyType="search"
          onSubmitEditing={() => {
            if (!topSuggestionId) return;
            openStockContext({ stockId: topSuggestionId });
          }}
        />
      </View>
      {stockSearch.trim().length > 0 ? <Button label={t(language, "common.clear")} tone="ghost" onPress={() => setStockSearch("")} /> : null}
      <Button label={isVeryCompactPhone ? t(language, "common.new") : t(language, "common.add")} tone="secondary" onPress={onAddStock} />
    </View>
    <View style={styles.inlineBetween}>
      <View style={styles.searchSectionMeta}>
        <Text style={styles.suggestionLabel}>{hasStockQuery ? t(language, "stocks.search.suggestions") : language === "ko" ? "관심 종목" : "Your watchlist"}</Text>
        <Text style={styles.searchResultCount}>
          {stockSuggestions.length > 0 ? t(language, "stocks.search.resultCount", { count: stockSuggestions.length }) : hasStockQuery ? t(language, "stocks.search.resultCount", { count: 0 }) : t(language, "stocks.search.resultNone")}
        </Text>
      </View>
      {!hasStockQuery && recentStocksCount > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t(language, "stocks.search.clearRecent")} onPress={() => setRecentStockIds([])} hitSlop={8} style={styles.inlineUtilityButton}>
          <Text style={styles.inlineUtilityText}>{t(language, "stocks.search.clearRecent")}</Text>
        </Pressable>
      ) : null}
    </View>
    {hasStockQuery && topSuggestionId ? (
      <Text style={styles.searchAssistText}>{t(language, "stocks.search.assist")}</Text>
    ) : null}
    {stockSuggestions.length > 0 ? (
      <MotionSwap
        swapKey={`${hasStockQuery ? "query" : "recent"}-${deferredStockSearch.trim().toLowerCase()}-${stockSuggestions
          .map((item) => item.stock.id)
          .join("|")}`}
        y={8}
        scaleFrom={0.99}
        duration={180}
      >
        <View style={styles.stockSuggestionList}>
          {stockSuggestions.map((item) => {
            const isSelected = selectedStockId === item.stock.id;
            const isTopMatch = hasStockQuery && topSuggestionId === item.stock.id;
            const isExactSymbolMatch =
              hasStockQuery &&
              item.stock.symbol.toLowerCase() === deferredStockSearch.trim().toLowerCase();

            return (
              <Pressable
                key={`suggest-${item.stock.id}`}
                accessibilityRole="button" accessibilityLabel={t(language, "stocks.search.openStock", { symbol: item.stock.symbol, name: item.stock.name })}
                onPress={() => openStockContext({ stockId: item.stock.id })}
                style={({ pressed }) => [
                  styles.stockSuggestionRow,
                  isCompactPhone ? styles.stockSuggestionRowCompact : null,
                  isSelected ? styles.stockSuggestionRowActive : null,
                  pressed ? styles.stockSuggestionRowPressed : null,
                ]}
              >
                <View style={styles.stockSuggestionLead}>
                  <View style={styles.stockSuggestionAvatar}>
                    <Text style={styles.stockSuggestionAvatarText}>{item.stock.symbol.slice(0, 4)}</Text>
                  </View>
                  <View style={styles.flexOne}>
                    <View style={styles.stockSuggestionTitleRow}>
                      <Text
                        style={[styles.stockSuggestionSymbol, isSelected ? styles.stockSuggestionSymbolActive : null]}
                        numberOfLines={1}
                      >
                        {item.stock.symbol}
                      </Text>
                      {isExactSymbolMatch ? (
                        <Text style={styles.stockTopMatchLabel}>{t(language, "stocks.search.exact")}</Text>
                      ) : isTopMatch ? (
                        <Text style={styles.stockTopMatchLabel}>{t(language, "stocks.search.topMatch")}</Text>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.stockSuggestionName, isSelected ? styles.stockSuggestionNameActive : null]}
                      numberOfLines={1}
                    >
                      {item.stock.name}
                    </Text>
                  </View>
                </View>
                <View style={styles.stockSuggestionRight}>
                  <Text style={styles.stockSuggestionPrice}>
                    {item.snapshot && item.snapshot.freshness !== "Unavailable" ? `$${formatLocaleNumber(language, item.snapshot.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--"}
                  </Text>
                  <Text style={styles.stockSuggestionMeta} numberOfLines={1}>
                    {stockSuggestionTrustLabel(item.snapshot)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </MotionSwap>
    ) : (
      <View style={styles.emptySearchState}>
        <Text style={styles.emptySearchTitle}>{hasStockQuery ? t(language, "stocks.search.noMatchTitle") : t(language, "stocks.search.noRecentTitle")}</Text>
        <Text style={styles.emptySearchBody}>
          {hasStockQuery
            ? t(language, "stocks.search.noMatchBody")
            : t(language, "stocks.search.noRecentBody")}
        </Text>
        {hasStockQuery ? <Button label={t(language, "stocks.search.clearSearch")} tone="secondary" onPress={() => setStockSearch("")} /> : null}
      </View>
    )}
  </View>
);
