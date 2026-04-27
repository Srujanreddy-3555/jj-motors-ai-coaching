'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuthStore } from '@/lib/auth-store';
import { auth, calls as callsApi } from '@/lib/api';

type CallRow = {
  id: string;
  status: string;
  duration_seconds: number | null;
  overall_score: number | null;
  created_at: string;
};

function ScoreRingSmall({ score }: { score: number }) {
  const size = 52;
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#00C853' : score >= 60 ? '#FFC107' : '#EF4444';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out" />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{Math.round(score)}</span>
    </div>
  );
}

export default function ScoringPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { router.replace('/login'); return; }
    auth.me().then(setUser).catch(() => { localStorage.removeItem('token'); router.replace('/login'); }).finally(() => setChecking(false));
  }, [router, setUser]);

  useEffect(() => {
    if (!checking) {
      callsApi.list().then((all) => setCalls(all.filter((c) => c.status === 'completed' && c.overall_score != null)))
        .catch(() => setCalls([])).finally(() => setLoading(false));
    }
  }, [checking]);

  if (checking) return <Layout><LoadingScreen message="Loading..." /></Layout>;

  const avgScore = calls.length ? Math.round(calls.reduce((s, c) => s + (c.overall_score ?? 0), 0) / calls.length) : 0;
  const best = calls.length ? Math.max(...calls.map((c) => c.overall_score ?? 0)) : 0;
  const latest = calls[0]?.overall_score ?? 0;

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Call Scoring</h1>
            <p className="page-subtitle">Review AI scores for your completed practice calls</p>
          </div>
          <Link href="/" className="btn-primary inline-flex items-center gap-2 text-sm w-fit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Practice Call
          </Link>
        </div>

        {loading ? (
          <div className="card py-16"><LoadingScreen message="Loading scores..." className="min-h-[200px]" /></div>
        ) : calls.length === 0 ? (
          <div className="card text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No scored calls yet</h3>
            <p className="text-gray-500 mt-1 mb-6">Complete a practice call to see your AI scores here</p>
            <Link href="/" className="btn-primary inline-flex items-center gap-2 px-8 py-3">Start your first call</Link>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card py-5 text-center">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Latest Score</p>
                <p className={`text-3xl font-bold ${latest >= 80 ? 'text-emerald-600' : latest >= 60 ? 'text-[#FFC107]' : 'text-red-500'}`}>{latest}<span className="text-base text-gray-400">/100</span></p>
              </div>
              <div className="card py-5 text-center">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Average</p>
                <p className={`text-3xl font-bold ${avgScore >= 80 ? 'text-emerald-600' : avgScore >= 60 ? 'text-[#FFC107]' : 'text-red-500'}`}>{avgScore}<span className="text-base text-gray-400">/100</span></p>
              </div>
              <div className="card py-5 text-center">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Best Score</p>
                <p className="text-3xl font-bold text-emerald-600">{best}<span className="text-base text-gray-400">/100</span></p>
              </div>
            </div>

            {/* Scored calls list */}
            <div className="card-flat">
              <div className="hidden sm:grid grid-cols-[1fr_80px_120px_80px] gap-4 px-6 py-3.5 border-b border-gray-100 bg-gray-50/60 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                <span>Date & Time</span>
                <span className="text-center">Score</span>
                <span>Duration</span>
                <span className="text-right">Review</span>
              </div>
              <div className="divide-y divide-gray-100">
                {calls.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/calls/${c.id}`}
                    className="grid sm:grid-cols-[1fr_80px_120px_80px] gap-3 sm:gap-4 px-6 py-4 hover:bg-[#FFC107]/[0.03] transition-colors group items-center"
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#FFC107]/10 group-hover:text-[#FFC107] transition-all flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Practice Call</p>
                        <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <ScoreRingSmall score={c.overall_score ?? 0} />
                    </div>
                    <div className="text-sm text-gray-600 sm:flex items-center hidden">
                      {c.duration_seconds != null ? `${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s` : '—'}
                    </div>
                    <div className="flex items-center justify-end">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#FFC107] group-hover:text-[#FFB300] transition-colors">
                        View
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
