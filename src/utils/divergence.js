import { calculateEMA, calculateRSI, calculateVolumeMetrics, calculateMACD } from './ema';

/**
 * Computes all technical divergence indicators, spreads, slopes, and composite score
 * from an array of OHLCV daily candles.
 */
export function computeIndicators(candles) {
  if (!candles || candles.length < 20) {
    return null;
  }

  const n = candles.length;
  const currentCandle = candles[n - 1];
  const prevCandle = candles[n - 2];

  const close = Number(currentCandle.close);
  const open = Number(currentCandle.open);
  const high = Number(currentCandle.high);
  const low = Number(currentCandle.low);
  const volume = Number(currentCandle.volume || 0);

  const prevClose = Number(prevCandle.close);
  const change1D = Number((close - prevClose).toFixed(2));
  const changePercent1D = Number(((change1D / prevClose) * 100).toFixed(2));

  // 1. Calculate EMAs: 20, 50, 100, 200
  const ema20Series = calculateEMA(candles, 20);
  const ema50Series = calculateEMA(candles, 50);
  const ema100Series = calculateEMA(candles, 100);
  const ema200Series = calculateEMA(candles, 200);

  const ema20 = ema20Series.length ? ema20Series[ema20Series.length - 1].value : null;
  const ema50 = ema50Series.length ? ema50Series[ema50Series.length - 1].value : null;
  const ema100 = ema100Series.length ? ema100Series[ema100Series.length - 1].value : null;
  const ema200 = ema200Series.length ? ema200Series[ema200Series.length - 1].value : null;

  // 2. Divergence Spreads (%)
  const priceVsEma20 = ema20 ? Number((((close - ema20) / ema20) * 100).toFixed(2)) : 0;
  const ema20VsEma50 = (ema20 && ema50) ? Number((((ema20 - ema50) / ema50) * 100).toFixed(2)) : 0;
  const ema50VsEma200 = (ema50 && ema200) ? Number((((ema50 - ema200) / ema200) * 100).toFixed(2)) : 0;
  const priceVsEma200 = ema200 ? Number((((close - ema200) / ema200) * 100).toFixed(2)) : 0;

  // 3. EMA Slopes (Momentum trend)
  // 5-day slope for EMA20
  let slopeEma20 = 0;
  if (ema20Series.length >= 6) {
    const pastEma20 = ema20Series[ema20Series.length - 6].value;
    slopeEma20 = Number((((ema20 - pastEma20) / pastEma20) * 100).toFixed(2));
  }

  // 10-day slope for EMA50
  let slopeEma50 = 0;
  if (ema50Series.length >= 11) {
    const pastEma50 = ema50Series[ema50Series.length - 11].value;
    slopeEma50 = Number((((ema50 - pastEma50) / pastEma50) * 100).toFixed(2));
  }

  // Normalized EMA Slope Indicator (-100 to +100) & Angle (-90° to +90°)
  const rawCombinedSlope = (slopeEma20 * 0.6) + (slopeEma50 * 0.4);
  const slopeScore = Math.round(Math.max(-100, Math.min(100, (Math.atan(rawCombinedSlope * 0.75) / (Math.PI / 2)) * 100)));
  const slopeAngle = Math.round((Math.atan(rawCombinedSlope * 0.75) * 180) / Math.PI);

  // 4. Alignment checks
  const isGoldenStack = Boolean(
    ema20 && ema50 && ema100 && ema200 &&
    close > ema20 && ema20 > ema50 && ema50 > ema100 && ema100 > ema200
  );

  const isDeathStack = Boolean(
    ema20 && ema50 && ema100 && ema200 &&
    close < ema20 && ema20 < ema50 && ema50 < ema100 && ema100 < ema200
  );

  // Golden cross (EMA50 crossed above EMA200 recently within last 10 trading bars)
  let isGoldenCross = false;
  if (ema50Series.length >= 10 && ema200Series.length >= 10) {
    const currentDiff = ema50 - ema200;
    const len50 = ema50Series.length;
    const len200 = ema200Series.length;
    const pastDiff = ema50Series[len50 - 10].value - ema200Series[len200 - 10].value;
    if (currentDiff > 0 && pastDiff <= 0) {
      isGoldenCross = true;
    }
  }

  // Pullback detection: Uptrend active (EMA20 > EMA50 > EMA200) and price is within 1% of EMA20
  const isUptrend = Boolean(ema20 && ema50 && (!ema200 || ema50 > ema200) && ema20 > ema50);
  const isPullbackEMA20 = isUptrend && Boolean(ema20 && Math.abs((close - ema20) / ema20) <= 0.012);
  const isPullbackEMA50 = isUptrend && Boolean(ema50 && Math.abs((close - ema50) / ema50) <= 0.015);

  // 5. RSI(14)
  const rsi = calculateRSI(candles, 14);

  // 6. Volume & Surge
  const { volumeSMA, volumeSurge } = calculateVolumeMetrics(candles, 20);

  // 7. MACD
  const macd = calculateMACD(candles);

  // 8. 52-week High/Low (from up to last 252 candles)
  const lookback52W = candles.slice(-252);
  let high52W = -Infinity;
  let low52W = Infinity;
  for (const c of lookback52W) {
    if (c.high > high52W) high52W = c.high;
    if (c.low < low52W) low52W = c.low;
  }
  const distFrom52WHigh = high52W > 0 ? Number((((close - high52W) / high52W) * 100).toFixed(2)) : 0;

  // 9. Composite Divergence Score (-100 to +100)
  // Combines:
  // - Alignment: +30 (Golden Stack) or -30 (Death Stack) or +15 / -15
  // - EMA Spreads: +25 to -25
  // - Slopes: +25 to -25
  // - RSI & Volume: +20 to -20
  let score = 0;

  if (isGoldenStack) score += 30;
  else if (isDeathStack) score -= 30;
  else {
    if (ema20 && close > ema20) score += 8; else score -= 8;
    if (ema20 && ema50 && ema20 > ema50) score += 7; else score -= 7;
    if (ema50 && ema200 && ema50 > ema200) score += 8; else score -= 8;
  }

  // Divergence Spreads contribution (+/- 25)
  // Ideal healthy spread: price is 1% to 6% above EMA20, EMA20 is 2% to 10% above EMA50
  if (priceVsEma20 > 0) {
    if (priceVsEma20 <= 7) score += 12; // healthy bullish expansion
    else score += 6; // overextended bullish
  } else {
    if (priceVsEma20 >= -5) score -= 8;
    else score -= 14; // heavy breakdown
  }

  if (ema20VsEma50 > 0) {
    score += Math.min(13, ema20VsEma50 * 2.5);
  } else {
    score += Math.max(-13, ema20VsEma50 * 2.5);
  }

  // Slope contribution (+/- 25)
  const totalSlope = (slopeEma20 * 1.5) + (slopeEma50 * 2.0);
  const clampedSlopeBonus = Math.max(-25, Math.min(25, totalSlope * 3.5));
  score += clampedSlopeBonus;

  // RSI & Volume contribution (+/- 20)
  // Bullish sweet spot: RSI 55-72
  if (rsi >= 55 && rsi <= 72) {
    score += 12;
  } else if (rsi > 72) {
    score += 4; // Overbought but high momentum
  } else if (rsi >= 40 && rsi < 55) {
    score += 0;
  } else if (rsi < 40) {
    score -= 12;
  }

  if (volumeSurge >= 1.4) {
    // If volume surge is accompanied by positive day, boost score
    if (changePercent1D > 0) score += 8;
    else score -= 8;
  }

  const compositeScore = Math.round(Math.max(-100, Math.min(100, score)));

  return {
    price: close,
    open,
    high,
    low,
    volume,
    change1D,
    changePercent1D,
    ema20,
    ema50,
    ema100,
    ema200,
    priceVsEma20,
    ema20VsEma50,
    ema50VsEma200,
    priceVsEma200,
    slopeEma20,
    slopeEma50,
    slopeScore,
    slopeAngle,
    isGoldenStack,
    isDeathStack,
    isGoldenCross,
    isPullbackEMA20,
    isPullbackEMA50,
    isUptrend,
    rsi,
    volumeSMA,
    volumeSurge,
    macd,
    high52W: high52W > 0 ? Number(high52W.toFixed(2)) : close,
    low52W: low52W < Infinity ? Number(low52W.toFixed(2)) : close,
    distFrom52WHigh,
    compositeScore,
    // Series for charts
    ema20Series,
    ema50Series,
    ema100Series,
    ema200Series,
    divergenceSeries: computeDivergenceSeries(candles),
  };
}

