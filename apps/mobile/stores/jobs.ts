import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { JobCategory, JobListItem } from '../../../packages/shared/src/types';

interface JobFilters {
  category: JobCategory | null;
  minBudget: number | null;
  maxBudget: number | null;
  featuredOnly: boolean;
}

interface JobsState {
  jobs: JobListItem[];
  filters: JobFilters;
  loading: boolean;
  hasMore: boolean;
  page: number;
  fetchJobs: (reset?: boolean) => Promise<void>;
  setFilter: <K extends keyof JobFilters>(key: K, value: JobFilters[K]) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: JobFilters = {
  category: null,
  minBudget: null,
  maxBudget: null,
  featuredOnly: false,
};

const PAGE_SIZE = 20;

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  filters: DEFAULT_FILTERS,
  loading: false,
  hasMore: true,
  page: 0,

  fetchJobs: async (reset = false) => {
    const { filters, page, loading } = get();
    if (loading) return;

    const currentPage = reset ? 0 : page;
    set({ loading: true });

    let query = supabase
      .from('jobs')
      .select(`
        id, title, category, budget_min, budget_max, deadline, is_featured, created_at,
        client:profiles!jobs_client_id_fkey(display_name, avatar_url, rating)
      `)
      .eq('status', 'open')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (filters.category) query = query.eq('category', filters.category);
    if (filters.minBudget) query = query.gte('budget_max', filters.minBudget);
    if (filters.maxBudget) query = query.lte('budget_min', filters.maxBudget);
    if (filters.featuredOnly) query = query.eq('is_featured', true);

    const { data } = await query;
    const items = (data ?? []) as JobListItem[];

    set((state) => ({
      jobs: reset ? items : [...state.jobs, ...items],
      hasMore: items.length === PAGE_SIZE,
      page: currentPage + 1,
      loading: false,
    }));
  },

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value } }));
    get().fetchJobs(true);
  },

  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS });
    get().fetchJobs(true);
  },
}));
