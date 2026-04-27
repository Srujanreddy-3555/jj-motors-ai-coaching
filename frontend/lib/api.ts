const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || String(err) || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const auth = {
  login: (email: string, password: string) =>
    api<{ access_token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  signup: (email: string, password: string, full_name: string) =>
    api<{ id: string; email: string; full_name: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
    }),
  me: () =>
    api<{ id: string; email: string; full_name: string; phone_number?: string | null }>('/api/auth/me'),
};

export const users = {
  updateMe: (body: { phone_number?: string | null }) =>
    api<{ id: string; email: string; full_name: string; phone_number?: string | null }>(
      '/api/users/me',
      { method: 'PATCH', body: JSON.stringify(body) }
    ),
};

export const practice = {
  getOptions: () =>
    api<{ emotions: string[]; genders: string[]; accents: string[]; scenarios: string[] }>(
      '/api/practice/options'
    ),
  createSession: (body: { emotion: string; gender: string; accent: string; scenario: string }) =>
    api<{
      id: string;
      phone_number: string;
      short_code: string;
      emotion: string;
      gender: string;
      accent: string;
      scenario: string;
      expires_at: string;
      status?: string; // "calling" when we're calling the advisor (outbound)
    }>('/api/practice/session', { method: 'POST', body: JSON.stringify(body) }),
};

export type AnalyticsData = {
  total_calls: number;
  avg_score: number;
  avg_duration_seconds: number;
  kpi_averages: {
    confidence: number;
    clarity: number;
    objection_handling: number;
    empathy: number;
    product_knowledge: number;
  };
  closing_rate: number;
  score_history: Array<{
    id: string;
    date: string | null;
    overall_score: number | null;
    confidence: number | null;
    clarity: number | null;
    objection_handling: number | null;
    empathy: number | null;
    product_knowledge: number | null;
  }>;
};

export type CoachingData = {
  has_data: boolean;
  tips: Array<{ kpi: string; score: number; tip: string }>;
  focus_areas: string[];
  strongest: Array<{ kpi: string; avg: number }>;
  weakest: Array<{ kpi: string; avg: number }>;
  recent_scores: Array<{ id: string; date: string | null; score: number | null }>;
};

export const calls = {
  list: () =>
    api<Array<{ id: string; status: string; duration_seconds: number | null; overall_score: number | null; created_at: string }>>(
      '/api/calls'
    ),
  analytics: () => api<AnalyticsData>('/api/calls/analytics'),
  coaching: () => api<CoachingData>('/api/calls/coaching'),
  get: (callId: string) =>
    api<{
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
    }>(`/api/calls/${callId}`),
};
