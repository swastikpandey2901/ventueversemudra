import { ResponsiveContainer, AreaChart, Area, Tooltip, YAxis } from 'recharts';

const MiniChart = ({ data, isUp }) => {
  if (!data || data.length < 2) {
    return <div className="w-full h-full flex items-center justify-center text-mudra-muted text-xs">No data</div>;
  }

  const chartData = data.slice(-30).map(d => ({ price: d.price }));
  const color = isUp ? '#10b981' : '#ef4444';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${isUp ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={['auto', 'auto']} hide />
        <Tooltip
          contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #1f2937', borderRadius: 8, fontSize: 11 }}
          formatter={(v) => [`🪙${v.toFixed(2)}`, 'Price']}
          labelFormatter={() => ''}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#grad-${isUp ? 'up' : 'down'})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default MiniChart;
