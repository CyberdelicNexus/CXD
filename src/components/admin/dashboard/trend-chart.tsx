'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface TrendPoint {
  day: string;
  value: number | null;
}

export function TrendChart({ data, label }: { data: TrendPoint[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="day" tickFormatter={(day: string) => day.slice(5)} stroke="rgba(255,255,255,0.4)" fontSize={11} minTickGap={32} />
          <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.4)" fontSize={11} width={40} />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }} />
          <Area type="monotone" dataKey="value" name={label} stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15} connectNulls={false} dot={{ r: 2, strokeWidth: 0, fill: '#a78bfa' }} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
