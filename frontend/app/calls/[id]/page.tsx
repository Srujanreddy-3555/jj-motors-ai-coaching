'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuthStore } from '@/lib/auth-store';
import { auth, calls } from '@/lib/api';

type CallDetail = {
  id: string;
  status: string;
  duration_seconds: number | null;
  recording_url: string | null;
  summary: string | null;
  strengths: string | null;
  weaknesses: string | null;
  improvement_tips: string | null;
  confidence: number | null;
  clarity: number | null;
  objection_handling: number | null;
  empathy: number | null;
  product_knowledge: number | null;
  closing_attempt: boolean | null;
  overall_score: number | null;
  transcript: Array<{ speaker: string; text: string; sequence: number }>;
  created_at: string;
  completed_at: string | null;
};

const KPI_LIST = [
  { key: 'confidence', label: 'Confidence', icon: '💪', desc: 'Assertiveness & poise' },
  { key: 'clarity', label: 'Clarity', icon: '🎯', desc: 'Clear communication' },
  { key: 'objection_handling', label: 'Objection Handling', icon: '🛡️', desc: 'Addressing pushback' },
  { key: 'empathy', label: 'Empathy', icon: '❤️', desc: 'Rapport & understanding' },
  { key: 'product_knowledge', label: 'Product Knowledge', icon: '🔧', desc: 'Auto service expertise' },
];

function useTranscriptSync(
  durationSeconds: number | null,
  transcript: Array<{ speaker: string; text: string; sequence: number }>
) {
  const sorted = [...transcript].sort((a, b) => a.sequence - b.sequence);
  const total = sorted.length;
  const duration = durationSeconds ?? 60;
  return sorted.map((line, i) => ({
    ...line,
    startSec: (i / total) * duration,
    endSec: ((i + 1) / total) * duration,
  }));
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#00C853' : score >= 60 ? '#FFC107' : '#EF4444';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth="10" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900">{Math.round(score)}</span>
        <span className="text-xs text-gray-500 font-medium">/ 100</span>
      </div>
    </div>
  );
}

