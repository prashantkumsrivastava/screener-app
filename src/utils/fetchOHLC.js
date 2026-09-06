import { getCachedCandles, appendCandles, getStockMetadata, getLatestMarketTradingDate } from '../db/jsonDbClient';

/**
 * Parses raw Yahoo Finance chart API response into clean, sorted candle objects.
 * Extracts pure, raw unadulterated OHLCV data as reported directly by the API.
 */
function parseYahooResponse(data) {
  try {
    const result = data?.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      return null;
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const opens = quotes.open;
    const highs = quotes.high;
    const lows = quotes.low;
    const closes = quotes.close;
    const volumes = quotes.volume;

    const candles = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i];
      const h = highs[i];
      const l = lows[i];
      const c = closes[i];
      const v = volumes[i];

      // Exclude null or invalid ticks
      if (c === null || c === undefined || o === null || h === null || l === null) {
        continue;
      }

      // Convert timestamp to YYYY-MM-DD
      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];

      candles.push({
        time: date,
        open: Number(o.toFixed(2)),
        high: Number(h.toFixed(2)),
        low: Number(l.toFixed(2)),
        close: Number(c.toFixed(2)),
        volume: Number(v || 0)
      });
    }

    // Sort ascending by date and deduplicate
    candles.sort((a, b) => a.time.localeCompare(b.time));
    const uniqueCandles = [];
    const seenDates = new Set();
    for (const candle of candles) {
      if (!seenDates.has(candle.time)) {
        seenDates.add(candle.time);
        uniqueCandles.push(candle);
      }
    }

    return uniqueCandles.length > 0 ? uniqueCandles : null;
  } catch (err) {
    console.warn('Failed to parse Yahoo response:', err);
    return null;
  }
}

/**
 * Resilient multi-tier OHLC fetcher using 100% RAW market data:
 * 
 * 1. Check local persistent DB metadata.
 * 2. If already up-to-date for today: load instantly from local DB (0 API calls).
 * 3. If stock has history in DB but is missing days:
 *    calculate missing days (today - lastDate) and download ONLY the missing delta (5d, 1mo, 3mo, etc.)
 *    and append into persistent DB.
 * 4. If stock has no data: fetch full 2-year history (range=2y).
 * 5. Uses multi-gateway failover (/api/yahoo, /api/yahoo2, public CORS proxies).
 * 6. NO fake/simulated data generation. If data is unavailable, reports explicit unavailable state.
 */
export async function fetchStockOHLC(symbol, forceRefresh = false) {
  const cleanSymbol = symbol.trim().toUpperCase();
  const todayMarketDate = getLatestMarketTradingDate();

  // 1. Check local persistent DB metadata
  const meta = await getStockMetadata(cleanSymbol);
  const cached = await getCachedCandles(cleanSymbol);

  const hasHistory = meta && meta.candleCount >= 100 && cached && cached.length >= 100;
  const isUpToDate = hasHistory && meta.latestDate >= todayMarketDate;

  // Case A: Already up-to-date in persistent DB for today's market session
  if (!forceRefresh && isUpToDate) {
    return { data: cached, source: 'db-daily' };
  }

  // Case B: Determine delta range needed
  let requestRange = '2y';
  if (hasHistory && meta.latestDate) {
    const lastDateMs = new Date(meta.latestDate).getTime();
    const todayMs = new Date(todayMarketDate).getTime();
    const diffDays = Math.ceil((todayMs - lastDateMs) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0 && !forceRefresh) {
      return { data: cached, source: 'db-daily' };
    } else if (diffDays <= 7) {
      requestRange = '5d'; // only download last 5 days
    } else if (diffDays <= 35) {
      requestRange = '1mo'; // only download 1 month
    } else if (diffDays <= 95) {
      requestRange = '3mo'; // only download 3 months
    } else if (diffDays <= 190) {
      requestRange = '6mo';
    } else if (diffDays <= 370) {
      requestRange = '1y';
    }
  }

  const yahooTicker = cleanSymbol.endsWith('.NS') ? cleanSymbol : `${cleanSymbol}.NS`;
  const encodedTicker = encodeURIComponent(yahooTicker);

  // Multi-gateway endpoints: Vite Proxy 1 (query1), Vite Proxy 2 (query2), and CORS fallbacks
  const endpoints = [
    `/api/yahoo/v8/finance/chart/${encodedTicker}?range=${requestRange}&interval=1d`,
    `/api/yahoo2/v8/finance/chart/${encodedTicker}?range=${requestRange}&interval=1d`,
    `https://corsproxy.io/?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${encodedTicker}?range=${requestRange}&interval=1d`)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${encodedTicker}?range=${requestRange}&interval=1d`)}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4500)
      });
      if (res.ok) {
        const json = await res.json();
        const liveCandles = parseYahooResponse(json);
        if (liveCandles && liveCandles.length > 0) {
          // Append raw delta candles to persistent DB
          await appendCandles(cleanSymbol, liveCandles);

          const combined = await getCachedCandles(cleanSymbol);
          return {
            data: combined.length > 0 ? combined : liveCandles,
            source: requestRange === '2y' ? 'live' : 'live-delta'
          };
        }
      }
    } catch {
      // Try next gateway
    }
  }

  // 4. If all network gateways failed, return existing cached raw candles from DB if present
  if (cached && cached.length > 0) {
    return { data: cached, source: 'cache-offline' };
  }

  // 5. If no data exists and network is unreachable, return empty array without synthesizing fake data
  return { data: [], source: 'unavailable', error: 'Market data currently unreachable' };
}
