// Recharts wrappers in the app palette. Rendered only after mount (no SSR size warnings).
import { useEffect, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const AXIS = { stroke: 'rgba(245,247,251,0.45)', fontSize: 12 };
const GRID = 'rgba(245,247,251,0.08)';
const tooltipStyle = {
  contentStyle: { background: '#112650', border: '1px solid rgba(245,247,251,0.15)', borderRadius: 10, fontSize: 13 },
  labelStyle: { color: '#F5F7FB' },
  itemStyle: { color: '#F5F7FB' },
  cursor: { fill: 'rgba(245,247,251,0.05)' },
};

function Mounted({ height, children }: { height: number; children: ReactNode }) {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return <div style={{ height }}>{ok ? children : <div className="skeleton h-full w-full" />}</div>;
}

export function ChartCard({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h3 className="card-title">{title}</h3>
      {note && <p className="meta mb-2">{note}</p>}
      {children}
    </section>
  );
}

export function HBar({ data, x, y, color = '#2DD4BF', height = 240, highlight }: { data: object[]; x: string; y: string; color?: string; height?: number; highlight?: (d: never) => boolean }) {
  return (
    <Mounted height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...AXIS} />
          <YAxis type="category" dataKey={y} width={110} interval={0} {...AXIS} tick={{ fill: 'rgba(245,247,251,0.8)', fontSize: 12 }} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey={x} radius={[0, 6, 6, 0]} maxBarSize={22}>
            {data.map((d, i) => (
              <Cell key={i} fill={highlight && highlight(d as never) ? '#F87171' : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Mounted>
  );
}

export function VBar({ data, x, y, color = '#FF9933', height = 240 }: { data: object[]; x: string; y: string; color?: string; height?: number }) {
  return (
    <Mounted height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -16, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={x} {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey={y} fill={color} radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </Mounted>
  );
}

export function TrendLine({ data, x, lines, height = 240 }: { data: object[]; x: string; lines: { key: string; color: string; name: string }[]; height?: number }) {
  return (
    <Mounted height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -16, right: 12, top: 8, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={x} {...AXIS} />
          <YAxis domain={[0, 100]} unit="%" {...AXIS} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Mounted>
  );
}