function KpiBar({ label, icon, value, max = 10 }: { label: string; icon: string; value: number; max?: number }) {
  const pct = (value / max) * 100;
  const color = pct >= 80 ? '#00C853' : pct >= 60 ? '#FFC107' : '#EF4444';
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <span className="text-base">{icon}</span>
          {label}
        </span>
        <span className="text-sm font-bold" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function CallDetailPage() {
  const router = useRouter();
  const params = useParams();
  const callId = params?.id as string;
  const setUser = useAuthStore((s) => s.setUser);
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRefs = useRef<(HTMLDivElement | null)[]>([]);

  const linesWithTime = useTranscriptSync(detail?.duration_seconds ?? null, detail?.transcript ?? []);
  const activeIndex = linesWithTime.findIndex((l) => currentTime >= l.startSec && currentTime < l.endSec);

  useEffect(() => {
    if (activeIndex >= 0 && transcriptRefs.current[activeIndex]) {
      transcriptRefs.current[activeIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIndex]);

  const onTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (el) setCurrentTime(el.currentTime);
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { router.replace('/login'); return; }
    auth.me().then(setUser).catch(() => { localStorage.removeItem('token'); router.replace('/login'); }).finally(() => setChecking(false));
  }, [router, setUser]);

  useEffect(() => {
    if (!checking && callId) {
      calls.get(callId).then(setDetail).catch(() => setDetail(null)).finally(() => setLoading(false));
    }
  }, [checking, callId]);

  if (checking || loading) {
    return <Layout><LoadingScreen message="Loading call details…" /></Layout>;
  }

  if (!detail) {
    return (
      <Layout>
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Call not found</h3>
          <p className="text-gray-500 mt-1 mb-6">This call may have been deleted or doesn&apos;t exist</p>
          <Link href="/calls" className="btn-secondary inline-flex items-center gap-2">
            ← Back to Call History
          </Link>
        </div>
      </Layout>
    );
  }

  const kpis = KPI_LIST.map(({ key, label, icon }) => ({
    key, label, icon,
    value: (detail as Record<string, unknown>)[key] as number | null,
  })).filter((k) => k.value != null);

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumb + header */}
        <div>
          <Link href="/calls" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Call History
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="page-title">Call Review</h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-gray-500 text-sm">
                  {new Date(detail.created_at).toLocaleString()}
                </p>
                {detail.duration_seconds != null && (
                  <span className="badge-neutral">
                    {Math.floor(detail.duration_seconds / 60)}m {detail.duration_seconds % 60}s
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Score + KPIs row */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Overall score card */}
          <div className="card flex flex-col items-center py-8">
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-4">Overall Score</p>
            {detail.overall_score != null ? (
              <ScoreRing score={detail.overall_score} />
            ) : (
              <div className="text-4xl font-bold text-gray-300">—</div>
            )}
            {detail.closing_attempt != null && (
              <div className="mt-5 pt-4 border-t border-gray-100 w-full text-center">
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Closing Attempt</span>
                <p className={`text-lg font-bold mt-1 ${detail.closing_attempt ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {detail.closing_attempt ? '✓ Yes' : '✗ No'}
                </p>
              </div>
            )}
          </div>

          {/* KPI bars */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Performance Breakdown</h2>
            <div className="space-y-5">
              {kpis.map(({ key, label, icon, value }) => (
                <KpiBar key={key} label={label} icon={icon} value={value!} />
              ))}
            </div>
          </div>
        </div>

        {/* AI Summary */}
        {detail.summary && (
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#FFC107]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#FFC107]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">AI Call Summary</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">{detail.summary}</p>
          </div>
        )}

        {/* Strengths / Weaknesses / Tips */}
        <div className="grid gap-4 sm:grid-cols-3">
          {detail.strengths && (
            <div className="card border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">✅</span>
                <h3 className="font-semibold text-emerald-800">Strengths</h3>
              </div>
              <ul className="text-sm text-gray-700 space-y-2">
                {detail.strengths.split('\n').filter(Boolean).map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {detail.weaknesses && (
            <div className="card border-l-4 border-l-amber-500">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">⚠️</span>
                <h3 className="font-semibold text-amber-800">Areas to Improve</h3>
              </div>
              <ul className="text-sm text-gray-700 space-y-2">
                {detail.weaknesses.split('\n').filter(Boolean).map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {detail.improvement_tips && (
            <div className="card border-l-4 border-l-[#FFC107]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💡</span>
                <h3 className="font-semibold text-[#F57F17]">Improvement Tips</h3>
              </div>
              <ul className="text-sm text-gray-700 space-y-2">
                {detail.improvement_tips.split('\n').filter(Boolean).map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFC107] mt-1.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Recording + Transcript */}
        <div className="card-flat">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Recording & Transcript</h2>
                <p className="text-xs text-gray-500">Play the recording — the transcript highlights as audio plays</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {detail.recording_url && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <audio
                  ref={audioRef}
                  controls
                  src={detail.recording_url}
                  className="flex-1 h-10"
                  onTimeUpdate={onTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              </div>
            )}
            {linesWithTime.length > 0 && (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {linesWithTime.map((line, i) => {
                  const isActive = activeIndex === i;
                  const isAdvisor = line.speaker === 'advisor';
                  return (
                    <div
                      key={i}
                      ref={(el) => { transcriptRefs.current[i] = el; }}
                      className={`p-4 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-[#FFC107]/15 border border-[#FFC107]/40 shadow-sm'
                          : isAdvisor
                          ? 'bg-amber-50/60 border border-amber-100'
                          : 'bg-gray-50 border border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-2 h-2 rounded-full ${isAdvisor ? 'bg-[#FFC107]' : 'bg-gray-400'}`} />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          {line.speaker}
                        </span>
                        {isActive && isPlaying && (
                          <span className="flex gap-0.5 ml-1">
                            {[0, 1, 2].map((j) => (
                              <span key={j} className="w-1 bg-[#FFC107] rounded-full" style={{ height: `${8 + j * 4}px`, animation: 'loading-pulse 0.6s ease-in-out infinite', animationDelay: `${j * 0.1}s` }} />
                            ))}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm leading-relaxed ${isActive ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                        {line.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
