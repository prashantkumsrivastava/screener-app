import { useEffect, useRef, useState, useMemo } from 'react';
import { 
  createChart, 
  CandlestickSeries, 
  LineSeries, 
  HistogramSeries, 
  CrosshairMode,
  LineStyle 
} from 'lightweight-charts';
import { useAppStore } from '../store/useAppStore';
import { computeWeeklyIndicators } from '../utils/weeklyData';
import { 
  Star, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Sparkles,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';

function sanitizeSeriesData(data) {
  if (!Array.isArray(data) || data.length === 0) return [];
  const map = new Map();
  for (const item of data) {
    if (!item) continue;
    let timeStr;
    if (typeof item.time === 'string') {
      timeStr = item.time.includes('T') ? item.time.split('T')[0] : item.time.trim();
    } else if (typeof item.time === 'number') {
      timeStr = new Date(item.time * 1000).toISOString().split('T')[0];
    } else {
      continue;
    }
    map.set(timeStr, { ...item, time: timeStr });
  }
  return Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time));
}

export function ChartPanel() {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const seriesRefs = useRef({});

  const {
    selectedStock,
    selectedStockCandles,
    selectedStockIndicators,
    selectedStockSource,
    selectStock,
    favorites,
    toggleFavorite,
    chartToggles,
    setChartToggle,
    stocks,
    theme
  } = useAppStore();

  const [activeRange, setActiveRange] = useState('1Y');
  const [timeframe, setTimeframe] = useState('D'); // 'D' = Daily, 'W' = Weekly
  const [legendData, setLegendData] = useState(null);
  const prevStockRef = useRef(null);
  const prevTimeframeRef = useRef(null);

  const stockMeta = stocks.find(s => s.symbol === selectedStock) || {};
  const isFav = favorites.includes(selectedStock);

  // Compute dynamic weekly candles and weekly indicators on-the-fly (NEVER stored in DB or store)
  const weeklyData = useMemo(() => {
    if (timeframe === 'W' && selectedStockCandles && selectedStockCandles.length > 0) {
      return computeWeeklyIndicators(selectedStockCandles);
    }
    return null;
  }, [timeframe, selectedStockCandles]);

  // Determine active candles and indicator series based on selected timeframe ('D' vs 'W')
  const activeCandles = useMemo(() => {
    const raw = timeframe === 'W' ? (weeklyData?.weeklyCandles || []) : (selectedStockCandles || []);
    return sanitizeSeriesData(raw);
  }, [timeframe, weeklyData, selectedStockCandles]);

  const activeIndicators = useMemo(() => {
    if (timeframe === 'W') {
      return {
        ema20Series: sanitizeSeriesData(weeklyData?.ema20Series || []),
        ema50Series: sanitizeSeriesData(weeklyData?.ema50Series || []),
        ema100Series: sanitizeSeriesData(weeklyData?.ema100Series || []),
        ema200Series: sanitizeSeriesData(weeklyData?.ema200Series || []),
        divergenceSeries: sanitizeSeriesData(weeklyData?.divergenceSeries || []),
      };
    }
    return {
      ema20Series: sanitizeSeriesData(selectedStockIndicators?.ema20Series || []),
      ema50Series: sanitizeSeriesData(selectedStockIndicators?.ema50Series || []),
      ema100Series: sanitizeSeriesData(selectedStockIndicators?.ema100Series || []),
      ema200Series: sanitizeSeriesData(selectedStockIndicators?.ema200Series || []),
      divergenceSeries: sanitizeSeriesData(selectedStockIndicators?.divergenceSeries || []),
    };
  }, [timeframe, weeklyData, selectedStockIndicators]);

  // Compute metrics for header and overlays based on active timeframe
  const ind = useMemo(() => {
    if (timeframe === 'D') return selectedStockIndicators || {};

    const wCandles = weeklyData?.weeklyCandles || [];
    if (wCandles.length === 0) return {};

    const last = wCandles[wCandles.length - 1];
    const prev = wCandles[wCandles.length - 2];
    const price = last ? last.close : 0;
    const change1W = prev ? Number((price - prev.close).toFixed(2)) : 0;
    const changePercent1W = prev && prev.close ? Number(((change1W / prev.close) * 100).toFixed(2)) : 0;

    const ema20Val = weeklyData?.ema20Series[weeklyData.ema20Series.length - 1]?.value;
    const ema50Val = weeklyData?.ema50Series[weeklyData.ema50Series.length - 1]?.value;
    const ema100Val = weeklyData?.ema100Series[weeklyData.ema100Series.length - 1]?.value;
    const ema200Val = weeklyData?.ema200Series[weeklyData.ema200Series.length - 1]?.value;

    const isGoldenStack = Boolean(ema20Val && ema50Val && ema100Val && ema200Val && ema20Val > ema50Val && ema50Val > ema100Val && ema100Val > ema200Val);
    const isDeathStack = Boolean(ema20Val && ema50Val && ema100Val && ema200Val && ema20Val < ema50Val && ema50Val < ema100Val && ema100Val < ema200Val);

    return {
      price,
      change1D: change1W,
      changePercent1D: changePercent1W,
      ema20: ema20Val,
      ema50: ema50Val,
      ema100: ema100Val,
      ema200: ema200Val,
      isGoldenStack,
      isDeathStack,
      compositeScore: (selectedStockIndicators?.compositeScore) || 0,
      high52W: selectedStockIndicators?.high52W,
      low52W: selectedStockIndicators?.low52W,
      distFrom52WHigh: selectedStockIndicators?.distFrom52WHigh,
      priceVsEma20: ema20Val ? Number((((price - ema20Val) / ema20Val) * 100).toFixed(2)) : 0,
      ema20VsEma50: (ema20Val && ema50Val) ? Number((((ema20Val - ema50Val) / ema50Val) * 100).toFixed(2)) : 0,
      rsi: selectedStockIndicators?.rsi,
      volumeSurge: selectedStockIndicators?.volumeSurge
    };
  }, [timeframe, selectedStockIndicators, weeklyData]);

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 680;

    const isDark = theme === 'dark';
    const chartBg = isDark ? '#0d131f' : '#ffffff';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)';
    const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { color: chartBg },
        textColor: textColor,
        fontSize: 12,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(0, 242, 254, 0.35)',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: 'rgba(0, 242, 254, 0.35)',
          width: 1,
          style: 3,
        },
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      timeScale: {
        borderColor: borderColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 9,
        minBarSpacing: 0.5,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
      },
      rightPriceScale: {
        borderColor: borderColor,
        autoScale: true,
        scaleMargins: {
          top: 0.06,
          bottom: 0.38,
        },
      },
    });

    chartInstanceRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00e676',
      downColor: '#ff3366',
      borderVisible: false,
      wickUpColor: '#00e676',
      wickDownColor: '#ff3366',
    });
    seriesRefs.current.candle = candleSeries;

    // Volume Series (Stacked in middle sub-pane)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.65,
        bottom: 0.20,
      },
    });
    seriesRefs.current.volume = volumeSeries;

    const ema20Series = chart.addSeries(LineSeries, {
      color: '#00f2fe',
      lineWidth: 2,
      title: 'EMA 20',
      priceLineVisible: false,
    });
    seriesRefs.current.ema20 = ema20Series;

    const ema50Series = chart.addSeries(LineSeries, {
      color: '#ffb300',
      lineWidth: 2,
      title: 'EMA 50',
      priceLineVisible: false,
    });
    seriesRefs.current.ema50 = ema50Series;

    const ema100Series = chart.addSeries(LineSeries, {
      color: '#ff7043',
      lineWidth: 2,
      title: 'EMA 100',
      priceLineVisible: false,
    });
    seriesRefs.current.ema100 = ema100Series;

    const ema200Series = chart.addSeries(LineSeries, {
      color: '#d500f9',
      lineWidth: 2,
      title: 'EMA 200',
      priceLineVisible: false,
    });
    seriesRefs.current.ema200 = ema200Series;

    // Divergence Series (Stacked below volume at bottom of chart)
    const divergenceSeries = chart.addSeries(LineSeries, {
      color: '#a855f7',
      lineWidth: 2,
      title: 'Divergence',
      priceScaleId: 'divergence',
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: {
        type: 'custom',
        formatter: (price) => `${price > 0 ? '+' : ''}${Math.round(price)}`,
      },
      autoscaleInfoProvider: () => ({
        priceRange: {
          minValue: -110,
          maxValue: 110,
        },
      }),
    });
    divergenceSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.83,
        bottom: 0.02,
      },
    });
    seriesRefs.current.divergence = divergenceSeries;

    // 3 Horizontal Reference Lines: +100 (Bullish), 0 (Neutral), -100 (Bearish)
    const line100 = divergenceSeries.createPriceLine({
      price: 100,
      color: '#10b981',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '+100 Bullish',
      axisLabelColor: '#10b981',
      axisLabelTextColor: '#ffffff',
    });

    const line0 = divergenceSeries.createPriceLine({
      price: 0,
      color: 'rgba(148, 163, 184, 0.55)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: '0 Neutral',
      axisLabelColor: '#64748b',
      axisLabelTextColor: '#ffffff',
    });

    const lineMinus100 = divergenceSeries.createPriceLine({
      price: -100,
      color: '#f43f5e',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '-100 Bearish',
      axisLabelColor: '#f43f5e',
      axisLabelTextColor: '#ffffff',
    });

    seriesRefs.current.divergenceLines = [line100, line0, lineMinus100];

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setLegendData(null);
        return;
      }

      const candleVal = param.seriesData.get(candleSeries);
      const volVal = param.seriesData.get(volumeSeries);
      const e20 = param.seriesData.get(ema20Series);
      const e50 = param.seriesData.get(ema50Series);
      const e100 = param.seriesData.get(ema100Series);
      const e200 = param.seriesData.get(ema200Series);
      const divVal = param.seriesData.get(divergenceSeries);

      if (candleVal) {
        setLegendData({
          time: param.time,
          open: candleVal.open,
          high: candleVal.high,
          low: candleVal.low,
          close: candleVal.close,
          volume: volVal ? volVal.value : null,
          ema20: e20 ? e20.value : null,
          ema50: e50 ? e50.value : null,
          ema100: e100 ? e100.value : null,
          ema200: e200 ? e200.value : null,
          divergence: divVal !== undefined && divVal !== null ? Math.round(divVal.value) : null,
        });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 680,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // Instant Chart Theme Switching (Dark / Light)
  useEffect(() => {
    if (!chartInstanceRef.current) return;
    const isDark = theme === 'dark';
    chartInstanceRef.current.applyOptions({
      layout: {
        background: { color: isDark ? '#0d131f' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)' },
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      },
    });
  }, [theme]);

  // Update Data and Series when stock, candles, timeframe, or indicators change
  useEffect(() => {
    if (!chartInstanceRef.current || !activeCandles || activeCandles.length === 0) {
      return;
    }

    const { candle, volume, ema20, ema50, ema100, ema200, divergence } = seriesRefs.current;

    // Set full historical candles so user can freely scroll left into the past and zoom in/out
    if (candle) {
      candle.setData(activeCandles);
    }

    if (volume) {
      if (chartToggles.volume) {
        const volData = activeCandles.map(c => ({
          time: c.time,
          value: c.volume || 0,
          color: c.close >= c.open ? 'rgba(0, 230, 118, 0.35)' : 'rgba(255, 51, 102, 0.35)',
        }));
        volume.setData(volData);
      } else {
        volume.setData([]);
      }
    }

    // Filter indicator series based on active candles
    const validDates = new Set(activeCandles.map(c => c.time));

    if (ema20 && activeIndicators?.ema20Series) {
      ema20.setData(chartToggles.ema20 
        ? activeIndicators.ema20Series.filter(d => validDates.has(d.time)) 
        : []
      );
    }

    if (ema50 && activeIndicators?.ema50Series) {
      ema50.setData(chartToggles.ema50 
        ? activeIndicators.ema50Series.filter(d => validDates.has(d.time)) 
        : []
      );
    }

    if (ema100 && activeIndicators?.ema100Series) {
      ema100.setData(chartToggles.ema100 
        ? activeIndicators.ema100Series.filter(d => validDates.has(d.time)) 
        : []
      );
    }

    if (ema200 && activeIndicators?.ema200Series) {
      ema200.setData(chartToggles.ema200 
        ? activeIndicators.ema200Series.filter(d => validDates.has(d.time)) 
        : []
      );
    }

    if (divergence && activeIndicators?.divergenceSeries) {
      divergence.setData(chartToggles.divergence 
        ? activeIndicators.divergenceSeries.filter(d => validDates.has(d.time)) 
        : []
      );
    }

    // Dynamic vertical stacking layout: Candlesticks (top), Volume (middle), Divergence (bottom)
    let candleBottom;
    let volTop;
    let volBottom;
    let divTop;
    let divBottom;

    if (chartToggles.volume && chartToggles.divergence) {
      candleBottom = 0.38;
      volTop = 0.65;
      volBottom = 0.20;
      divTop = 0.83;
      divBottom = 0.02;
    } else if (chartToggles.volume && !chartToggles.divergence) {
      candleBottom = 0.22;
      volTop = 0.78;
      volBottom = 0;
    } else if (!chartToggles.volume && chartToggles.divergence) {
      candleBottom = 0.22;
      divTop = 0.78;
      divBottom = 0.02;
    } else {
      candleBottom = 0.08;
    }

    chartInstanceRef.current.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.06,
        bottom: candleBottom,
      },
    });

    if (volume && chartToggles.volume) {
      volume.priceScale().applyOptions({
        scaleMargins: {
          top: volTop,
          bottom: volBottom,
        },
      });
    }

    if (divergence && chartToggles.divergence) {
      divergence.priceScale().applyOptions({
        scaleMargins: {
          top: divTop,
          bottom: divBottom,
        },
      });
    }

    // Toggle horizontal reference lines (+100, 0, -100) visibility
    if (seriesRefs.current.divergenceLines) {
      seriesRefs.current.divergenceLines.forEach(line => {
        line.applyOptions({
          lineVisible: !!chartToggles.divergence,
          axisLabelVisible: !!chartToggles.divergence,
        });
      });
    }

    // Only adjust visible range when opening a new stock or changing timeframe frequency
    const isNewStockOrTf = prevStockRef.current !== selectedStock || prevTimeframeRef.current !== timeframe;
    if (isNewStockOrTf) {
      prevStockRef.current = selectedStock;
      prevTimeframeRef.current = timeframe;
      const totalBars = activeCandles.length;
      let targetBars;
      if (timeframe === 'W') {
        if (activeRange === '1M') targetBars = 4;
        else if (activeRange === '3M') targetBars = 13;
        else if (activeRange === '6M') targetBars = 26;
        else if (activeRange === '1Y') targetBars = 52;
        else targetBars = totalBars;
      } else {
        if (activeRange === '1M') targetBars = 22;
        else if (activeRange === '3M') targetBars = 66;
        else if (activeRange === '6M') targetBars = 132;
        else if (activeRange === '1Y') targetBars = 252;
        else targetBars = totalBars;
      }

      if (activeRange === 'ALL') {
        chartInstanceRef.current.timeScale().fitContent();
      } else {
        chartInstanceRef.current.timeScale().setVisibleLogicalRange({
          from: Math.max(0, totalBars - targetBars),
          to: totalBars + 8,
        });
      }
    }
  }, [activeCandles, activeIndicators, chartToggles, activeRange, timeframe, selectedStock]);

  const handleRangeChange = (range) => {
    setActiveRange(range);
    if (!chartInstanceRef.current || !activeCandles || activeCandles.length === 0) return;
    const totalBars = activeCandles.length;
    let targetBars = totalBars;

    if (timeframe === 'W') {
      if (range === '1M') targetBars = 4;
      else if (range === '3M') targetBars = 13;
      else if (range === '6M') targetBars = 26;
      else if (range === '1Y') targetBars = 52;
    } else {
      if (range === '1M') targetBars = 22;
      else if (range === '3M') targetBars = 66;
      else if (range === '6M') targetBars = 132;
      else if (range === '1Y') targetBars = 252;
    }

    if (range === 'ALL') {
      chartInstanceRef.current.timeScale().fitContent();
    } else {
      chartInstanceRef.current.timeScale().setVisibleLogicalRange({
        from: Math.max(0, totalBars - targetBars),
        to: totalBars + 8,
      });
    }
  };

  const handleZoomIn = () => {
    if (!chartInstanceRef.current) return;
    const ts = chartInstanceRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const span = range.to - range.from;
    const delta = Math.max(2, Math.round(span * 0.15));
    ts.setVisibleLogicalRange({
      from: range.from + delta,
      to: range.to - delta,
    });
  };

  const handleZoomOut = () => {
    if (!chartInstanceRef.current) return;
    const ts = chartInstanceRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const span = range.to - range.from;
    const delta = Math.max(2, Math.round(span * 0.15));
    ts.setVisibleLogicalRange({
      from: range.from - delta,
      to: range.to + delta,
    });
  };

  const handleResetScale = () => {
    if (!chartInstanceRef.current) return;
    chartInstanceRef.current.timeScale().resetTimeScale();
    chartInstanceRef.current.priceScale('right').applyOptions({ autoScale: true });
    handleRangeChange(activeRange);
  };

  if (!selectedStock) {
    return (
      <div className="chart-empty-state">
        <Layers size={48} className="text-dim" />
        <h3>Select a stock to inspect EMA Divergence</h3>
        <p>Choose any stock from the table or search bar above.</p>
      </div>
    );
  }

  return (
    <div className="chart-panel-card">
      {/* Chart Top Header & Meta */}
      <div className="chart-header-row">
        <div className="chart-stock-identity">
          <button 
            className="btn-star-header"
            onClick={() => toggleFavorite(selectedStock)}
            title={isFav ? 'Remove from Watchlist' : 'Add to Watchlist'}
          >
            <Star 
              size={20} 
              className={isFav ? 'starred' : ''} 
              fill={isFav ? '#ffb300' : 'none'} 
            />
          </button>
          
          <div className="chart-title-block">
            <div className="chart-sym-row">
              <h2 className="chart-symbol-code">{selectedStock}</h2>
              <span className="chart-exchange-tag">NSE</span>
              <span className="chart-sector-tag">{stockMeta.industry || 'Nifty 500'}</span>
              <span className={`source-badge source-${timeframe === 'W' ? 'live' : selectedStockSource}`}>
                {timeframe === 'W' ? '● Weekly (On-the-Fly)' :
                 selectedStockSource === 'live' ? '● Live Market' : 
                 selectedStockSource === 'live-delta' ? '● Live Delta' :
                 selectedStockSource === 'live-proxy' ? '● Live CORS' : 
                 selectedStockSource === 'db-daily' ? '● DB Daily' :
                 selectedStockSource === 'cache' || selectedStockSource === 'cache-offline' ? '● Persistent DB' : '● Market Data'}
              </span>
              {activeCandles && activeCandles.length > 0 && (
                <span className="source-badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                  {activeCandles.length} {timeframe === 'W' ? 'weekly' : 'daily'} bars
                </span>
              )}
            </div>
            <span className="chart-company-full-name">{stockMeta.name || selectedStock}</span>
          </div>
        </div>

        {/* Current Price & Change */}
        <div className="chart-quote-block">
          <div className="quote-price-big">
            ₹{ind.price ? ind.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
          </div>
          <div className={`quote-change-badge ${ind.changePercent1D >= 0 ? 'positive' : 'negative'}`}>
            {ind.changePercent1D >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{ind.changePercent1D >= 0 ? '+' : ''}{ind.changePercent1D}%</span>
            <span>({ind.change1D >= 0 ? '+' : ''}{ind.change1D})</span>
          </div>
          {timeframe === 'D' && ind.slopeScore !== undefined && (
            <div 
              className={`quote-change-badge ${ind.slopeScore > 0 ? 'positive' : ind.slopeScore < 0 ? 'negative' : ''}`}
              title={`Trend Velocity: 20EMA 5D: ${ind.slopeEma20}% | 50EMA 10D: ${ind.slopeEma50}%`}
              style={{ background: 'rgba(255, 255, 255, 0.05)', marginLeft: '6px' }}
            >
              <span>Slope: {ind.slopeScore > 0 ? `+${ind.slopeScore}` : ind.slopeScore} ({ind.slopeAngle > 0 ? `+${ind.slopeAngle}` : ind.slopeAngle}°)</span>
            </div>
          )}
        </div>

        {/* Timeframe Range Buttons (1M, 3M, 6M, 1Y, ALL) + TradingView Zoom Controls */}
        <div className="chart-timeframe-selector">
          {['1M', '3M', '6M', '1Y', 'ALL'].map((tf) => (
            <button
              key={tf}
              className={`btn-timeframe ${activeRange === tf ? 'active' : ''}`}
              onClick={() => handleRangeChange(tf)}
            >
              {tf}
            </button>
          ))}

          <div className="chart-zoom-controls">
            <button 
              className="btn-zoom-action" 
              onClick={handleZoomIn} 
              title="Zoom In Horizontally (or mouse wheel)"
            >
              <ZoomIn size={14} />
            </button>
            <button 
              className="btn-zoom-action" 
              onClick={handleZoomOut} 
              title="Zoom Out Horizontally (or mouse wheel)"
            >
              <ZoomOut size={14} />
            </button>
            <button 
              className="btn-zoom-action" 
              onClick={handleResetScale} 
              title="Reset View & Scales (or double-click axis)"
            >
              <Maximize2 size={14} />
            </button>
          </div>

          <button 
            className="btn-refresh-chart"
            onClick={() => selectStock(selectedStock, true)}
            title="Force refresh stock data"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* EMA Toggle Pills Strip + Candle D/W Selector */}
      <div className="chart-indicator-toggles-bar">
        <div className="indicator-toggle-group">
          <span className="toggle-group-label">Overlays:</span>

          <button 
            className={`btn-indicator-toggle toggle-ema20 ${chartToggles.ema20 ? 'active' : ''}`}
            onClick={() => setChartToggle('ema20')}
          >
            <span className="indicator-dot dot-ema20" />
            <span>EMA 20</span>
            {ind.ema20 && <span className="indicator-val">₹{ind.ema20}</span>}
          </button>

          <button 
            className={`btn-indicator-toggle toggle-ema50 ${chartToggles.ema50 ? 'active' : ''}`}
            onClick={() => setChartToggle('ema50')}
          >
            <span className="indicator-dot dot-ema50" />
            <span>EMA 50</span>
            {ind.ema50 && <span className="indicator-val">₹{ind.ema50}</span>}
          </button>

          <button 
            className={`btn-indicator-toggle toggle-ema100 ${chartToggles.ema100 ? 'active' : ''}`}
            onClick={() => setChartToggle('ema100')}
          >
            <span className="indicator-dot dot-ema100" />
            <span>EMA 100</span>
            {ind.ema100 && <span className="indicator-val">₹{ind.ema100}</span>}
          </button>

          <button 
            className={`btn-indicator-toggle toggle-ema200 ${chartToggles.ema200 ? 'active' : ''}`}
            onClick={() => setChartToggle('ema200')}
          >
            <span className="indicator-dot dot-ema200" />
            <span>EMA 200</span>
            {ind.ema200 && <span className="indicator-val">₹{ind.ema200}</span>}
          </button>

          <button 
            className={`btn-indicator-toggle toggle-vol ${chartToggles.volume ? 'active' : ''}`}
            onClick={() => setChartToggle('volume')}
          >
            <span className="indicator-dot dot-vol" />
            <span>Volume</span>
          </button>

          <button 
            className={`btn-indicator-toggle toggle-div ${chartToggles.divergence ? 'active' : ''}`}
            onClick={() => setChartToggle('divergence')}
            title="Continuous Bar-by-Bar Divergence Score Timeline (-100 to +100)"
          >
            <span className="indicator-dot dot-divergence" />
            <span>Divergence</span>
            {ind.compositeScore !== undefined && (
              <span className="indicator-val" style={{ color: ind.compositeScore >= 0 ? '#10b981' : '#f43f5e' }}>
                {ind.compositeScore > 0 ? `+${ind.compositeScore}` : ind.compositeScore}
              </span>
            )}
          </button>

          {/* D / W Timeframe Selector Pill */}
          <div className="candle-tf-selector" title="Switch Candle Timeframe Frequency">
            <button
              className={`btn-tf-toggle ${timeframe === 'D' ? 'active' : ''}`}
              onClick={() => setTimeframe('D')}
              title="Daily Candles (DB)"
            >
              D
            </button>
            <button
              className={`btn-tf-toggle ${timeframe === 'W' ? 'active' : ''}`}
              onClick={() => setTimeframe('W')}
              title="Weekly Candles (Dynamic On-the-Fly)"
            >
              W
            </button>
          </div>
        </div>

        {/* Alignment & Divergence Status Tag */}
        <div className="chart-alignment-status">
          {ind.isGoldenStack && (
            <span className="pill-alignment golden">
              <Sparkles size={13} /> Golden Stack (Strong Bullish)
            </span>
          )}
          {ind.isDeathStack && (
            <span className="pill-alignment death">
              ✕ Death Stack (Strong Bearish)
            </span>
          )}
          {timeframe === 'D' && ind.isPullbackEMA20 && (
            <span className="pill-alignment pullback">
              ⚡ Uptrend Pullback to 20 EMA
            </span>
          )}
          <span className="pill-composite-score">
            {timeframe === 'W' ? 'Weekly' : 'Daily'} Divergence: <strong>{ind.compositeScore > 0 ? `+${ind.compositeScore}` : ind.compositeScore}</strong>
          </span>
        </div>
      </div>

      {/* Warning display when weekly bars are insufficient for long EMAs */}
      {timeframe === 'W' && weeklyData?.warnings?.length > 0 && (
        <div className="chart-warning-banner">
          <AlertCircle size={15} />
          <span>Note: {weeklyData.warnings.join(' ')} (Strict mode: No simulated or dummy data generated).</span>
        </div>
      )}

      {/* Dynamic Hover Crosshair Legend */}
      <div className="chart-hover-legend">
        {legendData ? (
          <div className="legend-items-row">
            <span className="legend-date">Date: <strong>{legendData.time}</strong></span>
            <span>O: <strong>₹{legendData.open}</strong></span>
            <span>H: <strong>₹{legendData.high}</strong></span>
            <span>L: <strong>₹{legendData.low}</strong></span>
            <span>C: <strong>₹{legendData.close}</strong></span>
            {legendData.volume && <span>Vol: <strong>{legendData.volume.toLocaleString()}</strong></span>}
            {chartToggles.ema20 && legendData.ema20 && (
              <span className="text-cyan">EMA20: <strong>₹{legendData.ema20}</strong></span>
            )}
            {chartToggles.ema50 && legendData.ema50 && (
              <span className="text-amber">EMA50: <strong>₹{legendData.ema50}</strong></span>
            )}
            {chartToggles.ema100 && legendData.ema100 && (
              <span className="text-rose" style={{ color: '#ff7043' }}>EMA100: <strong>₹{legendData.ema100}</strong></span>
            )}
            {chartToggles.ema200 && legendData.ema200 && (
              <span className="text-magenta">EMA200: <strong>₹{legendData.ema200}</strong></span>
            )}
            {chartToggles.divergence && legendData.divergence !== null && legendData.divergence !== undefined && (
              <span style={{ color: '#c084fc' }}>
                Div: <strong style={{ color: legendData.divergence >= 0 ? '#34d399' : '#fb7185' }}>
                  {legendData.divergence > 0 ? `+${legendData.divergence}` : legendData.divergence}
                </strong>
              </span>
            )}
          </div>
        ) : (
          <div className="legend-items-row text-dim">
            <span>Hover cursor over candles to inspect precise OHLC & EMA metrics ({timeframe === 'W' ? 'Weekly' : 'Daily'})</span>
          </div>
        )}
      </div>

      {/* TradingView Lightweight Chart Container */}
      <div className="lightweight-chart-container" ref={chartContainerRef} />

      {/* Key Stats Bar at Bottom */}
      <div className="chart-metrics-footer">
        <div className="footer-metric-item">
          <span className="metric-label">52W High</span>
          <span className="metric-val">₹{ind.high52W || '---'}</span>
          {ind.distFrom52WHigh !== undefined && <span className="metric-sub">{ind.distFrom52WHigh}% from ATH</span>}
        </div>
        <div className="footer-metric-item">
          <span className="metric-label">52W Low</span>
          <span className="metric-val">₹{ind.low52W || '---'}</span>
        </div>
        <div className="footer-metric-item">
          <span className="metric-label">Price vs {timeframe === 'W' ? 'Weekly ' : ''}EMA20</span>
          <span className={`metric-val ${ind.priceVsEma20 >= 0 ? 'text-emerald' : 'text-rose'}`}>
            {ind.priceVsEma20 >= 0 ? '+' : ''}{ind.priceVsEma20}%
          </span>
        </div>
        <div className="footer-metric-item">
          <span className="metric-label">{timeframe === 'W' ? 'Weekly ' : ''}EMA20 vs EMA50</span>
          <span className={`metric-val ${ind.ema20VsEma50 >= 0 ? 'text-emerald' : 'text-rose'}`}>
            {ind.ema20VsEma50 >= 0 ? '+' : ''}{ind.ema20VsEma50}%
          </span>
        </div>
        <div className="footer-metric-item">
          <span className="metric-label">RSI (14)</span>
          <span className="metric-val">{ind.rsi || '---'}</span>
        </div>
        <div className="footer-metric-item">
          <span className="metric-label">Volume Surge</span>
          <span className="metric-val">{ind.volumeSurge || '1.0'}x</span>
          <span className="metric-sub">20-period SMA</span>
        </div>
      </div>
    </div>
  );
}
