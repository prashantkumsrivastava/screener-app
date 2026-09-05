/**
 * High-performance technical indicator calculations in pure JavaScript
 */

/**
 * Calculate Exponential Moving Average (EMA)
 * Matches standard TradingView / pandas ewm(span=period, adjust=False)
 * Returns array of { time, value } objects for lightweight-charts
 */
export function calculateEMA(candles, period) {
  if (!candles || candles.length < period) return [];

  const k = 2 / (period + 1);
  const result = [];

  // Seed with simple moving average of first `period` bars
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += Number(candles[i].close);
  }
  let prevEMA = sum / period;

  result.push({
    time: candles[period - 1].time,
    value: Number(prevEMA.toFixed(2))
  });

  // Calculate EMA for remaining candles
  for (let i = period; i < candles.length; i++) {
    const close = Number(candles[i].close);
    const currentEMA = (close * k) + (prevEMA * (1 - k));
    result.push({
      time: candles[i].time,
      value: Number(currentEMA.toFixed(2))
    });
    prevEMA = currentEMA;
  }

  return result;
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(candles, period) {
  if (!candles || candles.length < period) return [];

  const result = [];
  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += Number(candles[i].close);
  }

  result.push({
    time: candles[period - 1].time,
    value: Number((sum / period).toFixed(2))
  });

  for (let i = period; i < candles.length; i++) {
    sum += Number(candles[i].close) - Number(candles[i - period].close);
    result.push({
      time: candles[i].time,
      value: Number((sum / period).toFixed(2))
    });
  }

  return result;
}

/**
 * Calculate 20-day Volume SMA and current Volume Surge ratio
 */
export function calculateVolumeMetrics(candles, period = 20) {
  if (!candles || candles.length === 0) {
    return { volumeSMA: 0, currentVolume: 0, volumeSurge: 1.0 };
  }

  const n = candles.length;
  const currentVolume = Number(candles[n - 1].volume || 0);

  if (n < period) {
    return { volumeSMA: currentVolume, currentVolume, volumeSurge: 1.0 };
  }

  let sum = 0;
  for (let i = n - period; i < n; i++) {
    sum += Number(candles[i].volume || 0);
  }
  const volumeSMA = sum / period;
  const volumeSurge = volumeSMA > 0 ? Number((currentVolume / volumeSMA).toFixed(2)) : 1.0;

  return {
    volumeSMA: Math.round(volumeSMA),
    currentVolume,
    volumeSurge
  };
}

/**
 * Calculate Wilder's Relative Strength Index (RSI 14)
 */
export function calculateRSI(candles, period = 14) {
  if (!candles || candles.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = Number(candles[i].close) - Number(candles[i - 1].close);
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < candles.length; i++) {
    const diff = Number(candles[i].close) - Number(candles[i - 1].close);
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return Number(rsi.toFixed(1));
}

/**
 * Calculate Moving Average Convergence Divergence (MACD)
 */
export function calculateMACD(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!candles || candles.length < slowPeriod + signalPeriod) {
    return { macd: 0, signal: 0, histogram: 0 };
  }

  const emaFast = calculateEMA(candles, fastPeriod);
  const emaSlow = calculateEMA(candles, slowPeriod);

  // Align Fast and Slow
  const offset = slowPeriod - fastPeriod;
  const macdLine = [];

  for (let i = 0; i < emaSlow.length; i++) {
    const fastVal = emaFast[i + offset].value;
    const slowVal = emaSlow[i].value;
    macdLine.push({
      time: emaSlow[i].time,
      close: fastVal - slowVal // use 'close' so calculateEMA can consume it
    });
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);
  if (signalLine.length === 0) return { macd: 0, signal: 0, histogram: 0 };

  const lastMacd = macdLine[macdLine.length - 1].close;
  const lastSignal = signalLine[signalLine.length - 1].value;
  const histogram = lastMacd - lastSignal;

  return {
    macd: Number(lastMacd.toFixed(2)),
    signal: Number(lastSignal.toFixed(2)),
    histogram: Number(histogram.toFixed(2))
  };
}
