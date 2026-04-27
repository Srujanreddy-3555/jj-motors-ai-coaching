'use client';

import { useState, useEffect } from 'react';
import { practice } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';

const EMOTIONS = [
  { value: 'Happy', label: 'Happy', emoji: '😊' },
  { value: 'Neutral', label: 'Neutral', emoji: '😐' },
  { value: 'Angry', label: 'Angry', emoji: '😠' },
];
const GENDERS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
];
const ACCENTS = [
  { value: 'American English', label: 'American' },
  { value: 'British English', label: 'British' },
  { value: 'African English', label: 'African' },
  { value: 'Australian English', label: 'Australian' },
];

const SERVICE_CATEGORIES = [
  'Brakes & Rotors', 'Engine Repair', 'Oil & Lube', 'Transmission',
  'Tires & Alignment', 'AC & Heating', 'Electrical', 'Body Work',
  'Diagnostics', 'General Maintenance',
];

const SCENARIO_TYPES = [
  { value: 'Vehicle service inquiry', label: 'Service Inquiry', icon: '🔧' },
  { value: 'Repair estimate / quote', label: 'Repair Estimate', icon: '📋' },
  { value: 'Oil change & maintenance', label: 'Oil Change', icon: '🛢️' },
  { value: 'Parts availability & pricing', label: 'Parts & Pricing', icon: '⚙️' },
  { value: 'Complaint or follow-up', label: 'Complaint / Follow-up', icon: '📞' },
  { value: 'Price negotiation', label: 'Price Negotiation', icon: '💰' },
  { value: 'Warranty inquiry', label: 'Warranty Inquiry', icon: '🛡️' },
  { value: 'Pickup scheduling', label: 'Pickup Scheduling', icon: '📅' },
];