/**
 * Extract or compute daily continuous divergence series for charts
 * Returns array of { time, value } points where value is compositeScore (-100 to +100)
 */
export function computeDivergenceSeries(candles) {
  if (!candles || candles.length === 0) return [];

  const hasPrecomputed = candles.some(c => c && typeof c.compositeScore === 'number' && c.compositeScore !== 0);
  if (hasPrecomputed) {
    return candles.map(c => ({
      time: c.time,
      value: typeof c.compositeScore === 'number' ? c.compositeScore : 0
    }));
  }

  const enriched = computeTimelineIndicators(candles);
  return enriched.map(c => ({
    time: c.time,
    value: typeof c.compositeScore === 'number' ? c.compositeScore : 0
  }));
}

/**
 * Computes timeline indicators for every daily candle in historical series
 * Returns enriched array of daily candle objects with all indicator properties
 */
export function computeTimelineIndicators(candles) {
  if (!candles || candles.length === 0) return [];

  return candles.map((c, i) => {
    if (i < 19) {
      return {
        time: c.time,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume || 0),
        ema20: null,
        ema50: null,
        ema100: null,
        ema200: null,
        rsi: null,
        macd: null,
        slopeEma20: 0,
        slopeEma50: 0,
        slopeScore: 0,
        slopeAngle: 0,
        priceVsEma20: 0,
        ema20VsEma50: 0,
        ema50VsEma200: 0,
        priceVsEma200: 0,
        volumeSMA: 0,
        volumeSurge: 1.0,
        isGoldenStack: false,
        isDeathStack: false,
        isGoldenCross: false,
        isPullbackEMA20: false,
        isPullbackEMA50: false,
        distFrom52WHigh: 0,
        compositeScore: 0
      };
    }

    const slice = candles.slice(0, i + 1);
    const ind = computeIndicators(slice);
    if (!ind) {
      return {
        time: c.time,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume || 0),
      };
    }

    return {
      time: c.time,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume || 0),
      ema20: ind.ema20,
      ema50: ind.ema50,
      ema100: ind.ema100,
      ema200: ind.ema200,
      rsi: ind.rsi,
      macd: ind.macd,
      slopeEma20: ind.slopeEma20,
      slopeEma50: ind.slopeEma50,
      slopeScore: ind.slopeScore,
      slopeAngle: ind.slopeAngle,
      priceVsEma20: ind.priceVsEma20,
      ema20VsEma50: ind.ema20VsEma50,
      ema50VsEma200: ind.ema50VsEma200,
      priceVsEma200: ind.priceVsEma200,
      volumeSMA: ind.volumeSMA,
      volumeSurge: ind.volumeSurge,
      isGoldenStack: ind.isGoldenStack,
      isDeathStack: ind.isDeathStack,
      isGoldenCross: ind.isGoldenCross,
      isPullbackEMA20: ind.isPullbackEMA20,
      isPullbackEMA50: ind.isPullbackEMA50,
      distFrom52WHigh: ind.distFrom52WHigh,
      compositeScore: ind.compositeScore
    };
  });
}

