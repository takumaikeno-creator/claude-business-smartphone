import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';
import type { Env } from '../index';

const ApplySchema = z.object({
  message: z.string().min(10).max(1000),
  proposed_price: z.number().int().positive(),
});

export const applicationsRouter = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

applicationsRouter.use('*', authMiddleware);

// 応募する
applicationsRouter.post('/jobs/:jobId/apply', zValidator('json', ApplySchema), async (c) => {
  const userId = c.get('userId');
  const jobId = c.req.param('jobId');
  const { message, proposed_price } = c.req.valid('json');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  // 案件が存在し、自分の案件でないことを確認
  const { data: job } = await supabase
    .from('jobs')
    .select('client_id, status')
    .eq('id', jobId)
    .single();

  if (!job) return c.json({ error: 'Job not found' }, 404);
  if (job.status !== 'open') return c.json({ error: 'Job is not open' }, 400);
  if (job.client_id === userId) return c.json({ error: 'Cannot apply to own job' }, 400);

  const { data, error } = await supabase
    .from('applications')
    .insert({ job_id: jobId, worker_id: userId, message, proposed_price })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return c.json({ error: 'Already applied' }, 409);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ application: data }, 201);
});

// 応募一覧（クライアントのみ）
applicationsRouter.get('/jobs/:jobId/applications', async (c) => {
  const userId = c.get('userId');
  const jobId = c.req.param('jobId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: job } = await supabase
    .from('jobs')
    .select('client_id')
    .eq('id', jobId)
    .single();

  if (!job || job.client_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { data, error } = await supabase
    .from('applications')
    .select('*, worker:profiles!applications_worker_id_fkey(*)')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ applications: data });
});

// 応募を承認（→契約を自動生成）
applicationsRouter.put('/applications/:id/accept', async (c) => {
  const userId = c.get('userId');
  const applicationId = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: app } = await supabase
    .from('applications')
    .select('*, job:jobs!applications_job_id_fkey(client_id, status)')
    .eq('id', applicationId)
    .single();

  if (!app) return c.json({ error: 'Application not found' }, 404);
  if ((app.job as { client_id: string }).client_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const platformFee = Math.round(app.proposed_price * 0.15);

  // 契約作成
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert({
      job_id: app.job_id,
      worker_id: app.worker_id,
      client_id: userId,
      amount: app.proposed_price,
      platform_fee: platformFee,
    })
    .select()
    .single();

  if (contractError) return c.json({ error: contractError.message }, 500);

  // 応募ステータス更新・案件をin_progressに
  await Promise.all([
    supabase.from('applications').update({ status: 'accepted' }).eq('id', applicationId),
    supabase.from('applications').update({ status: 'rejected' })
      .eq('job_id', app.job_id).neq('id', applicationId),
    supabase.from('jobs').update({ status: 'in_progress' }).eq('id', app.job_id),
  ]);

  return c.json({ contract }, 201);
});

// 応募を却下
applicationsRouter.put('/applications/:id/reject', async (c) => {
  const userId = c.get('userId');
  const applicationId = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: app } = await supabase
    .from('applications')
    .select('job_id')
    .eq('id', applicationId)
    .single();

  if (!app) return c.json({ error: 'Not found' }, 404);

  const { data: job } = await supabase
    .from('jobs')
    .select('client_id')
    .eq('id', app.job_id)
    .single();

  if (!job || job.client_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  await supabase.from('applications').update({ status: 'rejected' }).eq('id', applicationId);
  return c.json({ ok: true });
});