const PERSONAS = [
  { id: 'marcus', name: 'Marcus Johnson', title: 'Fleet Manager at TX Logistics', emotion: 'Angry', accent: 'American English', gender: 'Male', scenario: 'Repair estimate / quote', tags: ['Repair Estimate', 'American', 'Angry'], avatarEmoji: '👨🏾', gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)' },
  { id: 'sarah', name: 'Sarah Mitchell', title: 'SUV Owner — Working Mom', emotion: 'Happy', accent: 'American English', gender: 'Female', scenario: 'Oil change & maintenance', tags: ['Oil Change', 'American', 'Happy'], avatarEmoji: '👩🏼', gradient: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #D97706 100%)' },
  { id: 'james', name: 'James Okafor', title: 'First-time Customer — Sedan Owner', emotion: 'Neutral', accent: 'African English', gender: 'Male', scenario: 'Vehicle service inquiry', tags: ['Service Inquiry', 'African', 'Neutral'], avatarEmoji: '👨🏿', gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 50%, #EA580C 100%)' },
  { id: 'linda', name: 'Linda Park', title: 'Sports Car Enthusiast', emotion: 'Neutral', accent: 'British English', gender: 'Female', scenario: 'Parts availability & pricing', tags: ['Parts & Pricing', 'British', 'Neutral'], avatarEmoji: '👩🏻', gradient: 'linear-gradient(135deg, #FDE68A 0%, #FCD34D 50%, #F59E0B 100%)' },
  { id: 'robert', name: 'Robert Davis', title: 'Returning Customer — Pickup Owner', emotion: 'Angry', accent: 'American English', gender: 'Male', scenario: 'Complaint or follow-up', tags: ['Complaint', 'American', 'Angry'], avatarEmoji: '👨🏼', gradient: 'linear-gradient(135deg, #FB923C 0%, #F97316 50%, #EA580C 100%)' },
  { id: 'amara', name: 'Amara Diallo', title: 'Price-Conscious Minivan Owner', emotion: 'Happy', accent: 'African English', gender: 'Female', scenario: 'Price negotiation', tags: ['Negotiation', 'African', 'Happy'], avatarEmoji: '👩🏾', gradient: 'linear-gradient(135deg, #FEF08A 0%, #FDE047 50%, #FACC15 100%)' },
];

type CallRow = { id: string; status: string; overall_score: number | null; created_at: string };

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [selectedCategory, setSelectedCategory] = useState(SERVICE_CATEGORIES[0]);
  const [selectedScenario, setSelectedScenario] = useState(SCENARIO_TYPES[0].value);
  const [selectedEmotion, setSelectedEmotion] = useState(EMOTIONS[0].value);
  const [selectedGender, setSelectedGender] = useState(GENDERS[0].value);
  const [selectedAccent, setSelectedAccent] = useState(ACCENTS[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallRow[]>([]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      import('@/lib/api').then(({ calls }) => {
        calls.list().then((list) => setRecentCalls(list.slice(0, 5))).catch(() => {});
      });
    }
  }, []);

  const handleStartCall = async (cfg: { emotion: string; gender: string; accent: string; scenario: string }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await practice.createSession(cfg);
      router.push(`/call/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start call');
    } finally {
      setLoading(false);
    }
  };

  const startWithPersona = () => {
    handleStartCall({
      emotion: selectedPersona.emotion,
      gender: selectedPersona.gender,
      accent: selectedPersona.accent,
      scenario: selectedPersona.scenario,
    });
  };

  const startWithConfig = () => {
    handleStartCall({
      emotion: selectedEmotion,
      gender: selectedGender,
      accent: selectedAccent,
      scenario: selectedScenario,
    });
  };

  const firstName = user?.full_name?.split(' ')[0] || 'Advisor';

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="animate-fade-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Welcome to J.J.&apos;s AI Coach!
        </h1>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
          {error}
        </div>
      )}

      {/* Main 2-column layout: Persona Card | Quick Start Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 animate-slide-up">

        {/* LEFT: Featured Persona Card */}
        <div className="flex flex-col items-center">
          {/* Big persona card with yellow texture background */}
          <div
            className="persona-hero-card w-full max-w-[420px] rounded-3xl p-8 text-center relative overflow-hidden"
            style={{ background: selectedPersona.gradient }}
          >
            {/* Yellow texture overlay */}
            <div className="absolute inset-0 yellow-texture-bg opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10" />
            <div className="relative z-10">
              {/* Avatar */}
              <div
                className="w-24 h-24 rounded-full bg-white/90 mx-auto mb-4 flex items-center justify-center text-5xl border-4 border-white transition-all duration-300 hover:scale-110 hover:rotate-3"
                style={{ boxShadow: '0 8px 25px rgba(255, 193, 7, 0.35)' }}
              >
                {selectedPersona.avatarEmoji}
              </div>

              {/* Name + title */}
              <h2
                className="text-2xl font-bold text-white"
                style={{ textShadow: '0 2px 8px rgba(255, 193, 7, 0.3), 0 1px 3px rgba(0,0,0,0.15)' }}
              >
                {selectedPersona.name}
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md bg-white/25 text-[11px] font-bold text-white uppercase tracking-wider backdrop-blur-sm" style={{ boxShadow: '0 2px 8px rgba(255, 193, 7, 0.2)' }}>AI</span>
              </h2>
              <p
                className="text-white/85 text-sm mt-1 font-medium"
                style={{ textShadow: '0 1px 4px rgba(255, 193, 7, 0.2)' }}
              >{selectedPersona.title}</p>

              {/* Tags */}
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {selectedPersona.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold border border-white/25 transition-all duration-200 hover:bg-white/30 hover:scale-105 cursor-default"
                    style={{ boxShadow: '0 2px 8px rgba(255, 193, 7, 0.15)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Start button */}
              <button
                onClick={startWithPersona}
                disabled={loading}
                className="mt-6 w-full py-3.5 rounded-2xl bg-white text-gray-900 font-bold text-[15px] transition-all duration-200 active:scale-[0.97] disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-white/95 hover:scale-[1.02]"
                style={{ boxShadow: '0 6px 20px rgba(255, 193, 7, 0.3), 0 2px 6px rgba(0,0,0,0.08)' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 193, 7, 0.45), 0 4px 10px rgba(0,0,0,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 193, 7, 0.3), 0 2px 6px rgba(0,0,0,0.08)'; }}
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full loading-spinner" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                )}
                Start Roleplay with {selectedPersona.name.split(' ')[0]}
              </button>
              <p className="text-white/60 text-xs mt-3" style={{ textShadow: '0 1px 3px rgba(255, 193, 7, 0.15)' }}>Practice your service advisor skills with AI</p>
            </div>
          </div>

          {/* What this customer needs */}
          <div
            className="w-full max-w-[420px] mt-4 rounded-2xl border border-yellow-100 bg-white p-5 transition-all duration-200 hover:translate-y-[-2px]"
            style={{ boxShadow: '0 4px 15px rgba(255, 193, 7, 0.12), 0 1px 3px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 193, 7, 0.2), 0 2px 6px rgba(0,0,0,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 193, 7, 0.12), 0 1px 3px rgba(0,0,0,0.04)'; }}
          >
            <h3 className="font-semibold text-gray-900 text-[15px] mb-2" style={{ textShadow: '0 1px 2px rgba(255, 193, 7, 0.08)' }}>What this customer needs</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              {selectedPersona.name} is a {selectedPersona.emotion.toLowerCase()} customer calling about <strong>{selectedPersona.scenario.toLowerCase()}</strong>.
              They speak with a {selectedPersona.accent.toLowerCase()} accent and will test your ability to handle{' '}
              {selectedPersona.emotion === 'Angry' ? 'frustrated customers, pushback, and complaints' :
               selectedPersona.emotion === 'Happy' ? 'friendly rapport-building and upselling opportunities' :
               'straightforward questions and clear explanations'}.
            </p>
          </div>

          {/* Persona selector row */}
          <div className="w-full mt-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3" style={{ textShadow: '0 1px 2px rgba(255, 193, 7, 0.08)' }}>Choose a Customer Persona</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPersona(p)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 hover:translate-y-[-2px] ${
                    selectedPersona.id === p.id
                      ? 'bg-[#FFC107]/15 border-2 border-[#FFC107]'
                      : 'bg-white border-2 border-gray-100 hover:border-[#FFC107]/40'
                  }`}
                  style={{
                    boxShadow: selectedPersona.id === p.id
                      ? '0 4px 15px rgba(255, 193, 7, 0.25)'
                      : '0 2px 8px rgba(255, 193, 7, 0.08)',
                  }}
                >
                  <span className="text-2xl transition-transform duration-200 hover:scale-110">{p.avatarEmoji}</span>
                  <span className="text-[11px] font-medium text-gray-700 truncate w-full text-center">{p.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Quick Start Config Panel */}
        <div
          className="rounded-2xl border border-yellow-100/80 bg-white p-6 h-fit transition-all duration-200"
          style={{ boxShadow: '0 4px 20px rgba(255, 193, 7, 0.1), 0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2" style={{ textShadow: '0 1px 2px rgba(255, 193, 7, 0.08)' }}>
            Quick Start
            <span className="text-[#FFC107]">+</span>
            <span className="text-gray-600 text-sm font-normal">Build a Custom Roleplay</span>
          </h2>
          <p className="text-gray-500 text-xs mt-1 mb-5">
            Select options below to customize your AI customer, or{' '}
            <button onClick={() => {}} className="text-[#FFC107] font-semibold hover:underline">use a persona</button> from the left.
          </p>

          {/* Service category */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">Service Category</label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 border hover:translate-y-[-1px] ${
                    selectedCategory === cat
                      ? 'bg-[#FFC107]/15 border-[#FFC107] text-gray-900'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-[#FFC107]/40 hover:bg-[#FFC107]/5'
                  }`}
                  style={{ boxShadow: selectedCategory === cat ? '0 3px 10px rgba(255, 193, 7, 0.2)' : '0 1px 3px rgba(255, 193, 7, 0.06)' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Scenario type */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">Scenario Type</label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SCENARIO_TYPES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSelectedScenario(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 border flex items-center gap-1.5 hover:translate-y-[-1px] ${
                    selectedScenario === s.value
                      ? 'bg-[#FFC107]/15 border-[#FFC107] text-gray-900'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-[#FFC107]/40 hover:bg-[#FFC107]/5'
                  }`}
                  style={{ boxShadow: selectedScenario === s.value ? '0 3px 10px rgba(255, 193, 7, 0.2)' : '0 1px 3px rgba(255, 193, 7, 0.06)' }}
                >
                  <span>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Emotion */}
          <div className="mb-5">
            <label className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide block mb-2">Customer Emotion</label>
            <div className="flex gap-1.5">
              {EMOTIONS.map((e) => (
                <button
                  key={e.value}
                  onClick={() => setSelectedEmotion(e.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 border text-center hover:translate-y-[-1px] ${
                    selectedEmotion === e.value
                      ? 'bg-[#FFC107]/15 border-[#FFC107] text-gray-900'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-[#FFC107]/40'
                  }`}
                  style={{ boxShadow: selectedEmotion === e.value ? '0 3px 10px rgba(255, 193, 7, 0.2)' : '0 1px 3px rgba(255, 193, 7, 0.06)' }}
                >
                  {e.emoji} {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Voice & Accent row */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide block mb-2">Voice</label>
              <div className="flex gap-1.5">
                {GENDERS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setSelectedGender(g.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-200 border text-center hover:translate-y-[-1px] ${
                      selectedGender === g.value
                        ? 'bg-[#FFC107]/15 border-[#FFC107] text-gray-900'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-[#FFC107]/40'
                    }`}
                    style={{ boxShadow: selectedGender === g.value ? '0 3px 10px rgba(255, 193, 7, 0.2)' : '0 1px 3px rgba(255, 193, 7, 0.06)' }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide block mb-2">Accent</label>
              <select
                value={selectedAccent}
                onChange={(e) => setSelectedAccent(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-[12px] font-medium border border-gray-200 text-gray-700 bg-white focus:border-[#FFC107] focus:ring-1 focus:ring-[#FFC107]/30 outline-none cursor-pointer transition-all duration-200"
                style={{ boxShadow: '0 1px 3px rgba(255, 193, 7, 0.06)' }}
              >
                {ACCENTS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={startWithConfig}
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-[15px] font-bold text-gray-900 bg-gradient-to-r from-[#FFC107] to-[#FFD54F] hover:from-[#FFB300] hover:to-[#FFC107] transition-all duration-200 active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2 hover:translate-y-[-1px]"
            style={{ boxShadow: '0 6px 20px rgba(255, 193, 7, 0.35), 0 2px 6px rgba(0,0,0,0.06)', textShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-gray-600/30 border-t-gray-800 rounded-full loading-spinner" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            )}
            Start Roleplay with Custom AI
          </button>
        </div>
      </div>
    </div>
  );
}
