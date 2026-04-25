import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';
import type { Env } from '../index';

const JobCreateSchema = z.object({
  title: z.string().min(5).max(60),
  description: z.string().min(20).max(2000),
  category: z.enum(['content', 'design', 'research', 'translation', 'ai']),
  budget_min: z.number().int().positive(),
  budget_max: z.number().int().positive(),
  deadline: z.string().datetime().optional(),
}).refine((d) => d.budget_max >= d.budget_min, {
  message: 'budget_max must be >= budget_min',
  path: ['budget_max'],
});

const JobListQuerySchema = z.object({
  category: z.enum(['content', 'design', 'research', 'translation', 'ai']).optional(),
  min_budget: z.coerce.number().optional(),
  max_budget: z.coerce.number().optional(),
  featured: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const jobsRouter = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// 案件一覧
jobsRouter.get('/', zValidator('query', JobListQuerySchema), async (c) => {
  const { category, min_budget, max_budget, featured, page, limit } = c.req.valid('query');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  let query = supabase
    .from('jobs')
    .select(`
      id, title, category, budget_min, budget_max, deadline, is_featured, created_at,
      client:profiles!jobs_client_id_fkey(display_name, avatar_url, rating)
    `)
    .eq('status', 'open')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (category) query = query.eq('category', category);
  if (min_budget !== undefined) query = query.gte('budget_max', min_budget);
  if (max_budget !== undefined) query = query.lte('budget_min', max_budget);
  if (featured) query = query.eq('is_featured', true);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ jobs: data });
});

// 案件詳細
jobsRouter.get('/:id', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('jobs')
    .select('*, client:profiles!jobs_client_id_fkey(*)')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !data) return c.json({ error: 'Job not found' }, 404);
  return c.json({ job: data });
});

// 案件作成（認証必須）
jobsRouter.post('/', authMiddleware, zValidator('json', JobCreateSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...body, client_id: userId })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ job: data }, 201);
});

// フィーチャード掲載（Stripe決済後に呼ぶ）
jobsRouter.post('/:id/feature', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: job } = await supabase
    .from('jobs')
    .select('client_id')
    .eq('id', c.req.param('id'))
    .single();

  if (!job || job.client_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { error } = await supabase
    .from('jobs')
    .update({ is_featured: true })
    .eq('id', c.req.param('id'));

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});
