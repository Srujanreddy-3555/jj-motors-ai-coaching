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

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="badge-neutral">Pending</span>;
  const color = score >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : score >= 60 ? 'text-[#FFC107] bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200';
  return <span className={`badge ${color}`}>{score}/100</span>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <span className="badge-success">Completed</span>;
  if (status === 'failed') return <span className="badge-danger">Failed</span>;
  if (status === 'in_progress') return <span className="badge-warning">In Progress</span>;
  return <span className="badge-neutral">{status}</span>;
}

export default function CallsPage() {
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
      callsApi.list().then(setCalls).catch(() => setCalls([])).finally(() => setLoading(false));
    }
  }, [checking]);

  if (checking) {
    return <Layout><LoadingScreen message="Loading…" /></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Call History</h1>
            <p className="page-subtitle">Review your practice sessions, scores, and AI feedback</p>
          </div>
          <Link href="/" className="btn-primary inline-flex items-center gap-2 text-sm w-fit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Practice Call
          </Link>
        </div>

        {loading ? (
          <div className="card py-16">
            <LoadingScreen message="Loading calls…" className="min-h-[200px]" />
          </div>
        ) : calls.length === 0 ? (
          <div className="card text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No calls yet</h3>
            <p className="text-gray-500 mt-1 mb-6">Start a practice call to see your results here</p>
            <Link href="/" className="btn-primary inline-flex items-center gap-2 px-8 py-3">
              Start your first call
            </Link>
          </div>
        ) : (
          <div className="card-flat">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_100px_100px] gap-4 px-6 py-3.5 border-b border-gray-100 bg-gray-50/60 text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
              <span>Date & Time</span>
              <span>Status</span>
              <span>Duration</span>
              <span>Score</span>
              <span className="text-right">Action</span>
            </div>
            {/* Rows */}
            <div className="divide-y divide-gray-100">
              {calls.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/calls/${c.id}`}
                  className="grid sm:grid-cols-[1fr_120px_120px_100px_100px] gap-3 sm:gap-4 px-6 py-4 hover:bg-[#FFC107]/[0.03] transition-colors group items-center"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-[#FFC107]/10 group-hover:text-[#FFC107] transition-all flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Practice Session</p>
                      <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="sm:flex items-center hidden"><StatusBadge status={c.status} /></div>
                  <div className="text-sm text-gray-600 sm:flex items-center hidden">
                    {c.duration_seconds != null ? `${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s` : '—'}
                  </div>
                  <div className="sm:flex items-center hidden"><ScoreBadge score={c.overall_score} /></div>
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
        )}
      </div>
    </Layout>
  );
}
