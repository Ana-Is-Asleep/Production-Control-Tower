'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../shared/Card';
import type { PurchaseLine } from '../../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

interface PickupDistributionCardProps {
  lines: PurchaseLine[];
}

export function PickupDistributionCard({ lines }: PickupDistributionCardProps) {
  const data = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const l of lines) {
      if (!l.asd) continue;
      const dow = l.asd.getDay();
      if (dow >= 1 && dow <= 5) counts[dow - 1]++;
    }
    return DAYS.map((d, i) => ({ day: d, pickups: counts[i] }));
  }, [lines]);

  const total = data.reduce((s, d) => s + d.pickups, 0);

  return (
    <Card>
      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-1">Pickup Distribution</h3>
        <p className="text-xs text-muted mb-3">{total} pickups this week</p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fill: '#8A7E74', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8A7E74', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#403833', border: 'none', color: '#f9f7f6', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="pickups" fill="#FF8900" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
