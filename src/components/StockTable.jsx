import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LineChart,
  Layers
} from 'lucide-react';

export function StockTable() {
  const {
    stocks,
    favorites,
    toggleFavorite,
    selectedStock,
    selectStock,
    filters,
    sort,
    setSort,
    setActiveTab
  } = useAppStore();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // 1. Filter stocks
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      // Search filter
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesSym = stock.symbol.toLowerCase().includes(q);
        const matchesName = stock.name && stock.name.toLowerCase().includes(q);
        if (!matchesSym && !matchesName) return false;
      }

      // Industry filter
      if (filters.industry !== 'ALL' && stock.industry !== filters.industry) {
        return false;
      }

      // Favorites only filter
      if (filters.favoritesOnly && !favorites.includes(stock.symbol)) {
        return false;
      }

      // Min Composite Score
      if (stock.compositeScore < filters.minScore) {
        return false;
      }

      // Min EMA Slope Score
      if (filters.minSlope > -100 && (stock.slopeScore || 0) < filters.minSlope) {
        return false;
      }

      // RSI Range
      if (stock.rsi < filters.minRsi || stock.rsi > filters.maxRsi) {
        return false;
      }

      // Volume surge
      if (filters.volumeSurgeOnly && stock.volumeSurge < 1.4) {
        return false;
      }

      // MACD Bullish filter
      if (filters.macdBullishOnly && !stock.isMacdBullish) {
        return false;
      }

      // Near 52W High filter (within 5% of ATH/52W High)
      if (filters.near52WHighOnly && !stock.isNear52WHigh) {
        return false;
      }

      // Preset strategies
      if (filters.preset === 'GOLDEN_STACK' && !stock.isGoldenStack) {
        return false;
      }
      if (filters.preset === 'DEATH_STACK' && !stock.isDeathStack) {
        return false;
      }
      if (filters.preset === 'GOLDEN_CROSS' && !stock.isGoldenCross) {
        return false;
      }
      if (filters.preset === 'NEAR_52W_HIGH' && !stock.isNear52WHigh) {
        return false;
      }
      if (filters.preset === 'MACD_BULLISH' && !stock.isMacdBullish) {
        return false;
      }
      if (filters.preset === 'PULLBACK_EMA20' && (!stock.isPullbackEMA20 && !stock.isPullbackEMA50)) {
        return false;
      }
      if (filters.preset === 'HIGH_MOMENTUM' && (stock.compositeScore < 45 || stock.volumeSurge < 1.3)) {
        return false;
      }
      if (filters.preset === 'OVERSOLD_RSI' && stock.rsi > 38) {
        return false;
      }

      return true;
    });
  }, [stocks, filters, favorites]);

  // 2. Sort stocks
  const sortedStocks = useMemo(() => {
    const list = [...filteredStocks];
    const { column, direction } = sort;

    list.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];

      if (column === 'symbol') {
        valA = a.symbol;
        valB = b.symbol;
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = Number(valA || 0);
      valB = Number(valB || 0);

      return direction === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [filteredStocks, sort]);

  // 3. Paginate
  const totalPages = Math.ceil(sortedStocks.length / pageSize) || 1;
  const paginatedStocks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedStocks.slice(start, start + pageSize);
  }, [sortedStocks, currentPage, pageSize]);

  const handleRowClick = (symbol) => {
    selectStock(symbol);
  };

  const handleViewChart = (e, symbol) => {
    e.stopPropagation();
    selectStock(symbol);
    setActiveTab('chart');
  };

  const renderSortIcon = (col) => {
    if (sort.column !== col) {
      return <ArrowUpDown size={12} className="sort-icon-idle" />;
    }
    return sort.direction === 'asc' ? (
      <ArrowUp size={12} className="sort-icon-active" />
    ) : (
      <ArrowDown size={12} className="sort-icon-active" />
    );
  };

  return (
    <div className="stock-table-card">
      {/* Table Header Controls */}
      <div className="table-controls-bar">
        <div className="table-results-info">
          <span className="results-badge">
            Showing <strong>{sortedStocks.length}</strong> of <strong>{stocks.length}</strong> stocks
          </span>
          {filters.preset !== 'ALL' && (
            <span className="active-preset-tag">
              Strategy: <strong>{filters.preset.replace('_', ' ')}</strong>
            </span>
          )}
        </div>

        <div className="pagination-bar-top">
          <div className="page-size-selector">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="pagination-buttons">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="btn-page-nav"
            >
              Prev
            </button>
            <span className="page-number-display">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="btn-page-nav"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-responsive-container">
        <table className="screener-table">
          <thead>
            <tr>
              <th className="th-fav">★</th>
              <th className="th-symbol sortable" onClick={() => setSort('symbol')}>
                <div className="th-content">
                  <span>Symbol & Name</span>
                  {renderSortIcon('symbol')}
                </div>
              </th>
              <th className="th-sector">Sector</th>
              <th className="th-price sortable" onClick={() => setSort('price')}>
                <div className="th-content">
                  <span>LTP (₹)</span>
                  {renderSortIcon('price')}
                </div>
              </th>
              <th className="th-change sortable" onClick={() => setSort('changePercent1D')}>
                <div className="th-content">
                  <span>1D Chg %</span>
                  {renderSortIcon('changePercent1D')}
                </div>
              </th>
              <th className="th-score sortable" onClick={() => setSort('compositeScore')}>
                <div className="th-content">
                  <span>Divergence Score</span>
                  {renderSortIcon('compositeScore')}
                </div>
              </th>
              <th className="th-score sortable" onClick={() => setSort('slopeScore')}>
                <div className="th-content">
                  <span>EMA Slope (20/50)</span>
                  {renderSortIcon('slopeScore')}
                </div>
              </th>
              <th className="th-spread sortable" onClick={() => setSort('priceVsEma20')}>
                <div className="th-content">
                  <span>P / EMA20</span>
                  {renderSortIcon('priceVsEma20')}
                </div>
              </th>
              <th className="th-spread sortable" onClick={() => setSort('ema20VsEma50')}>
                <div className="th-content">
                  <span>EMA 20/50</span>
                  {renderSortIcon('ema20VsEma50')}
                </div>
              </th>
              <th className="th-spread sortable" onClick={() => setSort('ema50VsEma200')}>
                <div className="th-content">
                  <span>EMA 50/200</span>
                  {renderSortIcon('ema50VsEma200')}
                </div>
              </th>
              <th className="th-alignment">Alignment</th>
              <th className="th-rsi sortable" onClick={() => setSort('rsi')}>
                <div className="th-content">
                  <span>RSI</span>
                  {renderSortIcon('rsi')}
                </div>
              </th>
              <th className="th-vol sortable" onClick={() => setSort('volumeSurge')}>
                <div className="th-content">
                  <span>Vol Surge</span>
                  {renderSortIcon('volumeSurge')}
                </div>
              </th>
              <th className="th-action">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStocks.length === 0 ? (
              <tr>
                <td colSpan={13} className="empty-table-cell">
                  <div className="empty-state-box">
                    <Layers size={36} className="empty-state-icon" />
                    <h4>No Stocks Match Filter Criteria</h4>
                    <p>Try loosening your filter parameters or reset filters to see all 500 stocks.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedStocks.map((stock) => {
                const isFav = favorites.includes(stock.symbol);
                const isSelected = selectedStock === stock.symbol;
                const isScanned = stock.price > 0;

                // Color classes for score
                const score = stock.compositeScore || 0;
                let scoreColor = 'neutral';
                if (score >= 40) scoreColor = 'super-bullish';
                else if (score >= 15) scoreColor = 'bullish';
                else if (score <= -40) scoreColor = 'super-bearish';
                else if (score <= -15) scoreColor = 'bearish';

                return (
                  <tr
                    key={stock.symbol}
                    className={`stock-row ${isSelected ? 'row-selected' : ''} ${!isScanned ? 'row-unscanned' : ''}`}
                    onClick={() => handleRowClick(stock.symbol)}
                  >
                    {/* Favorite Star */}
                    <td className="td-fav" onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(stock.symbol);
                    }}>
                      <Star
                        size={16}
                        className={`star-icon ${isFav ? 'starred' : ''}`}
                        fill={isFav ? '#ffb300' : 'none'}
                      />
                    </td>

                    {/* Symbol & Company Name */}
                    <td className="td-symbol">
                      <div className="symbol-cell">
                        <span className="sym-code">{stock.symbol}</span>
                        <span className="sym-name" title={stock.name}>{stock.name}</span>
                      </div>
                    </td>

                    {/* Sector */}
                    <td className="td-sector">
                      <span className="sector-tag" title={stock.industry}>
                        {stock.industry}
                      </span>
                    </td>

                    {/* Last Price */}
                    <td className="td-price">
                      {isScanned ? (
                        <span className="price-val">₹{stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-dim">---</span>
                      )}
                    </td>

                    {/* 1D Change % */}
                    <td className="td-change">
                      {isScanned ? (
                        <span className={`change-pill ${stock.changePercent1D >= 0 ? 'positive' : 'negative'}`}>
                          {stock.changePercent1D >= 0 ? '+' : ''}{stock.changePercent1D}%
                        </span>
                      ) : (
                        <span className="text-dim">---</span>
                      )}
                    </td>

                    {/* Composite Divergence Score with Heat Meter */}
                    <td className="td-score">
                      {isScanned ? (
                        <div className="score-meter-box">
                          <div className={`score-badge ${scoreColor}`}>
                            {score > 0 ? `+${score}` : score}
                          </div>
                          <div className="score-track">
                            <div
                              className={`score-fill ${scoreColor}`}
                              style={{
                                width: `${Math.abs(score)}%`,
                                marginLeft: score < 0 ? 'auto' : '0'
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-dim">---</span>
                      )}
                    </td>

                    {/* Normalized EMA Slope Indicator */}
                    <td className="td-score">
                      {isScanned && stock.slopeScore !== undefined ? (
                        <div 
                          className="score-meter-box" 
                          title={`Trend Velocity Angle: ${stock.slopeAngle || 0}° | 20EMA 5D: ${stock.slopeEma20}% | 50EMA 10D: ${stock.slopeEma50}%`}
                        >
                          <div className={`score-badge ${stock.slopeScore > 25 ? 'super-bullish' : stock.slopeScore > 0 ? 'bullish' : stock.slopeScore < -25 ? 'super-bearish' : stock.slopeScore < 0 ? 'bearish' : 'neutral'}`}>
                            {stock.slopeScore > 0 ? `+${stock.slopeScore}` : stock.slopeScore}
                          </div>
                          <div className="score-track">
                            <div
                              className={`score-fill ${stock.slopeScore > 25 ? 'super-bullish' : stock.slopeScore > 0 ? 'bullish' : stock.slopeScore < -25 ? 'super-bearish' : stock.slopeScore < 0 ? 'bearish' : 'neutral'}`}
                              style={{
                                width: `${Math.abs(stock.slopeScore)}%`,
                                marginLeft: stock.slopeScore < 0 ? 'auto' : '0'
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-dim">---</span>
                      )}
                    </td>

                    {/* Price vs EMA 20 Spread */}
                    <td className="td-spread">
                      {isScanned ? (
                        <span className={`spread-val ${stock.priceVsEma20 >= 0 ? 'pos' : 'neg'}`}>
                          {stock.priceVsEma20 >= 0 ? '+' : ''}{stock.priceVsEma20}%
                        </span>
                      ) : (
                        <span className="text-dim">---</span>
                      )}
                    </td>

                    {/* EMA 20 vs EMA 50 */}
                    <td className="td-spread">
                      {isScanned ? (
                        <span className={`spread-val ${stock.ema20VsEma50 >= 0 ? 'pos' : 'neg'}`}>
                          {stock.ema20VsEma50 >= 0 ? '+' : ''}{stock.ema20VsEma50}%
                        </span>
                      ) : (
                        <span className="text-dim">---</span>
                      )}
                    </td>

                    {/* EMA 50 vs EMA 200 */}
                    <td className="td-spread">
                      {isScanned ? (
                        <span className={`spread-val ${stock.ema50VsEma200 >= 0 ? 'pos' : 'neg'}`}>
                          {stock.ema50VsEma200 >= 0 ? '+' : ''}{stock.ema50VsEma200}%
                        </span>
                      ) : (
                        <span className="text-dim">---</span>
                      )}
                    </td>

                    {/* Alignment */}
                    <td className="td-alignment">
                      {isScanned ? (
                        stock.isGoldenStack ? (
                          <span className="badge-alignment golden" title="Price > EMA20 > EMA50 > EMA100 > EMA200">
                            ★ Golden Stack
                          </span>
                        ) : stock.isDeathStack ? (
                          <span className="badge-alignment death" title="Price < EMA20 < EMA50 < EMA100 < EMA200">
                            ✕ Death Stack
                          </span>
                        ) : stock.isPullbackEMA20 ? (
                          <span className="badge-alignment pullback" title="Bullish pullback to 20 EMA">
                            ⚡ EMA20 Dip
                          </span>
                        ) : stock.isGoldenCross ? (
                          <span className="badge-alignment cross" title="50 EMA crossed above 200 EMA">
                            ✦ 50/200 Cross
                          </span>
                        ) : (
                          <span className="badge-alignment neutral">
                            Mixed
                          </span>
                        )
                      ) : (
                        <span className="text-dim">Unscanned</span>
                      )}
                    </td>

                    {/* RSI */}
                    <td className="td-rsi">
                      {isScanned ? (
                        <span className={`rsi-tag ${stock.rsi >= 70 ? 'overbought' : stock.rsi <= 35 ? 'oversold' : ''}`}>
                          {stock.rsi}
                        </span>
                      ) : (
                        <span className="text-dim">---</span>
                      )}
                    </td>

                    {/* Volume Surge */}
                    <td className="td-vol">
                      {isScanned ? (
                        <span className={`vol-surge-pill ${stock.volumeSurge >= 1.5 ? 'surge-high' : ''}`}>
                          {stock.volumeSurge}x
                        </span>
                      ) : (
                        <span className="text-dim">---</span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="td-action">
                      <button
                        className="btn-chart-action"
                        onClick={(e) => handleViewChart(e, stock.symbol)}
                        title="Open Interactive Chart"
                      >
                        <LineChart size={14} />
                        <span>Chart</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination */}
      <div className="table-footer-bar">
        <span className="footer-count">
          Showing {paginatedStocks.length} of {sortedStocks.length} records
        </span>
        <div className="pagination-buttons">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="btn-page-nav"
          >
            Prev
          </button>
          <span className="page-number-display">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="btn-page-nav"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
