import { calculateEMA } from './ema';

/**
 * Aggregates daily OHLCV candles into weekly candles on-the-fly.
 * Groups daily candles by week (Monday-Sunday).
 *
 * Candle mapping:
 * - time: date string of the LAST trading day of that week
 * - open: open price of the FIRST trading day of that week
 * - high: max high price of the week
 * - low: min low price of the week
 * - close: close price of the LAST trading day of that week
 * - volume: total sum of volume for the week
 */
export function aggregateToWeeklyCandles(dailyCandles) {
  if (!dailyCandles || dailyCandles.length === 0) return [];

  const weekMap = new Map();

  for (const candle of dailyCandles) {
    if (!candle || !candle.time) continue;

    const d = new Date(candle.time);
    if (isNaN(d.getTime())) continue;

    // Determine Monday date for calendar week (UTC based to avoid local offset shift)
    const day = d.getUTCDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
    const weekKey = monday.toISOString().split('T')[0];

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey).push(candle);
  }

  const weeklyCandles = [];

  for (const [, candlesInWeek] of weekMap.entries()) {
    if (candlesInWeek.length === 0) continue;

    candlesInWeek.sort((a, b) => new Date(a.time) - new Date(b.time));

    const firstDay = candlesInWeek[0];
    const lastDay = candlesInWeek[candlesInWeek.length - 1];

    let maxHigh = -Infinity;
    let minLow = Infinity;
    let totalVolume = 0;

    for (const c of candlesInWeek) {
      if (c.high > maxHigh) maxHigh = c.high;
      if (c.low < minLow) minLow = c.low;
      totalVolume += (Number(c.volume) || 0);
    }

    weeklyCandles.push({
      time: lastDay.time,
      open: Number(firstDay.open),
      high: Number(maxHigh),
      low: Number(minLow),
      close: Number(lastDay.close),
      volume: totalVolume
    });
  }

  weeklyCandles.sort((a, b) => new Date(a.time) - new Date(b.time));

  return weeklyCandles;
}

/**
 * Computes weekly indicators on the fly given daily candles.
 * Never persists weekly data to IndexedDB or store.
 */
export function computeWeeklyIndicators(dailyCandles) {
  const weeklyCandles = aggregateToWeeklyCandles(dailyCandles);
  const totalWeeks = weeklyCandles.length;

  const ema20Series = calculateEMA(weeklyCandles, 20);
  const ema50Series = calculateEMA(weeklyCandles, 50);
  const ema100Series = calculateEMA(weeklyCandles, 100);
  const ema200Series = calculateEMA(weeklyCandles, 200);

  const warnings = [];
  if (totalWeeks < 20) warnings.push('EMA 20 requires 20 weekly bars.');
  if (totalWeeks < 50) warnings.push('EMA 50 requires 50 weekly bars (~1Y data).');
  if (totalWeeks < 100) warnings.push('EMA 100 requires 100 weekly bars (~2Y data).');
  if (totalWeeks < 200) warnings.push('EMA 200 requires 200 weekly bars (~4Y data).');

  return {
    weeklyCandles,
    ema20Series,
    ema50Series,
    ema100Series,
    ema200Series,
    totalWeeks,
    warnings
  };
}
