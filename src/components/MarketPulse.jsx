import { useAppStore } from '../store/useAppStore';
import { 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  Database,
  Activity
} from 'lucide-react';

export function MarketPulse() {
  const { stocks, setFilters, dbStats, selectStock, setActiveTab } = useAppStore();

  const scannedStocks = stocks.filter(s => s.price > 0);
  const goldenStackCount = stocks.filter(s => s.isGoldenStack).length;
  const deathStackCount = stocks.filter(s => s.isDeathStack).length;
  const pullbackCount = stocks.filter(s => s.isPullbackEMA20 || s.isPullbackEMA50).length;

  // Top momentum gainer / top score
  const topScorer = [...scannedStocks].sort((a, b) => b.compositeScore - a.compositeScore)[0];

  const aboveEma20Count = stocks.filter(s => s.priceVsEma20 > 0).length;
  const totalScanned = scannedStocks.length || 1;
  const bullishBreadthPct = Math.round((aboveEma20Count / totalScanned) * 100);

  return (
    <section className="market-pulse-grid">
      {/* Card 1: Bullish Golden Alignment */}
      <div 
        className="pulse-card pulse-card-bullish"
        onClick={() => setFilters({ preset: 'GOLDEN_STACK' })}
        title="Click to filter by Golden Alignment"
      >
        <div className="pulse-card-header">
          <span className="pulse-card-title">GOLDEN ALIGNMENT</span>
          <div className="pulse-icon-badge green">
            <TrendingUp size={16} />
          </div>
        </div>
        <div className="pulse-card-metric">
          <span className="pulse-main-num">{goldenStackCount}</span>
          <span className="pulse-sub-text">P &gt; 20 &gt; 50 &gt; 100 &gt; 200</span>
        </div>
        <div className="pulse-footer-tag positive">
          Bullish Supertrend
        </div>
      </div>

      {/* Card 2: Bearish Death Alignment */}
      <div 
        className="pulse-card pulse-card-bearish"
        onClick={() => setFilters({ preset: 'DEATH_STACK' })}
        title="Click to filter by Death Alignment"
      >
        <div className="pulse-card-header">
          <span className="pulse-card-title">DEATH ALIGNMENT</span>
          <div className="pulse-icon-badge red">
            <TrendingDown size={16} />
          </div>
        </div>
        <div className="pulse-card-metric">
          <span className="pulse-main-num">{deathStackCount}</span>
          <span className="pulse-sub-text">P &lt; 20 &lt; 50 &lt; 100 &lt; 200</span>
        </div>
        <div className="pulse-footer-tag negative">
          Bearish Breakdown
        </div>
      </div>

      {/* Card 3: Top Divergence Leader */}
      <div 
        className="pulse-card pulse-card-divergence"
        onClick={() => {
          if (topScorer) {
            selectStock(topScorer.symbol);
            setActiveTab('chart');
          }
        }}
        title={topScorer ? `View ${topScorer.symbol} Chart` : 'Scan stocks to find leader'}
      >
        <div className="pulse-card-header">
          <span className="pulse-card-title">TOP DIVERGENCE LEADER</span>
          <div className="pulse-icon-badge cyan">
            <Flame size={16} />
          </div>
        </div>
        <div className="pulse-card-metric">
          <span className="pulse-main-num text-cyan">
            {topScorer ? topScorer.symbol : '---'}
          </span>
          <span className="pulse-sub-text">
            {topScorer ? `Score: +${topScorer.compositeScore} / 100` : 'Scan to compute'}
          </span>
        </div>
        <div className="pulse-footer-tag cyan">
          {topScorer ? `LTP: ₹${topScorer.price} (${topScorer.changePercent1D > 0 ? '+' : ''}${topScorer.changePercent1D}%)` : 'Ready to Screen'}
        </div>
      </div>

      {/* Card 4: Pullbacks & Setups */}
      <div 
        className="pulse-card pulse-card-setups"
        onClick={() => setFilters({ preset: 'PULLBACK_EMA20' })}
        title="Click to view EMA pullback dip-buying setups"
      >
        <div className="pulse-card-header">
          <span className="pulse-card-title">EMA PULLBACK DIPS</span>
          <div className="pulse-icon-badge amber">
            <Activity size={16} />
          </div>
        </div>
        <div className="pulse-card-metric">
          <span className="pulse-main-num text-amber">{pullbackCount}</span>
          <span className="pulse-sub-text">Uptrend Pullback to 20/50 EMA</span>
        </div>
        <div className="pulse-footer-tag amber">
          High-Probability Entry
        </div>
      </div>

      {/* Card 5: Market Breadth & Local Cache */}
      <div className="pulse-card pulse-card-stats">
        <div className="pulse-card-header">
          <span className="pulse-card-title">MARKET BREADTH & CACHE</span>
          <div className="pulse-icon-badge purple">
            <Database size={16} />
          </div>
        </div>
        <div className="breadth-bar-container">
          <div className="breadth-labels">
            <span>Above 20 EMA: {bullishBreadthPct}%</span>
            <span>{scannedStocks.length}/500 Cached</span>
          </div>
          <div className="breadth-track">
            <div 
              className="breadth-fill-bullish" 
              style={{ width: `${bullishBreadthPct}%` }} 
            />
          </div>
        </div>
        <div className="pulse-footer-tag purple">
          LowDB Server: {dbStats.priceCount.toLocaleString()} candles (~{dbStats.estimatedSizeMB} MB)
        </div>
      </div>
    </section>
  );
}
