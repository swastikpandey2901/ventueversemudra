import { useState, useRef, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';

const StockChart = ({ data, startPrice, userTrades = [] }) => {
  const [chartType, setChartType] = useState('candles'); // 'area' | 'candles'
  const [hoveredCandle, setHoveredCandle] = useState(null);
  const containerRef = useRef(null);

  // Ensure we always have at least 2 points so the chart never breaks or blanks out
  const validData = useMemo(() => {
    if (Array.isArray(data) && data.length >= 2) return data;
    const basePrice = (Array.isArray(data) && data[0]?.price) || startPrice || 100;
    const now = Date.now();
    if (Array.isArray(data) && data.length === 1) {
      return [
        { price: startPrice || basePrice, timestamp: (data[0].timestamp || now) - 60000 },
        data[0],
      ];
    }
    return [
      { price: basePrice, timestamp: now - 60000 },
      { price: basePrice, timestamp: now },
    ];
  }, [data, startPrice]);

  // Normalize data into OHLC candles
  const candles = useMemo(() => {
    if (!validData || validData.length === 0) return [];

    return validData.map((d, i) => {
      const price = typeof d.price === 'number' ? parseFloat(d.price.toFixed(2)) : Number(d.price || 0);
      const prevPrice = i > 0
        ? (typeof validData[i - 1].price === 'number' ? parseFloat(validData[i - 1].price.toFixed(2)) : Number(validData[i - 1].price || price))
        : (startPrice || price);

      const open = typeof d.open === 'number' ? d.open : prevPrice;
      const close = typeof d.close === 'number' ? d.close : price;
      const high = typeof d.high === 'number' ? d.high : Math.max(open, close) * 1.002;
      const low = typeof d.low === 'number' ? d.low : Math.min(open, close) * 0.998;

      const dateObj = new Date(d.timestamp);
      const timeStr = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : `T${i + 1}`;

      const changePct = open > 0 ? ((close - open) / open) * 100 : 0;
      const isBullish = close >= open;

      return {
        price,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        timestamp: d.timestamp,
        time: timeStr,
        changePct: parseFloat(changePct.toFixed(2)),
        isBullish,
      };
    });
  }, [validData, startPrice]);

  // Map user trades to nearest candle index for rendering markers
  const tradeMarkers = useMemo(() => {
    if (!userTrades || userTrades.length === 0 || !candles || candles.length === 0) return [];

    return userTrades.map((trade) => {
      // Find the candle whose timestamp is closest to this trade's timestamp
      let bestIdx = 0;
      let bestDiff = Infinity;
      candles.forEach((c, i) => {
        const diff = Math.abs((c.timestamp || 0) - (trade.timestamp || 0));
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      });
      return {
        ...trade,
        candleIdx: bestIdx,
        candleTime: candles[bestIdx]?.time || '',
      };
    });
  }, [userTrades, candles]);

  const [hoveredTrade, setHoveredTrade] = useState(null);

  if (!candles || candles.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-mudra-muted text-sm">
        Initializing chart data...
      </div>
    );
  }

  // Enrich candles with trade marker data for Recharts area mode
  const enrichedCandles = useMemo(() => {
    if (!tradeMarkers || tradeMarkers.length === 0) return candles;
    // Clone candles and attach buy/sell price at the matching candle index
    const cloned = candles.map((c) => ({ ...c }));
    tradeMarkers.forEach((tm) => {
      if (tm.candleIdx >= 0 && tm.candleIdx < cloned.length) {
        if (tm.type === 'buy') {
          // Store buy price for rendering; if multiple buys on same candle, keep last
          cloned[tm.candleIdx].buyMarkerPrice = tm.price;
          cloned[tm.candleIdx].buyMarkerQty = (cloned[tm.candleIdx].buyMarkerQty || 0) + tm.quantity;
        } else {
          cloned[tm.candleIdx].sellMarkerPrice = tm.price;
          cloned[tm.candleIdx].sellMarkerQty = (cloned[tm.candleIdx].sellMarkerQty || 0) + tm.quantity;
        }
      }
    });
    return cloned;
  }, [candles, tradeMarkers]);

  // Common calculations
  const lastCandle = candles[candles.length - 1];
  const lastPrice = lastCandle?.close || lastCandle?.price;
  const isUp = lastPrice >= (startPrice || candles[0]?.open || lastPrice);
  const themeColor = isUp ? '#10b981' : '#ef4444';

  const allLows = candles.map((c) => c.low);
  const allHighs = candles.map((c) => c.high);
  if (startPrice) {
    allLows.push(startPrice);
    allHighs.push(startPrice);
  }
  // Include user trade prices in Y-axis range so markers are always visible
  if (tradeMarkers && tradeMarkers.length > 0) {
    tradeMarkers.forEach((tm) => {
      allLows.push(tm.price);
      allHighs.push(tm.price);
    });
  }
  const minP = Math.min(...allLows);
  const maxP = Math.max(...allHighs);
  const pad = (maxP - minP) * 0.1 || 2;
  const yMin = Math.max(0, minP - pad);
  const yMax = maxP + pad;

  // Candlestick SVG geometry
  const width = 800;
  const height = 280;
  const padTop = 20;
  const padBottom = 30;
  const padLeft = 10;
  const padRight = 65;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const priceToY = (p) => {
    if (yMax === yMin) return height / 2;
    return padTop + chartH - ((p - yMin) / (yMax - yMin)) * chartH;
  };

  // Limit display to the most recent 35-40 candles for clean spacing
  const displayCandles = candles.slice(-35);
  const candleCount = displayCandles.length;
  const candleGap = chartW / Math.max(1, candleCount);
  const candleBodyW = Math.max(4, Math.min(18, candleGap * 0.65));

  // Y-axis grid markers (4 levels)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = yMin + (yMax - yMin) * pct;
    return { val, y: priceToY(val) };
  });

  return (
    <div className="w-full h-full flex flex-col select-none relative" ref={containerRef}>
      {/* Header bar: Chart Type Selector & Quick OHLC Status */}
      <div className="flex items-center justify-between pb-2 border-b border-mudra-border/60 mb-2">
        {/* Left: Active / Hovered Candle OHLC Metrics */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-[11px] font-mono">
          {(() => {
            const active = hoveredCandle || lastCandle;
            if (!active) return null;
            return (
              <>
                <span className="text-mudra-muted font-sans font-semibold">
                  {hoveredCandle ? `Candle (${active.time}):` : 'Latest Candle:'}
                </span>
                <span className="text-white">
                  O: <strong className="font-mono">🪙{active.open.toFixed(2)}</strong>
                </span>
                <span className="text-emerald-400">
                  H: <strong className="font-mono">🪙{active.high.toFixed(2)}</strong>
                </span>
                <span className="text-rose-400">
                  L: <strong className="font-mono">🪙{active.low.toFixed(2)}</strong>
                </span>
                <span className={active.isBullish ? 'text-mudra-green font-bold' : 'text-mudra-red font-bold'}>
                  C: <strong className="font-mono">🪙{active.close.toFixed(2)}</strong> (
                  {active.changePct >= 0 ? '+' : ''}
                  {active.changePct}%)
                </span>
              </>
            );
          })()}
        </div>

        {/* Right: Toggle Button between Line/Area & Candlesticks */}
        <div className="flex items-center bg-mudra-bg border border-mudra-border/80 rounded-lg p-0.5 shadow-inner">
          <button
            type="button"
            onClick={() => setChartType('area')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              chartType === 'area'
                ? 'bg-mudra-accent text-white shadow-sm'
                : 'text-mudra-muted hover:text-white'
            }`}
          >
            <span>📈</span>
            <span className="hidden sm:inline">Line / Area</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType('candles')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              chartType === 'candles'
                ? 'bg-mudra-gold text-black font-bold shadow-sm'
                : 'text-mudra-muted hover:text-white'
            }`}
          >
            <span>🕯️</span>
            <span className="hidden sm:inline">Candlesticks</span>
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 w-full min-h-0 relative">
        {chartType === 'area' ? (
          /* Recharts Line/Area Mode */
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={enrichedCandles} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fullGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={themeColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={themeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `🪙${v.toFixed(0)}`}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0d1117',
                  border: '1px solid #1f2937',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v, name) => {
                  if (name === 'Price') return [`🪙${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 'Price'];
                  if (name === 'Your Buy') return [`🪙${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, '🟠 Your Buy Price'];
                  if (name === 'Your Sell') return [`🪙${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, '🔵 Your Sell Price'];
                  return [`🪙${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, name];
                }}
              />
              {startPrice && (
                <ReferenceLine
                  y={startPrice}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: 'IPO', fill: '#94a3b8', fontSize: 10, position: 'insideTopLeft' }}
                />
              )}
              <Area
                type="monotone"
                dataKey="close"
                stroke={themeColor}
                strokeWidth={2}
                fill="url(#fullGrad)"
                dot={false}
                isAnimationActive={false}
                name="Price"
              />
              {/* Buy marker dots — orange filled circles at the buy price */}
              <Area
                type="monotone"
                dataKey="buyMarkerPrice"
                stroke="none"
                fill="none"
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (!payload.buyMarkerPrice || !cx || !cy) return null;
                  return (
                    <g key={`buy-${cx}`}>
                      <circle cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="#ffffff" strokeWidth={1.5} opacity={0.95} />
                      <text x={cx} y={cy - 10} textAnchor="middle" fill="#f59e0b" fontSize="9" fontWeight="bold" fontFamily="monospace">
                        B ×{payload.buyMarkerQty}
                      </text>
                    </g>
                  );
                }}
                activeDot={false}
                isAnimationActive={false}
                connectNulls={false}
                name="Your Buy"
              />
              {/* Sell marker dots — blue filled circles at the sell price */}
              <Area
                type="monotone"
                dataKey="sellMarkerPrice"
                stroke="none"
                fill="none"
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (!payload.sellMarkerPrice || !cx || !cy) return null;
                  return (
                    <g key={`sell-${cx}`}>
                      <circle cx={cx} cy={cy} r={6} fill="#3b82f6" stroke="#ffffff" strokeWidth={1.5} opacity={0.95} />
                      <text x={cx} y={cy - 10} textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold" fontFamily="monospace">
                        S ×{payload.sellMarkerQty}
                      </text>
                    </g>
                  );
                }}
                activeDot={false}
                isAnimationActive={false}
                connectNulls={false}
                name="Your Sell"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          /* Candlestick SVG Mode */
          <div className="w-full h-full relative">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
              onMouseLeave={() => setHoveredCandle(null)}
            >
              {/* Gridlines & Price labels */}
              {yTicks.map((t, idx) => (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={t.y}
                    x2={width - padRight}
                    y2={t.y}
                    stroke="#1f2937"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={width - padRight + 6}
                    y={t.y + 3}
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    🪙{t.val.toFixed(0)}
                  </text>
                </g>
              ))}

              {/* Start / IPO Price Reference Line */}
              {startPrice && startPrice >= yMin && startPrice <= yMax && (
                <g>
                  <line
                    x1={padLeft}
                    y1={priceToY(startPrice)}
                    x2={width - padRight}
                    y2={priceToY(startPrice)}
                    stroke="#64748b"
                    strokeDasharray="4 4"
                    strokeWidth="1.2"
                  />
                  <text
                    x={padLeft + 4}
                    y={priceToY(startPrice) - 4}
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    IPO: 🪙{startPrice}
                  </text>
                </g>
              )}

              {/* Candlesticks */}
              {displayCandles.map((c, idx) => {
                const cx = padLeft + idx * candleGap + candleGap / 2;
                const highY = priceToY(c.high);
                const lowY = priceToY(c.low);
                const openY = priceToY(c.open);
                const closeY = priceToY(c.close);

                const bodyTop = Math.min(openY, closeY);
                const bodyH = Math.max(2, Math.abs(closeY - openY));
                const color = c.isBullish ? '#10b981' : '#ef4444';
                const isHovered = hoveredCandle === c;

                return (
                  <g
                    key={idx}
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={() => setHoveredCandle(c)}
                  >
                    {/* Hover column backdrop */}
                    {isHovered && (
                      <rect
                        x={cx - candleGap / 2}
                        y={padTop}
                        width={candleGap}
                        height={chartH}
                        fill="rgba(255,255,255,0.04)"
                      />
                    )}

                    {/* Wick line: High to Low */}
                    <line
                      x1={cx}
                      y1={highY}
                      x2={cx}
                      y2={lowY}
                      stroke={color}
                      strokeWidth={isHovered ? 2 : 1.2}
                    />

                    {/* Candle Body: Open to Close */}
                    <rect
                      x={cx - candleBodyW / 2}
                      y={bodyTop}
                      width={candleBodyW}
                      height={bodyH}
                      fill={color}
                      rx={1}
                      stroke={isHovered ? '#ffffff' : color}
                      strokeWidth={isHovered ? 1.5 : 0.5}
                    />

                    {/* Time ticks on X-axis (every 5-6 candles) */}
                    {(idx % Math.max(1, Math.floor(candleCount / 6)) === 0 || idx === candleCount - 1) && (
                      <text
                        x={cx}
                        y={height - 6}
                        fill="#94a3b8"
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="sans-serif"
                      >
                        {c.time}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── User Trade Markers (Buy = Orange ▲, Sell = Blue ▼) ── */}
              {tradeMarkers.map((tm, tIdx) => {
                // Map to displayCandles offset (displayCandles = candles.slice(-35))
                const displayOffset = candles.length - displayCandles.length;
                const displayIdx = tm.candleIdx - displayOffset;
                if (displayIdx < 0 || displayIdx >= displayCandles.length) return null;

                const cx = padLeft + displayIdx * candleGap + candleGap / 2;
                const markerY = priceToY(tm.price);
                const isBuy = tm.type === 'buy';
                const markerColor = isBuy ? '#f59e0b' : '#3b82f6';
                const isHoveredTrade = hoveredTrade === tIdx;

                // Clamp markerY within chart bounds
                const clampedY = Math.max(padTop + 4, Math.min(padTop + chartH - 4, markerY));

                return (
                  <g
                    key={`trade-${tIdx}`}
                    onMouseEnter={() => setHoveredTrade(tIdx)}
                    onMouseLeave={() => setHoveredTrade(null)}
                    className="cursor-pointer"
                  >
                    {/* Vertical dashed line from marker to candle area */}
                    <line
                      x1={cx}
                      y1={clampedY - 8}
                      x2={cx}
                      y2={clampedY + 8}
                      stroke={markerColor}
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                      opacity={0.6}
                    />

                    {/* Triangle marker: ▲ for buy, ▼ for sell */}
                    {isBuy ? (
                      <polygon
                        points={`${cx},${clampedY - 7} ${cx - 5},${clampedY + 2} ${cx + 5},${clampedY + 2}`}
                        fill={markerColor}
                        stroke="#fff"
                        strokeWidth={isHoveredTrade ? 1.5 : 0.8}
                        opacity={isHoveredTrade ? 1 : 0.9}
                      />
                    ) : (
                      <polygon
                        points={`${cx},${clampedY + 7} ${cx - 5},${clampedY - 2} ${cx + 5},${clampedY - 2}`}
                        fill={markerColor}
                        stroke="#fff"
                        strokeWidth={isHoveredTrade ? 1.5 : 0.8}
                        opacity={isHoveredTrade ? 1 : 0.9}
                      />
                    )}

                    {/* Hover tooltip showing buy/sell details */}
                    {isHoveredTrade && (
                      <g>
                        <rect
                          x={cx - 55}
                          y={clampedY - (isBuy ? 36 : -16)}
                          width={110}
                          height={28}
                          fill="#0d1117"
                          stroke={markerColor}
                          strokeWidth="1.2"
                          rx={4}
                          opacity={0.95}
                        />
                        <text
                          x={cx}
                          y={clampedY - (isBuy ? 23 : -26)}
                          textAnchor="middle"
                          fill={markerColor}
                          fontSize="9"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {isBuy ? '🟠 BUY' : '🔵 SELL'} ×{tm.quantity} @ 🪙{tm.price.toFixed(2)}
                        </text>
                        <text
                          x={cx}
                          y={clampedY - (isBuy ? 12 : -37)}
                          textAnchor="middle"
                          fill="#94a3b8"
                          fontSize="8"
                          fontFamily="monospace"
                        >
                          Total: 🪙{tm.totalValue.toLocaleString('en-IN')}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Quick floating helper banner */}
            <div className="absolute bottom-1 right-2 text-[10px] text-mudra-muted flex items-center gap-2 pointer-events-none bg-mudra-bg/80 px-2 py-0.5 rounded border border-mudra-border/40">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Bullish (Close &ge; Open)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" /> Bearish (Close &lt; Open)
              </span>
              {tradeMarkers.length > 0 && (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-0 h-0 inline-block" style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '6px solid #f59e0b' }} /> Your Buys
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-0 h-0 inline-block" style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid #3b82f6' }} /> Your Sells
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockChart;
