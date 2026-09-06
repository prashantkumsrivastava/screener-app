import { computeTimelineIndicators } from '../utils/divergence';

/**
 * Construct API URL with BASE_URL support
 */
function getApiUrl(endpoint) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  if (cleanBase && cleanBase !== '/') {
    return `${cleanBase}${cleanEndpoint}`;
  }
  return cleanEndpoint;
}

/**
 * Helper for direct API JSON requests
 */
async function fetchJson(endpoint, options = {}) {
  const url = getApiUrl(endpoint);
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`API error ${res.status} for ${url}`);
  }
  return await res.json();
}

/**
 * Helper to get the most recent completed market trading date (YYYY-MM-DD)
 * for Indian markets (NSE/BSE).
 * If today is Saturday or Sunday, returns Friday's date.
 */
export function getLatestMarketTradingDate() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);

  const dayOfWeek = istDate.getUTCDay(); // 0: Sunday, 6: Saturday
  const d = new Date(istDate);

  if (dayOfWeek === 0) {
    d.setUTCDate(d.getUTCDate() - 2);
  } else if (dayOfWeek === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }

  return d.toISOString().split('T')[0];
}

/**
 * Get all cached historical OHLCV candles with timeline indicators for a symbol
 */
export async function getCachedCandles(symbol) {
  try {
    const cleanSymbol = symbol.trim().toUpperCase();
    const json = await fetchJson(`/api/db/candles?symbol=${encodeURIComponent(cleanSymbol)}`);
    const rawCandles = json.candles || [];

    return rawCandles.map(c => ({
      time: c.date || c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      // Stored timeline indicators
      ema20: c.ema20,
      ema50: c.ema50,
      ema100: c.ema100,
      ema200: c.ema200,
      rsi: c.rsi,
      macd: c.macd,
      slopeEma20: c.slopeEma20,
      slopeEma50: c.slopeEma50,
      slopeScore: c.slopeScore,
      slopeAngle: c.slopeAngle,
      priceVsEma20: c.priceVsEma20,
      ema20VsEma50: c.ema20VsEma50,
      ema50VsEma200: c.ema50VsEma200,
      priceVsEma200: c.priceVsEma200,
      volumeSMA: c.volumeSMA,
      volumeSurge: c.volumeSurge,
      isGoldenStack: c.isGoldenStack,
      isDeathStack: c.isDeathStack,
      isGoldenCross: c.isGoldenCross,
      isPullbackEMA20: c.isPullbackEMA20,
      isPullbackEMA50: c.isPullbackEMA50,
      distFrom52WHigh: c.distFrom52WHigh,
      compositeScore: c.compositeScore
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
    const json = await fetchJson(`/api/db/stockMeta?symbol=${encodeURIComponent(cleanSymbol)}`);
    return json.meta || null;
  } catch (error) {
    console.error(`Error loading stock metadata for ${symbol}:`, error);
    return null;
  }
}

/**
 * Check if a stock's stored data in server JSON DB is already up-to-date for today's market session
 */
export async function isStockUpToDate(symbol) {
  try {
    const cleanSymbol = symbol.trim().toUpperCase();
    const meta = await getStockMetadata(cleanSymbol);
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
 * Append or upsert candles into server JSON DB.
 * Merges existing + new candles, computes timeline indicators across full series,
 * and posts to server.
 */
export async function appendCandles(symbol, candles) {
  if (!candles || candles.length === 0) return;
  const cleanSymbol = symbol.trim().toUpperCase();

  try {
    const existing = await getCachedCandles(cleanSymbol);

    const mergedMap = new Map();
    existing.forEach(c => mergedMap.set(c.time, c));
    candles.forEach(c => {
      const dateStr = typeof c.time === 'string' ? c.time : new Date(c.time * 1000).toISOString().split('T')[0];
      mergedMap.set(dateStr, {
        time: dateStr,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume || 0)
      });
    });

    const fullChronologicalCandles = Array.from(mergedMap.values())
      .sort((a, b) => a.time.localeCompare(b.time));

    const enrichedCandles = computeTimelineIndicators(fullChronologicalCandles);

    await fetchJson('/api/db/candles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: cleanSymbol,
        candles: enrichedCandles
      })
    });
  } catch (error) {
    console.error(`Error appending candles for ${cleanSymbol}:`, error);
  }
}

/**
 * Alias for appendCandles
 */
export async function saveCandles(symbol, candles) {
  return appendCandles(symbol, candles);
}

/**
 * Get all starred/favorite symbols
 */
export async function getFavorites() {
  try {
    const json = await fetchJson('/api/db/favorites');
    return json.favorites || [];
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
    const json = await fetchJson('/api/db/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: cleanSymbol })
    });
    return json.isFavorite || false;
  } catch (error) {
    console.error(`Error toggling favorite for ${symbol}:`, error);
    return false;
  }
}

/**
 * Save computed universe metrics to server JSON DB
 */
export async function saveUniverseCache(stocks) {
  try {
    await fetchJson('/api/db/universe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stocks })
    });
  } catch (error) {
    console.error('Error saving universe cache:', error);
  }
}

/**
 * Load saved universe metrics from server JSON DB
 */
export async function getUniverseCache() {
  try {
    const json = await fetchJson('/api/db/universe');
    return json.stocks || [];
  } catch (error) {
    console.error('Error loading universe cache:', error);
    return [];
  }
}

/**
 * Get high-level database diagnostics/stats
 */
export async function getDatabaseStats() {
  try {
    const json = await fetchJson('/api/db/stats');
    return json.stats || {
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
 * Clear cached prices, universe, and metadata in server JSON DB
 */
export async function clearCache(keepFavorites = true) {
  try {
    const json = await fetchJson('/api/db/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepFavorites })
    });
    return json.success || false;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
}
