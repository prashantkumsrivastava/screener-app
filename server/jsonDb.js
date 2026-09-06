/* global process */
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db.json');
const TMP_PATH = path.join(process.cwd(), 'db.json.tmp');

const defaultStructure = {
  prices: {},    // Key: "YYYY-MM-DD:SYMBOL" -> candle record
  universe: {},  // Key: "SYMBOL" -> stock summary object
  favorites: [], // Array of favorite symbol strings
  stockMeta: {}, // Key: "SYMBOL" -> metadata object
  scanLog: []
};

let memoryDb = null;

function cleanPrices(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(raw)) {
      const item = raw[key];
      if (item && typeof item === 'object' && item.symbol && (item.date || item.time)) {
        out[key] = item;
      }
    }
  }
  return out;
}

function loadDb() {
  if (memoryDb) return memoryDb;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      memoryDb = {
        prices: cleanPrices(parsed.prices),
        universe: parsed.universe && typeof parsed.universe === 'object' ? parsed.universe : {},
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter(Boolean) : [],
        stockMeta: parsed.stockMeta && typeof parsed.stockMeta === 'object' ? parsed.stockMeta : {},
        scanLog: Array.isArray(parsed.scanLog) ? parsed.scanLog : []
      };
    } else {
      memoryDb = JSON.parse(JSON.stringify(defaultStructure));
      saveDb();
    }
  } catch (error) {
    console.warn('[jsonDb] Initial load warning, using fresh memory structure:', error.message);
    memoryDb = JSON.parse(JSON.stringify(defaultStructure));
  }
  return memoryDb;
}

function saveDb() {
  if (!memoryDb) return;
  try {
    const data = JSON.stringify(memoryDb, null, 2);
    fs.writeFileSync(TMP_PATH, data, 'utf-8');
    fs.renameSync(TMP_PATH, DB_PATH);
  } catch (error) {
    console.error('[jsonDb] Error saving db.json:', error);
  }
}

/**
 * Custom Native Node FS JSON File Database API Handler
 */
