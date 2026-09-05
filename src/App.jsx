import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { Navbar } from './components/Navbar';
import { MarketPulse } from './components/MarketPulse';
import { FavoritesBar } from './components/FavoritesBar';
import { Filters } from './components/Filters';
import { StockTable } from './components/StockTable';
import { ChartPanel } from './components/ChartPanel';
import { SettingsModal } from './components/SettingsModal';
import './App.css';

export function App() {
  const { initialize, activeTab, selectedStock } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="app-wrapper">
      {/* Top Header */}
      <Navbar />

      {/* Main Terminal Body */}
      <main className="main-content-layout">
        {/* Watchlist Quick Access Strip */}
        <FavoritesBar />

        {/* View Mode: Screener vs Full Chart */}
        {activeTab === 'screener' ? (
          <>
            {/* Market Pulse Analytics Cards */}
            <MarketPulse />

            {/* Strategy & Technical Filters */}
            <Filters />

            {/* Split View: Table + Inline Interactive Chart for selected stock */}
            <div className="screener-main-grid">
              <StockTable />
            </div>

            {/* Quick Chart Drawer/Preview when a stock is selected */}
            {selectedStock && (
              <div className="selected-stock-preview-section">
                <ChartPanel />
              </div>
            )}
          </>
        ) : (
          /* Dedicated Deep Chart View */
          <div className="dedicated-chart-view">
            <ChartPanel />
          </div>
        )}
      </main>

      {/* IndexedDB & Diagnostics Modal */}
      <SettingsModal />
    </div>
  );
}

export default App;
