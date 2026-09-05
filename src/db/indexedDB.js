import Dexie from 'dexie';

/**
 * Helper to get the most recent completed market trading date (YYYY-MM-DD)
 * for Indian markets (NSE/BSE).
 * If today is Saturday or Sunday, returns Friday's date.
 */
export function getLatestMarketTradingDate() {
  const now = new Date();
  // IST offset: UTC + 5:30
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);

  const dayOfWeek = istDate.getUTCDay(); // 0: Sunday, 6: Saturday
  const d = new Date(istDate);

  if (dayOfWeek === 0) {
    // Sunday -> go back 2 days to Friday
    d.setUTCDate(d.getUTCDate() - 2);
  } else if (dayOfWeek === 6) {
    // Saturday -> go back 1 day to Friday
    d.setUTCDate(d.getUTCDate() - 1);
  }

  return d.toISOString().split('T')[0];
}

/**
 * ScreenerDatabase: Persistent client-side local database using Dexie (IndexedDB)
 * Stores 2-year historical OHLCV candles, stock metadata, computed universe, and user favorites.
 */
export class ScreenerDatabase extends Dexie {
  constructor() {
    super('ScreenerMarketDB');

    // Schema definition
    // prices: compound primary key [symbol+date] guarantees atomic upserts & append mode without duplicate rows
    this.version(1).stores({
      prices: '[symbol+date], symbol, date',
      universe: 'symbol, industry, divergenceScore, lastScanned',
      favorites: 'symbol, addedAt',
      stockMeta: 'symbol, latestDate, firstDate, candleCount, lastScannedAt',
      scanLog: 'date, scannedCount, timestamp',
      filterPresets: 'id, name, isDefault',
      appMeta: 'key'
    });

    this.version(2).stores({
      stockMeta: 'symbol, latestDate, firstDate, candleCount, lastScannedAt, isSimulated',
    });
  }
}

export const db = new ScreenerDatabase();

/**
 * One-time cleanup to purge any corrupted legacy simulated data
 */
async function purgeCorruptedOrLegacyData() {
  try {
    const corruptedPrices = await db.prices
      .filter(p => p.close > 150000 && p.symbol !== 'MRF')
      .toArray();

    if (corruptedPrices.length > 0) {
      const corruptedSymbols = [...new Set(corruptedPrices.map(p => p.symbol))];
      console.warn(`[IndexedDB] Purging ${corruptedPrices.length} corrupted records for:`, corruptedSymbols);
      for (const sym of corruptedSymbols) {
        await db.prices.where('symbol').equals(sym).delete();
        await db.stockMeta.delete(sym);
      }
    }

    // Also purge any stocks previously tagged as isSimulated so they get fresh real Yahoo data
    const simulatedMetas = await db.stockMeta.filter(m => m.isSimulated === true).toArray();
    if (simulatedMetas.length > 0) {
      for (const m of simulatedMetas) {
        await db.prices.where('symbol').equals(m.symbol).delete();
        await db.stockMeta.delete(m.symbol);
      }
    }
  } catch (e) {
    console.warn('[IndexedDB] Purge check error:', e);
  }
}

purgeCorruptedOrLegacyData();

/**
 * Migrate legacy favorites from older ScreenerDB if present
 */
async function migrateLegacyDataIfNeeded() {
  try {
    const legacyDb = new Dexie('ScreenerDB');
    legacyDb.version(1).stores({
      prices: '++id, [symbol+date], symbol, date',
      universe: 'symbol, industry, divergenceScore, lastScanned',
      favorites: 'symbol, addedAt',
    });
    await legacyDb.open();
    const currentFavsCount = await db.favorites.count();
    if (currentFavsCount === 0) {
      const oldFavs = await legacyDb.table('favorites').toArray();
      if (oldFavs && oldFavs.length > 0) {
        await db.favorites.bulkPut(oldFavs);
      }
    }
  } catch {
    // Legacy database does not exist or migration not needed
  }
}

migrateLegacyDataIfNeeded();

/**
 * Get all cached historical OHLCV candles for a symbol, sorted chronologically
 */
export async function getCachedCandles(symbol) {
  try {
    const cleanSymbol = symbol.trim().toUpperCase();
    const rawCandles = await db.prices
      .where('symbol')
      .equals(cleanSymbol)
      .sortBy('date');

    return rawCandles.map(c => ({
      time: c.date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }));
  } catch (error) {
    console.error(`Error loading cached candles for ${symbol}:`, error);
    return [];
  }
}

/**
 * Get metadata for a specific stock (candle count, date range, last scan)
 */
export async function getStockMetadata(symbol) {
  try {
    const cleanSymbol = symbol.trim().toUpperCase();
    return await db.stockMeta.get(cleanSymbol);
  } catch (error) {
    console.error(`Error loading stock metadata for ${symbol}:`, error);
    return null;
  }
}

/**
 * Check if a stock's stored data in persistent DB is already up-to-date for today's market session
 */
export async function isStockUpToDate(symbol) {
  try {
    const cleanSymbol = symbol.trim().toUpperCase();
    const meta = await db.stockMeta.get(cleanSymbol);
    if (!meta || meta.candleCount < 100 || meta.isSimulated) {
      return false;
    }
    const latestMarketDate = getLatestMarketTradingDate();
    return meta.latestDate >= latestMarketDate;
  } catch {
    return false;
  }
}

