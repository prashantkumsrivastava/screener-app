import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Search,
  TrendingUp,
  Database,
  Play,
  Square,
  Star,
  BarChart2,
  SlidersHorizontal,
  RefreshCw,
  Sun,
  Moon
} from 'lucide-react';

export function Navbar() {
  const {
    stocks,
    favorites,
    selectedStock,
    selectStock,
    isScanning,
    scanProgress,
    scanEntireUniverse,
    scanBatch,
    cancelScan,
    setSettingsOpen,
    activeTab,
    setActiveTab,
    dbStats,
    setFilters,
    theme,
    toggleTheme
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef(null);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter stocks matching query
  const searchResults = searchQuery.trim() === '' ? [] : stocks.filter(s =>
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  ).slice(0, 8);

  const handleSelectSearchResult = (symbol) => {
    selectStock(symbol);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  return (
    <header className="navbar-container">
      {/* Brand & Market Indices */}
      <div className="navbar-left">
        <div className="navbar-brand" onClick={() => setActiveTab('screener')}>
          <div className="brand-icon-wrapper">
            <TrendingUp className="brand-icon" size={22} />
          </div>
          <div className="brand-text">
            <span className="brand-title">MY STOCK <span className="highlight-text">SCREENER</span></span>
            <span className="brand-subtitle">NIFTY 500 • EMA DIVERGENCE TERMINAL</span>
          </div>
        </div>

        {/* Live Index Ticker Pills */}
        <div className="market-ticker-pills">
          <div className="ticker-pill">
            <span className="ticker-label">NIFTY 50</span>
            <span className="ticker-val">24,852.40</span>
            <span className="ticker-chg positive">+0.48%</span>
          </div>
          <div className="ticker-pill">
            <span className="ticker-label">BANK NIFTY</span>
            <span className="ticker-val">53,420.15</span>
            <span className="ticker-chg positive">+0.62%</span>
          </div>
          <div className="ticker-pill">
            <span className="ticker-label">NIFTY IT</span>
            <span className="ticker-val">37,680.90</span>
            <span className="ticker-chg negative">-0.24%</span>
          </div>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="navbar-center" ref={searchRef}>
        <div className="search-input-wrapper">
          <Search className="search-icon" size={17} />
          <input
            type="text"
            className="search-input"
            placeholder="Search 500 stocks (e.g. RELIANCE, TCS, Tata...)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {isDropdownOpen && searchResults.length > 0 && (
          <div className="search-dropdown-menu">
            {searchResults.map((s) => (
              <div
                key={s.symbol}
                className="search-dropdown-item"
                onClick={() => handleSelectSearchResult(s.symbol)}
              >
                <div className="search-item-info">
                  <span className="search-item-sym">{s.symbol}</span>
                  <span className="search-item-name">{s.name}</span>
                </div>
                <div className="search-item-meta">
                  <span className="search-item-sector">{s.industry}</span>
                  {s.price > 0 && (
                    <span className="search-item-price">₹{s.price.toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Controls: Tabs, Scanner, DB Status */}
      <div className="navbar-right">
        {/* Navigation Tabs */}
        <div className="nav-tabs-pill">
          <button
            className={`nav-tab-btn ${activeTab === 'screener' ? 'active' : ''}`}
            onClick={() => setActiveTab('screener')}
          >
            <SlidersHorizontal size={15} />
            <span>Screener</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'chart' ? 'active' : ''}`}
            onClick={() => setActiveTab('chart')}
          >
            <BarChart2 size={15} />
            <span>Chart {selectedStock ? `(${selectedStock})` : ''}</span>
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'watchlist' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('screener');
              setFilters({ favoritesOnly: true });
            }}
          >
            <Star size={15} className={favorites.length > 0 ? 'text-amber' : ''} />
            <span>Watchlist ({favorites.length})</span>
          </button>
        </div>

        {/* Scanner Action */}
        <div className="scanner-action-wrapper">
          {isScanning ? (
            <div className="scanner-running-box">
              <div className="scan-progress-info">
                <span className="scan-sym-tag">{scanProgress.symbol}</span>
                <span className="scan-percent">{scanProgress.percent}%</span>
              </div>
              <div className="scan-progress-bar-track">
                <div
                  className="scan-progress-bar-fill"
                  style={{ width: `${scanProgress.percent}%` }}
                />
              </div>
              <button
                className="btn-cancel-scan"
                onClick={cancelScan}
                title="Stop Scan"
              >
                <Square size={13} fill="currentColor" />
              </button>
            </div>
          ) : (
            <div className="scan-buttons-group">
              <button
                className="btn-primary-scan"
                onClick={scanEntireUniverse}
                title="Scan all 500 stocks"
              >
                <Play size={14} fill="currentColor" />
                <span>Scan 500</span>
              </button>
              <button
                className="btn-secondary-scan"
                onClick={() => {
                  const topSymbols = stocks.slice(0, 50).map(s => s.symbol);
                  scanBatch(topSymbols);
                }}
                title="Scan Top 50 Stocks"
              >
                <RefreshCw size={13} />
                <span>Top 50</span>
              </button>
            </div>
          )}
        </div>

        {/* Theme Toggle (Light / Dark) */}
        <button
          className="btn-theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun size={17} className="text-amber" />
          ) : (
            <Moon size={17} className="text-purple" />
          )}
        </button>

        {/* IndexedDB Manager / Settings */}
        <button
          className="btn-settings-trigger"
          onClick={() => setSettingsOpen(true)}
          title="IndexedDB Storage & Settings"
        >
          <Database size={16} />
          <span className="db-badge">{dbStats.cachedSymbolsCount}</span>
        </button>
      </div>
    </header>
  );
}
