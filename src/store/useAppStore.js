import { create } from 'zustand';
import { NIFTY_500_STOCKS } from '../data/nifty500';
import { 
  getFavorites, 
  toggleFavoriteInDB, 
  getUniverseCache, 
  saveUniverseCache, 
  getDatabaseStats,
  clearCache
} from '../db/jsonDbClient';
import { fetchStockOHLC } from '../utils/fetchOHLC';
import { computeIndicators } from '../utils/divergence';

export const useAppStore = create((set, get) => ({
  // Theme State ('dark' | 'light')
  theme: localStorage.getItem('screener_theme') || 'dark',

  // Data State
  stocks: [],
  favorites: [],
  selectedStock: null,
  selectedStockCandles: [],
  selectedStockIndicators: null,
  selectedStockSource: 'cache',
  
  // Scanner State
  isScanning: false,
  scanProgress: { current: 0, total: 0, symbol: '', percent: 0 },
  scanCancelled: false,

  // Filters State
  filters: {
    search: '',
    industry: 'ALL',
    preset: 'ALL',
    minScore: -100,
    maxScore: 100,
    minRsi: 0,
    maxRsi: 100,
    volumeSurgeOnly: false,
    favoritesOnly: false,
    macdBullishOnly: false,
    near52WHighOnly: false,
    minSlope: -100,
  },

  // Sorting
  sort: {
    column: 'compositeScore',
    direction: 'desc'
  },

  // Chart Overlays
  chartToggles: {
    ema20: true,
    ema50: true,
    ema100: true,
    ema200: true,
    volume: true
  },

  // UI Navigation
  activeTab: 'screener', // 'screener' | 'chart' | 'watchlist'
  settingsOpen: false,
  dbStats: {
    priceCount: 0,
    universeCount: 0,
    favCount: 0,
    cachedSymbolsCount: 0,
    threeYearSymbolsCount: 0,
    earliestDate: 'N/A',
    latestDate: 'N/A',
    estimatedSizeMB: '0.00'
  },

  // Actions
  toggleTheme: () => {
    const currentTheme = get().theme;
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('screener_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    set({ theme: nextTheme });
  },

  setTheme: (newTheme) => {
    localStorage.setItem('screener_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    set({ theme: newTheme });
  },

  initialize: async () => {
    try {
      // Set theme attribute on document root
      const currentTheme = get().theme;
      document.documentElement.setAttribute('data-theme', currentTheme);

      // 1. Load favorites from persistent DB
      let favs = [];
      try {
        favs = await getFavorites();
      } catch (e) {
        console.warn('Error loading favorites:', e);
      }

      // 2. Load cached universe from persistent DB across sessions
      let cachedUniverse = [];
      try {
        cachedUniverse = await getUniverseCache();
      } catch (e) {
        console.warn('Error loading universe cache:', e);
      }

      let initialStocks;
      const hasCachedUniverse = cachedUniverse && cachedUniverse.length > 0;

      if (hasCachedUniverse) {
        initialStocks = cachedUniverse;
      } else {
        // Map basic stocks from nifty500
        initialStocks = NIFTY_500_STOCKS.map(s => ({
          ...s,
          price: 0,
          changePercent1D: 0,
          compositeScore: 0,
          rsi: 50,
          volumeSurge: 1.0,
          priceVsEma20: 0,
          ema20VsEma50: 0,
          ema50VsEma200: 0,
          slopeEma20: 0,
          slopeEma50: 0,
          isGoldenStack: false,
          isDeathStack: false,
          isGoldenCross: false,
          isPullbackEMA20: false,
          isPullbackEMA50: false,
          isMacdBullish: false,
          isNear52WHigh: false,
          distFrom52WHigh: 0,
          macd: null,
          lastScanned: null
        }));
      }

      const stockMap = new Map();
      (initialStocks || []).forEach(s => {
        if (s && s.symbol) stockMap.set(s.symbol, s);
      });
      const uniqueStocks = Array.from(stockMap.values());
      const uniqueFavs = Array.from(new Set((favs || []).filter(Boolean)));

      set({
        stocks: uniqueStocks,
        favorites: uniqueFavs,
      });

      // Refresh DB stats
      try {
        await get().refreshDbStats();
      } catch (e) {
        console.warn('Error refreshing db stats:', e);
      }

      // Select default stock (RELIANCE or first stock) without forcing network re-fetch
      const defaultSymbol = initialStocks.some(s => s.symbol === 'RELIANCE') ? 'RELIANCE' : initialStocks[0]?.symbol;
      if (defaultSymbol) {
        try {
          get().selectStock(defaultSymbol, false);
        } catch (e) {
          console.warn('Error selecting default stock:', e);
        }
      }

      // Auto-scan top stocks ONLY if universe has NEVER been scanned before
      if (!hasCachedUniverse) {
        const popularStocks = [
          'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 
          'BHARTIARTL', 'ITC', 'SBIN', 'LT', 'BAJFINANCE',
          'TATAMOTORS', 'SUNPHARMA', 'MARUTI', 'AXISBANK', 'TITAN',
          'ULTRACEMCO', 'NTPC', 'POWERGRID', 'ONGC', 'TATASTEEL',
          'ADANIENT', 'ADANIPORTS', 'KOTAKBANK', 'HINDUNILVR', 'WIPRO'
        ];
        try {
          get().scanBatch(popularStocks, false);
        } catch (e) {
          console.warn('Error starting auto-scan:', e);
        }
      }
    } catch (err) {
      console.error('Fatal initialization error:', err);
      // Emergency fallback so UI is NEVER blank or dead
      set({
        stocks: NIFTY_500_STOCKS.map(s => ({ ...s, price: 0, rsi: 50, compositeScore: 0 })),
        favorites: []
      });
    }
  },

  refreshDbStats: async () => {
    const stats = await getDatabaseStats();
    set({ dbStats: stats });
  },

  setSettingsOpen: (isOpen) => set({ settingsOpen: isOpen }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },

  resetFilters: () => {
    set({
      filters: {
        search: '',
        industry: 'ALL',
        preset: 'ALL',
        minScore: -100,
        maxScore: 100,
        minRsi: 0,
        maxRsi: 100,
        volumeSurgeOnly: false,
        favoritesOnly: false,
        macdBullishOnly: false,
        near52WHighOnly: false,
        minSlope: -100,
      }
    });
  },

  setSort: (column) => {
    set((state) => {
      if (state.sort.column === column) {
        return {
          sort: {
            column,
            direction: state.sort.direction === 'desc' ? 'asc' : 'desc'
          }
        };
      }
      return {
        sort: { column, direction: 'desc' }
      };
    });
  },

  setChartToggle: (indicator) => {
    set((state) => ({
      chartToggles: {
        ...state.chartToggles,
        [indicator]: !state.chartToggles[indicator]
      }
    }));
  },

  toggleFavorite: async (symbol) => {
    const isNowFav = await toggleFavoriteInDB(symbol);
    set((state) => {
      const favs = isNowFav 
        ? [...state.favorites, symbol] 
        : state.favorites.filter(s => s !== symbol);
      return { favorites: favs };
    });
    get().refreshDbStats();
  },

  selectStock: async (symbol, forceRefresh = false) => {
    const clean = symbol.trim().toUpperCase();
    const result = await fetchStockOHLC(clean, forceRefresh);
    const indicators = computeIndicators(result.data);

    set({
      selectedStock: clean,
      selectedStockCandles: result.data,
      selectedStockIndicators: indicators,
      selectedStockSource: result.source
    });

    // Update the stock's record in store and persistent DB if indicators computed
    if (indicators) {
      let updatedStockRecord = null;
      set((state) => {
        const updatedStocks = state.stocks.map(s => {
          if (s.symbol === clean) {
            updatedStockRecord = {
              ...s,
              price: indicators.price,
              change1D: indicators.change1D,
              changePercent1D: indicators.changePercent1D,
              compositeScore: indicators.compositeScore,
              rsi: indicators.rsi,
              volumeSurge: indicators.volumeSurge,
              priceVsEma20: indicators.priceVsEma20,
              ema20VsEma50: indicators.ema20VsEma50,
              ema50VsEma200: indicators.ema50VsEma200,
              slopeEma20: indicators.slopeEma20,
              slopeEma50: indicators.slopeEma50,
              slopeScore: indicators.slopeScore,
              slopeAngle: indicators.slopeAngle,
              isGoldenStack: indicators.isGoldenStack,
              isDeathStack: indicators.isDeathStack,
              isGoldenCross: indicators.isGoldenCross,
              isPullbackEMA20: indicators.isPullbackEMA20,
              isPullbackEMA50: indicators.isPullbackEMA50,
              isMacdBullish: Boolean(indicators.macd && (indicators.macd.histogram > 0 || indicators.macd.macd > indicators.macd.signal)),
              isNear52WHigh: Boolean(indicators.distFrom52WHigh !== undefined && Math.abs(indicators.distFrom52WHigh) <= 5),
              distFrom52WHigh: indicators.distFrom52WHigh,
              macd: indicators.macd,
              lastScanned: new Date().toISOString()
            };
            return updatedStockRecord;
          }
          return s;
        });
        return { stocks: updatedStocks };
      });

      // Persist individual updated stock to universe table
      if (updatedStockRecord) {
        try {
          await saveUniverseCache([updatedStockRecord]);
        } catch (e) {
          console.warn('Error saving updated stock to universe DB:', e);
        }
      }
    }

    get().refreshDbStats();
  },

  cancelScan: () => {
    set({ scanCancelled: true, isScanning: false });
  },

  scanBatch: async (symbolsToScan, forceRefresh = false) => {
    if (get().isScanning) return;

    set({
      isScanning: true,
      scanCancelled: false,
      scanProgress: { current: 0, total: symbolsToScan.length, symbol: '', percent: 0 }
    });

    const currentStocks = [...get().stocks];
    const total = symbolsToScan.length;

    // Scan with concurrency throttle
    const concurrency = 4;
    for (let i = 0; i < total; i += concurrency) {
      if (get().scanCancelled) break;

      const batch = symbolsToScan.slice(i, i + concurrency);
      
      await Promise.all(batch.map(async (sym) => {
        try {
          const res = await fetchStockOHLC(sym, forceRefresh);
          const ind = computeIndicators(res.data);
          if (ind) {
            const idx = currentStocks.findIndex(s => s.symbol === sym);
            if (idx !== -1) {
              currentStocks[idx] = {
                ...currentStocks[idx],
                price: ind.price,
                change1D: ind.change1D,
                changePercent1D: ind.changePercent1D,
                compositeScore: ind.compositeScore,
                rsi: ind.rsi,
                volumeSurge: ind.volumeSurge,
                priceVsEma20: ind.priceVsEma20,
                ema20VsEma50: ind.ema20VsEma50,
                ema50VsEma200: ind.ema50VsEma200,
                slopeEma20: ind.slopeEma20,
                slopeEma50: ind.slopeEma50,
                slopeScore: ind.slopeScore,
                slopeAngle: ind.slopeAngle,
                isGoldenStack: ind.isGoldenStack,
                isDeathStack: ind.isDeathStack,
                isGoldenCross: ind.isGoldenCross,
                isPullbackEMA20: ind.isPullbackEMA20,
                isPullbackEMA50: ind.isPullbackEMA50,
                isMacdBullish: Boolean(ind.macd && (ind.macd.histogram > 0 || ind.macd.macd > ind.macd.signal)),
                isNear52WHigh: Boolean(ind.distFrom52WHigh !== undefined && Math.abs(ind.distFrom52WHigh) <= 5),
                distFrom52WHigh: ind.distFrom52WHigh,
                macd: ind.macd,
                lastScanned: new Date().toISOString()
              };
            }
          }
        } catch (err) {
          console.warn(`Error scanning ${sym}:`, err);
        }
      }));

      const progressCount = Math.min(total, i + concurrency);
      set({
        stocks: [...currentStocks],
        scanProgress: {
          current: progressCount,
          total,
          symbol: batch[batch.length - 1],
          percent: Math.round((progressCount / total) * 100)
        }
      });

      // Pacing delay between batch chunks to avoid network throttling
      if (i + concurrency < total) {
        await new Promise(r => setTimeout(r, 60));
      }
    }

    // Save updated universe into IndexedDB (persists across sessions)
    await saveUniverseCache(currentStocks);

    set({
      isScanning: false,
      scanProgress: { current: total, total, symbol: '', percent: 100 }
    });

    get().refreshDbStats();
  },

  scanEntireUniverse: (forceRefresh = false) => {
    const allSymbols = get().stocks.map(s => s.symbol);
    get().scanBatch(allSymbols, forceRefresh);
  },

  clearAllData: async () => {
    await clearCache(false);
    set({
      favorites: [],
      selectedStockCandles: [],
      selectedStockIndicators: null
    });
    get().initialize();
  }
}));