/**
 * Append or upsert raw candles into IndexedDB (Non-destructive Append Mode)
 * Uses [symbol+date] compound primary key:
 * - Appends new daily dates
 * - Updates existing dates with fresh data
 * - Preserves historical candles up to ~2.2 years (~550 trading days)
 */
export async function appendCandles(symbol, candles) {
  if (!candles || candles.length === 0) return;
  const cleanSymbol = symbol.trim().toUpperCase();

  try {
    const records = candles.map(c => ({
      symbol: cleanSymbol,
      date: typeof c.time === 'string' ? c.time : new Date(c.time * 1000).toISOString().split('T')[0],
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume || 0),
    }));

    // Atomic bulkPut: updates matching dates, inserts new dates, keeps prior history
    await db.prices.bulkPut(records);

    // Retrieve all sorted candles
    const allCandles = await db.prices
      .where('symbol')
      .equals(cleanSymbol)
      .sortBy('date');

    if (allCandles.length > 0) {
      // Keep up to 2.2 years (~550 candles) to maintain clean 2-year horizon
      if (allCandles.length > 550) {
        const excessCount = allCandles.length - 510;
        const toRemove = allCandles.slice(0, excessCount);
        const keysToRemove = toRemove.map(c => [cleanSymbol, c.date]);
        await db.prices.bulkDelete(keysToRemove);
      }

      const updatedCandles = await db.prices
        .where('symbol')
        .equals(cleanSymbol)
        .sortBy('date');

      await db.stockMeta.put({
        symbol: cleanSymbol,
        latestDate: updatedCandles[updatedCandles.length - 1].date,
        firstDate: updatedCandles[0].date,
        candleCount: updatedCandles.length,
        lastScannedAt: new Date().toISOString(),
        isSimulated: false
      });
    }
  } catch (error) {
    console.error(`Error appending candles for ${cleanSymbol}:`, error);
  }
}

/**
 * Backward-compatible alias for appendCandles
 */
export async function saveCandles(symbol, candles) {
  return appendCandles(symbol, candles);
}

/**
 * Get all starred/favorite symbols
 */
export async function getFavorites() {
  try {
    const favs = await db.favorites.toArray();
    return favs.map(f => f.symbol);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return [];
  }
}

/**
 * Toggle favorite status for a symbol
 */
export async function toggleFavoriteInDB(symbol) {
  try {
    const cleanSymbol = symbol.trim().toUpperCase();
    const existing = await db.favorites.get(cleanSymbol);
    if (existing) {
      await db.favorites.delete(cleanSymbol);
      return false; // now not favorite
    } else {
      await db.favorites.put({
        symbol: cleanSymbol,
        addedAt: new Date().toISOString()
      });
      return true; // now favorite
    }
  } catch (error) {
    console.error(`Error toggling favorite for ${symbol}:`, error);
    return false;
  }
}

/**
 * Save computed universe metrics
 */
export async function saveUniverseCache(stocks) {
  try {
    await db.universe.bulkPut(stocks);
  } catch (error) {
    console.error('Error saving universe cache:', error);
  }
}

/**
 * Load saved universe metrics
 */
export async function getUniverseCache() {
  try {
    return await db.universe.toArray();
  } catch (error) {
    console.error('Error loading universe cache:', error);
    return [];
  }
}

/**
 * Get high-level database diagnostics/stats including 2-year coverage
 */
export async function getDatabaseStats() {
  try {
    const priceCount = await db.prices.count();
    const universeCount = await db.universe.count();
    const favCount = await db.favorites.count();
    const uniqueSymbols = await db.prices.orderBy('symbol').uniqueKeys();
    
    // Check 2-year coverage (stocks with >= 400 candles)
    const metas = await db.stockMeta.toArray();
    const twoYearCount = metas.filter(m => m.candleCount >= 400).length;

    let earliestDate = 'N/A';
    let latestDate = 'N/A';

    if (metas.length > 0) {
      const dates = metas.map(m => m.latestDate).filter(Boolean).sort();
      const firstDates = metas.map(m => m.firstDate).filter(Boolean).sort();
      if (firstDates.length > 0) earliestDate = firstDates[0];
      if (dates.length > 0) latestDate = dates[dates.length - 1];
    }

    return {
      priceCount,
      universeCount,
      favCount,
      cachedSymbolsCount: uniqueSymbols.length,
      twoYearSymbolsCount: twoYearCount,
      threeYearSymbolsCount: twoYearCount,
      earliestDate,
      latestDate,
      estimatedSizeMB: ((priceCount * 120) / (1024 * 1024)).toFixed(2)
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    return {
      priceCount: 0,
      universeCount: 0,
      favCount: 0,
      cachedSymbolsCount: 0,
      twoYearSymbolsCount: 0,
      threeYearSymbolsCount: 0,
      earliestDate: 'N/A',
      latestDate: 'N/A',
      estimatedSizeMB: '0.00'
    };
  }
}

/**
 * Clear cached prices, universe, and metadata while optionally keeping favorites
 */
export async function clearCache(keepFavorites = true) {
  try {
    await db.prices.clear();
    await db.universe.clear();
    await db.stockMeta.clear();
    await db.scanLog.clear();
    if (!keepFavorites) {
      await db.favorites.clear();
    }
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
}
