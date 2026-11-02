import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

const StockChart = ({ data, startPrice }) => {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-mudra-muted text-sm">
        Not enough data yet — check back after the first price cycle.
      </div>
    );
  }

  const chartData = data.map(d => ({
    price: typeof d.price === 'number' ? parseFloat(d.price.toFixed(2)) : d.price,
    time: new Date(d.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  }));

  const lastPrice = chartData[chartData.length - 1]?.price;
  const isUp = lastPrice >= (startPrice || chartData[0]?.price || lastPrice);
  const color = isUp ? '#10b981' : '#ef4444';

  const minP = Math.min(...chartData.map(d => d.price));
  const maxP = Math.max(...chartData.map(d => d.price));
  const pad = (maxP - minP) * 0.1 || 1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="fullGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
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
          domain={[minP - pad, maxP + pad]}
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
          formatter={(v) => [`🪙${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 'Price']}
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
          dataKey="price"
          stroke={color}
          strokeWidth={2}
          fill="url(#fullGrad)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default StockChart;
