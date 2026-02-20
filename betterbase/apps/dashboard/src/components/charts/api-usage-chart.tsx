'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

const data = [
  { name: 'Mon', calls: 5200 },
  { name: 'Tue', calls: 6100 },
  { name: 'Wed', calls: 7800 },
  { name: 'Thu', calls: 6900 },
  { name: 'Fri', calls: 8400 },
  { name: 'Sat', calls: 7200 },
  { name: 'Sun', calls: 9300 },
];

export function ApiUsageChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="name" />
          <Tooltip />
          <Area type="monotone" dataKey="calls" stroke="#2563eb" fillOpacity={1} fill="url(#colorCalls)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
