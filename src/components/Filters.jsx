import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { NIFTY_INDUSTRIES } from '../data/nifty500';
import { 
  Filter, 
  RotateCcw, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Layers, 
  Star, 
  Check,
  Activity,
  Flame,
  Compass
} from 'lucide-react';

export function Filters() {
  const { filters, setFilters, resetFilters, stocks } = useAppStore();

  const presets = [
    { id: 'ALL', label: 'All Stocks', icon: Layers },
    { id: 'GOLDEN_STACK', label: 'Golden Alignment', desc: 'P > 20 > 50 > 100 > 200', icon: TrendingUp, color: 'text-emerald' },
    { id: 'GOLDEN_CROSS', label: 'Golden Cross', desc: '50 EMA crossed above 200', icon: Sparkles, color: 'text-amber' },
    { id: 'NEAR_52W_HIGH', label: '52W High Breakout', desc: 'Within 5% of 52W High', icon: Flame, color: 'text-rose' },
    { id: 'MACD_BULLISH', label: 'MACD Bullish', desc: 'MACD Hist > 0', icon: Activity, color: 'text-cyan' },
    { id: 'PULLBACK_EMA20', label: 'EMA 20 Pullback', desc: 'Uptrend dip to 20 EMA', icon: Zap, color: 'text-cyan' },
    { id: 'HIGH_MOMENTUM', label: 'High Momentum', desc: 'Score > 50 & Vol Surge', icon: Zap, color: 'text-purple' },
    { id: 'DEATH_STACK', label: 'Death Alignment', desc: 'P < 20 < 50 < 100 < 200', icon: TrendingDown, color: 'text-rose' },
    { id: 'OVERSOLD_RSI', label: 'Oversold RSI', desc: 'RSI < 38', icon: Filter, color: 'text-blue' }
  ];

  // Count active non-default filters
  const activeCount = [
    filters.industry !== 'ALL',
    filters.preset !== 'ALL',
    filters.minScore > -100,
    filters.minSlope > -100,
    filters.minRsi > 0,
    filters.maxRsi < 100,
    filters.volumeSurgeOnly,
    filters.favoritesOnly,
    filters.macdBullishOnly,
    filters.near52WHighOnly
  ].filter(Boolean).length;

  return (
    <div className="filter-panel-wrapper">
      {/* Top Strategy Preset Bar */}
      <div className="preset-buttons-row">
        <span className="preset-label">
          <Sparkles size={14} className="text-amber" />
          <span>Strategies:</span>
        </span>
        <div className="preset-scroll-container">
          {presets.map(p => {
            const Icon = p.icon;
            const isSelected = filters.preset === p.id;
            return (
              <button
                key={p.id}
                className={`preset-btn ${isSelected ? 'active' : ''}`}
                onClick={() => setFilters({ preset: p.id })}
              >
                <Icon size={14} className={p.color || ''} />
                <span>{p.label}</span>
                {isSelected && <Check size={12} className="check-indicator" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Filter Controls Row */}
      <div className="filter-controls-row">
        {/* Industry / Sector Selector */}
        <div className="filter-field-box">
          <label className="filter-label">SECTOR / INDUSTRY</label>
          <select
            className="filter-select"
            value={filters.industry}
            onChange={(e) => setFilters({ industry: e.target.value })}
          >
            <option value="ALL">All Sectors ({stocks.length})</option>
            {NIFTY_INDUSTRIES.map(ind => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>

        {/* Min Divergence Score Slider */}
        <div className="filter-field-box score-slider-box">
          <div className="filter-slider-header">
            <label className="filter-label">MIN COMPOSITE SCORE</label>
            <span className={`filter-val-badge ${filters.minScore > 0 ? 'pos' : filters.minScore < 0 ? 'neg' : ''}`}>
              {filters.minScore > 0 ? `+${filters.minScore}` : filters.minScore}
            </span>
          </div>
          <input
            type="range"
            className="filter-range"
            min="-100"
            max="100"
            step="5"
            value={filters.minScore}
            onChange={(e) => setFilters({ minScore: Number(e.target.value) })}
          />
        </div>

        {/* Min EMA Slope (20/50) Score Slider */}
        <div className="filter-field-box score-slider-box">
          <div className="filter-slider-header">
            <label className="filter-label">MIN EMA SLOPE (20/50)</label>
            <span className={`filter-val-badge ${filters.minSlope > 0 ? 'pos' : filters.minSlope < 0 ? 'neg' : ''}`}>
              {filters.minSlope > 0 ? `+${filters.minSlope}` : filters.minSlope}
            </span>
          </div>
          <input
            type="range"
            className="filter-range"
            min="-100"
            max="100"
            step="5"
            value={filters.minSlope}
            onChange={(e) => setFilters({ minSlope: Number(e.target.value) })}
          />
        </div>

        {/* RSI Range */}
        <div className="filter-field-box rsi-range-box">
          <label className="filter-label">RSI(14) RANGE</label>
          <div className="rsi-inputs-wrapper">
            <input
              type="number"
              className="filter-num-input"
              min="0"
              max="100"
              placeholder="Min"
              value={filters.minRsi === 0 ? '' : filters.minRsi}
              onChange={(e) => setFilters({ minRsi: e.target.value === '' ? 0 : Number(e.target.value) })}
            />
            <span className="range-dash">-</span>
            <input
              type="number"
              className="filter-num-input"
              min="0"
              max="100"
              placeholder="Max"
              value={filters.maxRsi === 100 ? '' : filters.maxRsi}
              onChange={(e) => setFilters({ maxRsi: e.target.value === '' ? 100 : Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Indicator Toggles: Volume Surge, MACD, 52W High & Watchlist */}
        <div className="filter-toggles-box">
          <button
            className={`toggle-pill-btn ${filters.volumeSurgeOnly ? 'active' : ''}`}
            onClick={() => setFilters({ volumeSurgeOnly: !filters.volumeSurgeOnly })}
            title="Filter stocks with volume > 1.4x 20-day average"
          >
            <Zap size={13} className={filters.volumeSurgeOnly ? 'text-amber' : ''} />
            <span>Vol Surge (&gt; 1.4x)</span>
          </button>

          <button
            className={`toggle-pill-btn ${filters.macdBullishOnly ? 'active' : ''}`}
            onClick={() => setFilters({ macdBullishOnly: !filters.macdBullishOnly })}
            title="Filter stocks with MACD Histogram > 0"
          >
            <Activity size={13} className={filters.macdBullishOnly ? 'text-cyan' : ''} />
            <span>MACD Bullish</span>
          </button>

          <button
            className={`toggle-pill-btn ${filters.near52WHighOnly ? 'active' : ''}`}
            onClick={() => setFilters({ near52WHighOnly: !filters.near52WHighOnly })}
            title="Filter stocks within 5% of 52-Week High (Breakout Zone)"
          >
            <Flame size={13} className={filters.near52WHighOnly ? 'text-rose' : ''} />
            <span>Near 52W High (≤ 5%)</span>
          </button>

          <button
            className={`toggle-pill-btn ${filters.favoritesOnly ? 'active' : ''}`}
            onClick={() => setFilters({ favoritesOnly: !filters.favoritesOnly })}
            title="Show only bookmarked watchlist stocks"
          >
            <Star size={13} className={filters.favoritesOnly ? 'text-amber' : ''} fill={filters.favoritesOnly ? 'currentColor' : 'none'} />
            <span>Watchlist Only</span>
          </button>
        </div>

        {/* Reset Filter Action */}
        {activeCount > 0 && (
          <button 
            className="btn-reset-filters"
            onClick={resetFilters}
            title="Reset all filters"
          >
            <RotateCcw size={13} />
            <span>Reset ({activeCount})</span>
          </button>
        )}
      </div>
    </div>
  );
}