export async function handleJsonDbApi(req, res) {
  try {
    const db = loadDb();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    
    let pathname = url.pathname;
    if (pathname.startsWith('/screener-app')) {
      pathname = pathname.replace(/^\/screener-app/, '');
    }
    const method = req.method.toUpperCase();

    const sendJson = (data, statusCode = 200) => {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };

    const parseBody = async () => {
      return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch {
            resolve({});
          }
        });
      });
    };

    function normalizeDate(t) {
      if (!t) return new Date().toISOString().split('T')[0];
      if (typeof t === 'string') {
        return t.includes('T') ? t.split('T')[0] : t.trim();
      }
      if (typeof t === 'number') {
        return new Date(t * 1000).toISOString().split('T')[0];
      }
      return new Date().toISOString().split('T')[0];
    }

    // GET /api/db/candles?symbol=XYZ
    if (pathname === '/api/db/candles' && method === 'GET') {
      const symbol = url.searchParams.get('symbol');
      if (!symbol) return sendJson({ candles: [] });
      const cleanSymbol = symbol.trim().toUpperCase();

      const candleMap = new Map();
      const keys = Object.keys(db.prices);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const record = db.prices[key];
        if (record && record.symbol === cleanSymbol) {
          const normDate = normalizeDate(record.date || record.time);
          candleMap.set(normDate, { ...record, date: normDate, time: normDate });
        }
      }

      const candles = Array.from(candleMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      return sendJson({ candles });
    }

    // POST /api/db/candles - Upsert candles with "date:symbol" keys
    if (pathname === '/api/db/candles' && method === 'POST') {
      const body = await parseBody();
      const { symbol, candles } = body;
      if (!symbol || !Array.isArray(candles) || candles.length === 0) {
        return sendJson({ success: false, message: 'Invalid payload' }, 400);
      }
      const cleanSymbol = symbol.trim().toUpperCase();

      const validCandles = candles.filter(c => c && c.time && typeof c.close === 'number' && !isNaN(c.close));
      if (validCandles.length === 0) {
        return sendJson({ success: false, message: 'No valid candles' }, 400);
      }

      // Upsert using normalized "date:symbol" keys
      for (const c of validCandles) {
        const dateStr = normalizeDate(c.time || c.date);
        const key = `${dateStr}:${cleanSymbol}`;
        
        db.prices[key] = {
          date: dateStr,
          time: dateStr,
          symbol: cleanSymbol,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 0),
          // Timeline indicators
          ema20: c.ema20 ?? null,
          ema50: c.ema50 ?? null,
          ema100: c.ema100 ?? null,
          ema200: c.ema200 ?? null,
          rsi: c.rsi ?? null,
          macd: c.macd ?? null,
          slopeEma20: c.slopeEma20 ?? 0,
          slopeEma50: c.slopeEma50 ?? 0,
          slopeScore: c.slopeScore ?? 0,
          slopeAngle: c.slopeAngle ?? 0,
          priceVsEma20: c.priceVsEma20 ?? 0,
          ema20VsEma50: c.ema20VsEma50 ?? 0,
          ema50VsEma200: c.ema50VsEma200 ?? 0,
          priceVsEma200: c.priceVsEma200 ?? 0,
          volumeSMA: c.volumeSMA ?? 0,
          volumeSurge: c.volumeSurge ?? 1.0,
          isGoldenStack: Boolean(c.isGoldenStack),
          isDeathStack: Boolean(c.isDeathStack),
          isGoldenCross: Boolean(c.isGoldenCross),
          isPullbackEMA20: Boolean(c.isPullbackEMA20),
          isPullbackEMA50: Boolean(c.isPullbackEMA50),
          distFrom52WHigh: c.distFrom52WHigh ?? 0,
          compositeScore: c.compositeScore ?? 0
        };
      }

      // Trim excess candles (> 550) for this symbol to maintain clean 2.2 year horizon
      const symbolKeys = Object.keys(db.prices).filter(k => db.prices[k] && db.prices[k].symbol === cleanSymbol);
      symbolKeys.sort((a, b) => (db.prices[a]?.date || '').localeCompare(db.prices[b]?.date || ''));

      if (symbolKeys.length > 550) {
        const excess = symbolKeys.slice(0, symbolKeys.length - 550);
        excess.forEach(k => { delete db.prices[k]; });
      }

      const remainingSymbolKeys = symbolKeys.filter(k => db.prices[k]);
      if (remainingSymbolKeys.length > 0) {
        const firstKey = remainingSymbolKeys[0];
        const latestKey = remainingSymbolKeys[remainingSymbolKeys.length - 1];

        db.stockMeta[cleanSymbol] = {
          symbol: cleanSymbol,
          latestDate: db.prices[latestKey]?.date || new Date().toISOString().split('T')[0],
          firstDate: db.prices[firstKey]?.date || new Date().toISOString().split('T')[0],
          candleCount: remainingSymbolKeys.length,
          lastScannedAt: new Date().toISOString()
        };
      }

      saveDb();
      return sendJson({ success: true, count: remainingSymbolKeys.length });
    }

    // GET /api/db/universe
    if (pathname === '/api/db/universe' && method === 'GET') {
      const list = Object.values(db.universe || {});
      return sendJson({ stocks: list });
    }

    // POST /api/db/universe
    if (pathname === '/api/db/universe' && method === 'POST') {
      const body = await parseBody();
      const { stocks, stock } = body;

      if (Array.isArray(stocks)) {
        stocks.forEach(s => {
          if (s && s.symbol) db.universe[s.symbol] = s;
        });
      } else if (stock && stock.symbol) {
        db.universe[stock.symbol] = stock;
      }

      saveDb();
      return sendJson({ success: true, count: Object.keys(db.universe).length });
    }

    // GET /api/db/favorites
    if (pathname === '/api/db/favorites' && method === 'GET') {
      db.favorites = Array.from(new Set((db.favorites || []).filter(Boolean)));
      return sendJson({ favorites: db.favorites });
    }

    // POST /api/db/favorites/toggle
    if (pathname === '/api/db/favorites/toggle' && method === 'POST') {
      const body = await parseBody();
      const { symbol } = body;
      if (!symbol) return sendJson({ success: false, message: 'Symbol required' }, 400);

      const cleanSymbol = symbol.trim().toUpperCase();
      const currentSet = new Set((db.favorites || []).filter(Boolean));
      let isFavorite = false;

      if (currentSet.has(cleanSymbol)) {
        currentSet.delete(cleanSymbol);
        isFavorite = false;
      } else {
        currentSet.add(cleanSymbol);
        isFavorite = true;
      }

      db.favorites = Array.from(currentSet);
      saveDb();
      return sendJson({ isFavorite, favorites: db.favorites });
    }

    // GET /api/db/stockMeta?symbol=XYZ
    if (pathname === '/api/db/stockMeta' && method === 'GET') {
      const symbol = url.searchParams.get('symbol');
      if (!symbol) return sendJson({ meta: null });
      const cleanSymbol = symbol.trim().toUpperCase();

      const meta = db.stockMeta[cleanSymbol] || null;
      return sendJson({ meta });
    }

    // GET /api/db/stats
    if (pathname === '/api/db/stats' && method === 'GET') {
      const validPrices = Object.values(db.prices || {}).filter(p => p && p.symbol);
      const priceCount = validPrices.length;
      const universeCount = Object.keys(db.universe || {}).length;
      const favCount = (db.favorites || []).length;
      const metas = Object.values(db.stockMeta || {}).filter(m => m && typeof m === 'object');

      const cachedSymbolsSet = new Set(validPrices.map(p => p.symbol));
      const cachedSymbolsCount = cachedSymbolsSet.size;
      const twoYearCount = metas.filter(m => m && m.candleCount >= 400).length;

      let earliestDate = 'N/A';
      let latestDate = 'N/A';

      if (metas.length > 0) {
        const latestDates = metas.map(m => m.latestDate).filter(Boolean).sort();
        const firstDates = metas.map(m => m.firstDate).filter(Boolean).sort();
        if (firstDates.length > 0) earliestDate = firstDates[0];
        if (latestDates.length > 0) latestDate = latestDates[latestDates.length - 1];
      }

      const estimatedSizeBytes = JSON.stringify(db).length;
      const estimatedSizeMB = (estimatedSizeBytes / (1024 * 1024)).toFixed(2);

      return sendJson({
        stats: {
          priceCount,
          universeCount,
          favCount,
          cachedSymbolsCount,
          twoYearSymbolsCount: twoYearCount,
          threeYearSymbolsCount: twoYearCount,
          earliestDate,
          latestDate,
          estimatedSizeMB
        }
      });
    }

    // POST /api/db/clear
    if (pathname === '/api/db/clear' && method === 'POST') {
      const body = await parseBody();
      const { keepFavorites = true } = body;

      db.prices = {};
      db.universe = {};
      db.stockMeta = {};
      db.scanLog = [];
      if (!keepFavorites) {
        db.favorites = [];
      }

      saveDb();
      return sendJson({ success: true });
    }

    return false;
  } catch (error) {
    console.error('[jsonDb] API Handler Error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error.message }));
    return true;
  }
}
