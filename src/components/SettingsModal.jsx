import { useAppStore } from '../store/useAppStore';
import { 
  X, 
  Database, 
  Trash2, 
  Download, 
  FileSpreadsheet, 
  ShieldCheck, 
  HardDrive,
  RefreshCw
} from 'lucide-react';
import Papa from 'papaparse';

export function SettingsModal() {
  const { 
    settingsOpen, 
    setSettingsOpen, 
    dbStats, 
    refreshDbStats, 
    clearAllData, 
    stocks,
    favorites
  } = useAppStore();

  if (!settingsOpen) return null;

  // Export filtered stocks to CSV
  const handleExportCSV = () => {
    const exportData = stocks.map(s => ({
      Symbol: s.symbol,
      CompanyName: s.name,
      Industry: s.industry,
      Price: s.price,
      Change1D_Pct: s.changePercent1D,
      CompositeScore: s.compositeScore,
      PriceVsEMA20_Pct: s.priceVsEma20,
      EMA20VsEMA50_Pct: s.ema20VsEma50,
      EMA50VsEMA200_Pct: s.ema50VsEma200,
      RSI_14: s.rsi,
      VolumeSurge: s.volumeSurge,
      GoldenStack: s.isGoldenStack ? 'YES' : 'NO',
      DeathStack: s.isDeathStack ? 'YES' : 'NO',
      GoldenCross: s.isGoldenCross ? 'YES' : 'NO',
      PullbackEMA20: s.isPullbackEMA20 ? 'YES' : 'NO',
      LastUpdated: s.lastScanned || 'N/A'
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `nifty500_screen_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <Database className="text-cyan" size={22} />
            <div>
              <h3 className="modal-title">IndexedDB Storage & Terminal Diagnostics</h3>
              <p className="modal-subtitle">100% Client-Side Local Storage & Resilient Architecture</p>
            </div>
          </div>
          <button 
            className="btn-modal-close"
            onClick={() => setSettingsOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="modal-body">
          {/* Storage Metrics Box */}
          <div className="diag-section">
            <h4 className="diag-section-title">
              <HardDrive size={16} className="text-purple" />
              <span>Local IndexedDB Metrics (Dexie.js)</span>
              <button 
                className="btn-refresh-mini"
                onClick={refreshDbStats}
                title="Refresh diagnostics"
              >
                <RefreshCw size={13} />
              </button>
            </h4>

            <div className="stats-metric-cards-grid">
              <div className="stat-card">
                <span className="stat-label">Total Stored Candles</span>
                <span className="stat-val">{dbStats.priceCount.toLocaleString()}</span>
                <span className="stat-note">Table: prices</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Cached Stock Tickers</span>
                <span className="stat-val">{dbStats.cachedSymbolsCount} / 500</span>
                <span className="stat-note">Available offline</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">2-Year Coverage</span>
                <span className="stat-val">{dbStats.twoYearSymbolsCount || dbStats.threeYearSymbolsCount || 0} stocks</span>
                <span className="stat-note">&gt;= 400 trading days</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Historical Span</span>
                <span className="stat-val" style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                  {dbStats.earliestDate && dbStats.earliestDate !== 'N/A' 
                    ? `${dbStats.earliestDate} → ${dbStats.latestDate}`
                    : 'N/A'}
                </span>
                <span className="stat-note">Date coverage in DB</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Persistent Footprint</span>
                <span className="stat-val">~{dbStats.estimatedSizeMB} MB</span>
                <span className="stat-note">IndexedDB disk usage</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Pinned Watchlist</span>
                <span className="stat-val">{favorites.length} stocks</span>
                <span className="stat-note">Table: favorites</span>
              </div>
            </div>
          </div>

          {/* Export & Import Actions */}
          <div className="diag-section">
            <h4 className="diag-section-title">
              <FileSpreadsheet size={16} className="text-emerald" />
              <span>Data Export & Universe Files</span>
            </h4>

            <div className="action-buttons-list">
              <button className="btn-diag-action" onClick={handleExportCSV}>
                <Download size={15} />
                <span>Export Current Screened Universe to CSV</span>
              </button>
              
              <a 
                href="/ind_nifty500list.csv" 
                download="ind_nifty500list.csv" 
                className="btn-diag-action"
              >
                <Download size={15} />
                <span>Download Official Nifty 500 CSV Universe</span>
              </a>
            </div>
          </div>

          {/* Data Management & Cache Clearing */}
          <div className="diag-section danger-zone">
            <h4 className="diag-section-title">
              <Trash2 size={16} className="text-rose" />
              <span>Cache Management</span>
            </h4>
            <p className="danger-text">
              Clearing the cache will remove downloaded candles from IndexedDB. Fresh data will be downloaded upon the next scan.
            </p>
            <button 
              className="btn-danger-clear"
              onClick={async () => {
                if (window.confirm('Reset local IndexedDB cache? Pinned favorites will be preserved.')) {
                  await clearAllData();
                }
              }}
            >
              <Trash2 size={14} />
              <span>Purge Local Candle Cache</span>
            </button>
          </div>

          {/* Architecture Summary */}
          <div className="diag-section arch-info">
            <div className="arch-info-box">
              <ShieldCheck size={20} className="text-cyan" />
              <div className="arch-info-text">
                <strong>Zero Backend Guarantee:</strong>
                <span>All EMA math, divergence scores, and charts are calculated inside your browser's V8 engine. No server latency, zero cloud subscriptions, completely self-contained.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
