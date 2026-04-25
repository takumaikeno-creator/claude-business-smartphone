import { supabase } from './supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const json = await res.json() as T & { error?: string };
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  return json;
}

// ── AI アシスタント ──
export const ai = {
  generateProposal: (body: {
    job_title: string;
    job_description: string;
    job_category: string;
    budget_min: number;
    budget_max: number;
  }) => request<{ proposal: string }>('/ai/proposal', { method: 'POST', body: JSON.stringify(body) }),

  optimizeProfile: (body: { bio: string; skills: string[] }) =>
    request<{ improved_bio: string; suggested_skills: string[]; advice: string }>(
      '/ai/profile', { method: 'POST', body: JSON.stringify(body) }
    ),

  getPriceAdvice: (body: {
    category: string;
    job_description: string;
    my_experience_level: 'beginner' | 'intermediate' | 'expert';
  }) => request<{ advice: string }>('/ai/price-advice', { method: 'POST', body: JSON.stringify(body) }),
};

// ── 応募 ──
export const applications = {
  apply: (jobId: string, body: { message: string; proposed_price: number }) =>
    request('/jobs/' + jobId + '/apply', { method: 'POST', body: JSON.stringify(body) }),

  list: (jobId: string) =>
    request<{ applications: unknown[] }>('/jobs/' + jobId + '/applications'),

  accept: (applicationId: string) =>
    request('/applications/' + applicationId + '/accept', { method: 'PUT' }),

  reject: (applicationId: string) =>
    request('/applications/' + applicationId + '/reject', { method: 'PUT' }),
};

// ── 決済 ──
export const payments = {
  subscribe: (plan: 'worker_premium' | 'client_premium' | 'ai_assistant') =>
    request<{ subscription_id: string; client_secret: string | null; trial_end: number | null }>(
      '/payments/subscribe', { method: 'POST', body: JSON.stringify({ plan }) }
    ),

  createCheckout: (contractId: string) =>
    request<{ client_secret: string }>(`/contracts/${contractId}/checkout`, { method: 'POST' }),
};

// ── 契約 ──
export const contracts = {
  deliver: (contractId: string) =>
    request(`/contracts/${contractId}/deliver`, { method: 'POST' }),

  complete: (contractId: string) =>
    request(`/contracts/${contractId}/complete`, { method: 'POST' }),

  dispute: (contractId: string) =>
    request(`/contracts/${contractId}/dispute`, { method: 'POST' }),
};
