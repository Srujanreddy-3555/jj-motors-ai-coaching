'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuthStore } from '@/lib/auth-store';
import { auth, calls, type AnalyticsData } from '@/lib/api';

const KPI_META: { key: keyof AnalyticsData['kpi_averages']; label: string; icon: string }[] = [
  { key: 'confidence', label: 'Confidence', icon: '💪' },
  { key: 'clarity', label: 'Clarity', icon: '🎯' },
  { key: 'objection_handling', label: 'Objection Handling', icon: '🛡️' },
  { key: 'empathy', label: 'Empathy', icon: '❤️' },
  { key: 'product_knowledge', label: 'Product Knowledge', icon: '🔧' },
];

function MiniBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 80 ? '#00C853' : pct >= 60 ? '#FFC107' : '#EF4444';
  return (
    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex-1">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function ScoreChart({ history }: { history: AnalyticsData['score_history'] }) {
  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No scored calls yet — complete a practice call to see your trend
      </div>
    );
  }

  const scores = history.map((h) => h.overall_score ?? 0);
  const maxScore = 100;
  const firstDate = history[0]?.date;
  const lastDate = history[history.length - 1]?.date;
  const points = scores.map((s, i) => {
    const x = history.length === 1 ? 50 : (i / (history.length - 1)) * 100;
    const y = 100 - (s / maxScore) * 100;
    return { x, y, score: s, date: history[i]!.date };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath = `M${points[0]!.x},${points[0]!.y} ${points.map((p) => `L${p.x},${p.y}`).join(' ')} L${points[points.length - 1]!.x},100 L${points[0]!.x},100 Z`;

  return (
    <div className="relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-gray-400 font-medium w-7">
        <span>100</span>
        <span>75</span>
        <span>50</span>
        <span>25</span>
        <span>0</span>
      </div>
      <div className="ml-8">
        <svg viewBox="-2 -2 104 108" className="w-full h-48" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((v) => (
            <line key={v} x1="0" y1={100 - v} x2="100" y2={100 - v} stroke="#f3f4f6" strokeWidth="0.5" />
          ))}
          {/* Area fill */}
          <path d={areaPath} fill="url(#scoreGradient)" opacity="0.25" />
          {/* Line */}
          <polyline
            points={polyline}
            fill="none"
            stroke="#FFC107"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* Dots */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#FFC107" stroke="white" strokeWidth="0.8" />
          ))}
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFC107" />
              <stop offset="100%" stopColor="#FFC107" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        {/* X-axis labels */}
        {history.length > 1 && (
          <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
            <span>{firstDate ? new Date(firstDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
            <span>{lastDate ? new Date(lastDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { router.replace('/login'); return; }
    auth.me().then(setUser).catch(() => { localStorage.removeItem('token'); router.replace('/login'); }).finally(() => setChecking(false));
  }, [router, setUser]);

  useEffect(() => {
    if (!checking) {
      calls.analytics().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
    }
  }, [checking]);

  if (checking) {
    return <Layout><LoadingScreen message="Loading…" /></Layout>;
  }

  const d = data;
  const scoreColor = (d?.avg_score ?? 0) >= 80 ? 'text-emerald-600' : (d?.avg_score ?? 0) >= 60 ? 'text-[#FFC107]' : 'text-red-500';

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Track your performance trends over time</p>
          </div>
          <Link href="/" className="btn-primary inline-flex items-center gap-2 text-sm w-fit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Practice Call
          </Link>
        </div>

        {loading ? (
          <div className="card py-16"><LoadingScreen message="Loading analytics…" className="min-h-[200px]" /></div>
        ) : !d || d.total_calls === 0 ? (
          <div className="card text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No analytics yet</h3>
            <p className="text-gray-500 mt-1 mb-6">Complete a practice call to see your performance data</p>
            <Link href="/" className="btn-primary inline-flex items-center gap-2 px-8 py-3">Start your first call</Link>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card py-5 text-center">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Calls</p>
                <p className="text-3xl font-bold text-gray-900">{d.total_calls}</p>
              </div>
              <div className="card py-5 text-center">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Avg Score</p>
                <p className={`text-3xl font-bold ${scoreColor}`}>{d.avg_score}<span className="text-lg text-gray-400">/100</span></p>
              </div>
              <div className="card py-5 text-center">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Closing Rate</p>
                <p className="text-3xl font-bold text-gray-900">{d.closing_rate}<span className="text-lg text-gray-400">%</span></p>
              </div>
              <div className="card py-5 text-center">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Avg Duration</p>
                <p className="text-3xl font-bold text-gray-900">
                  {Math.floor(d.avg_duration_seconds / 60)}<span className="text-lg text-gray-400">m </span>
                  {d.avg_duration_seconds % 60}<span className="text-lg text-gray-400">s</span>
                </p>
              </div>
            </div>

            {/* Score trend chart */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Score Trend</h2>
              <ScoreChart history={d.score_history} />
            </div>

            {/* KPI breakdown */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">KPI Breakdown</h2>
              <div className="space-y-4">
                {KPI_META.map(({ key, label, icon }) => {
                  const val = d.kpi_averages[key];
                  const pct = (val / 10) * 100;
                  const color = pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-[#FFC107]' : 'text-red-500';
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <span className="text-base">{icon}</span>
                          {label}
                        </span>
                        <span className={`text-sm font-bold ${color}`}>{val}/10</span>
                      </div>
                      <MiniBar value={val} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent calls mini-table */}
            {d.score_history.length > 0 && (
              <div className="card-flat">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Scored Calls</h2>
                  <Link href="/calls" className="text-sm font-medium text-[#FFC107] hover:text-[#FFB300] transition-colors">
                    View all &rarr;
                  </Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {d.score_history.slice().reverse().slice(0, 5).map((h) => (
                    <Link key={h.id} href={`/calls/${h.id}`} className="flex items-center justify-between px-6 py-3.5 hover:bg-[#FFC107]/[0.03] transition-colors">
                      <span className="text-sm text-gray-600">
                        {h.date ? new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                      <span className={`text-sm font-bold ${(h.overall_score ?? 0) >= 80 ? 'text-emerald-600' : (h.overall_score ?? 0) >= 60 ? 'text-[#FFC107]' : 'text-red-500'}`}>
                        {h.overall_score ?? '—'}/100
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
