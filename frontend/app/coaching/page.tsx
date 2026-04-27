'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuthStore } from '@/lib/auth-store';
import { auth, calls, type CoachingData } from '@/lib/api';

function TipCard({ tip }: { tip: CoachingData['tips'][number] }) {
  const pct = (tip.score / 10) * 100;
  const color = pct >= 70 ? '#00C853' : pct >= 50 ? '#FFC107' : '#EF4444';
  return (
    <div className="card border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{tip.kpi}</h3>
        <span className="text-sm font-bold" style={{ color }}>{tip.score}/10</span>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{tip.tip}</p>
    </div>
  );
}

export default function CoachingPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CoachingData | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { router.replace('/login'); return; }
    auth.me().then(setUser).catch(() => { localStorage.removeItem('token'); router.replace('/login'); }).finally(() => setChecking(false));
  }, [router, setUser]);

  useEffect(() => {
    if (!checking) {
      calls.coaching().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
    }
  }, [checking]);

  if (checking) return <Layout><LoadingScreen message="Loading..." /></Layout>;

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">AI Coaching</h1>
            <p className="page-subtitle">Personalized tips based on your recent call performance</p>
          </div>
          <Link href="/" className="btn-primary inline-flex items-center gap-2 text-sm w-fit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Practice Now
          </Link>
        </div>

        {loading ? (
          <div className="card py-16"><LoadingScreen message="Analyzing your performance..." className="min-h-[200px]" /></div>
        ) : !data || !data.has_data ? (
          <div className="card text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#FFC107]/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#FFC107]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No coaching data yet</h3>
            <p className="text-gray-500 mt-1 mb-6">Complete a practice call so the AI can analyze your skills and give personalized tips</p>
            <Link href="/" className="btn-primary inline-flex items-center gap-2 px-8 py-3">Start your first call</Link>
          </div>
        ) : (
          <>
            {/* Focus areas banner */}
            {data.focus_areas.length > 0 && (
              <div className="card bg-gradient-to-r from-[#FFC107]/10 to-amber-50 border border-[#FFC107]/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#FFC107]/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-[#FFC107]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 mb-1">Your Focus Areas</h2>
                    <p className="text-sm text-gray-600">
                      Based on your last {data.recent_scores.length} calls, prioritize improving:{' '}
                      <span className="font-semibold text-[#F57F17]">{data.focus_areas.join(' & ')}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Strengths & weaknesses side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Strongest Skills</h2>
                <div className="space-y-3">
                  {data.strongest.map((s) => (
                    <div key={s.kpi} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">{s.kpi}</span>
                      <span className="text-sm font-bold text-emerald-600">{s.avg}/10</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Needs Work</h2>
                <div className="space-y-3">
                  {data.weakest.map((w) => (
                    <div key={w.kpi} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">{w.kpi}</span>
                      <span className="text-sm font-bold text-red-500">{w.avg}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Coaching tips */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Coaching Tips</h2>
              <div className="space-y-4">
                {data.tips.map((t, i) => <TipCard key={i} tip={t} />)}
              </div>
            </div>

            {/* Quick links */}
            <div className="flex flex-wrap gap-3">
              <Link href="/analytics" className="btn-secondary inline-flex items-center gap-2 text-sm">
                View Analytics
              </Link>
              <Link href="/calls" className="btn-secondary inline-flex items-center gap-2 text-sm">
                Review Past Calls
              </Link>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
