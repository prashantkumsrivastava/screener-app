import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Star, TrendingUp, TrendingDown, Plus } from 'lucide-react';

export function FavoritesBar() {
  const { favorites, stocks, selectedStock, selectStock, toggleFavorite } = useAppStore();

  if (!favorites || favorites.length === 0) {
    return (
      <div className="favorites-empty-bar">
        <Star size={14} className="text-amber" />
        <span>Watchlist is empty. Click the ★ icon on any stock to pin it here for quick monitoring.</span>
      </div>
    );
  }

  return (
    <div className="favorites-strip-container">
      <div className="favorites-strip-label">
        <Star size={13} className="text-amber" fill="#ffb300" />
        <span>WATCHLIST ({favorites.length}):</span>
      </div>

      <div className="favorites-items-row">
        {favorites.map((sym) => {
          const stock = stocks.find(s => s.symbol === sym);
          const isSelected = selectedStock === sym;
          const isScanned = stock && stock.price > 0;
          const isPositive = stock && stock.changePercent1D >= 0;

          return (
            <div
              key={sym}
              className={`fav-stock-pill ${isSelected ? 'selected' : ''}`}
              onClick={() => selectStock(sym)}
              title={stock?.name || sym}
            >
              <span className="fav-sym">{sym}</span>
              {isScanned ? (
                <>
                  <span className="fav-price">₹{stock.price}</span>
                  <span className={`fav-chg ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? '+' : ''}{stock.changePercent1D}%
                  </span>
                </>
              ) : (
                <span className="fav-dim">---</span>
              )}
              <button
                className="btn-remove-fav"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(sym);
                }}
                title="Remove from favorites"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
