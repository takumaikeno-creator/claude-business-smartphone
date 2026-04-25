import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { authMiddleware } from '../middleware/auth';
import type { Env } from '../index';

export const contractsRouter = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

contractsRouter.use('*', authMiddleware);

// 契約一覧（自分が当事者）
contractsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('contracts')
    .select(`
      id, amount, platform_fee, status, created_at, delivered_at, completed_at,
      job:jobs(title, category),
      worker:profiles!contracts_worker_id_fkey(display_name, avatar_url),
      client:profiles!contracts_client_id_fkey(display_name, avatar_url)
    `)
    .or(`worker_id.eq.${userId},client_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ contracts: data });
});

// 契約詳細
contractsRouter.get('/:id', async (c) => {
  const userId = c.get('userId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', c.req.param('id'))
    .or(`worker_id.eq.${userId},client_id.eq.${userId}`)
    .single();

  if (error || !data) return c.json({ error: 'Not found' }, 404);
  return c.json({ contract: data });
});

// 決済セッション作成（クライアントが支払い）
contractsRouter.post('/:id/checkout', async (c) => {
  const userId = c.get('userId');
  const contractId = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .eq('client_id', userId)
    .single();

  if (!contract) return c.json({ error: 'Not found' }, 404);
  if (contract.stripe_payment_intent_id) {
    return c.json({ error: 'Already paid' }, 400);
  }

  // エスクロー用 PaymentIntent（capture_method: manual でエスクロー保持）
  const paymentIntent = await stripe.paymentIntents.create({
    amount: contract.amount + contract.platform_fee,
    currency: 'jpy',
    capture_method: 'manual',
    metadata: { contract_id: contractId, worker_id: contract.worker_id },
    description: `SumaGig contract ${contractId}`,
  });

  await supabase
    .from('contracts')
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq('id', contractId);

  return c.json({
    client_secret: paymentIntent.client_secret,
    payment_intent_id: paymentIntent.id,
  });
});

// 納品通知（ワーカー）
contractsRouter.post('/:id/deliver', async (c) => {
  const userId = c.get('userId');
  const contractId = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: contract } = await supabase
    .from('contracts')
    .select('worker_id, status')
    .eq('id', contractId)
    .single();

  if (!contract || contract.worker_id !== userId) return c.json({ error: 'Forbidden' }, 403);
  if (contract.status !== 'active') return c.json({ error: `Cannot deliver in status: ${contract.status}` }, 400);

  const { error } = await supabase
    .from('contracts')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', contractId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// 完了承認（クライアント）→ Stripeキャプチャ → ワーカーに送金
contractsRouter.post('/:id/complete', async (c) => {
  const userId = c.get('userId');
  const contractId = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .eq('client_id', userId)
    .single();

  if (!contract) return c.json({ error: 'Forbidden' }, 403);
  if (contract.status !== 'delivered') return c.json({ error: 'Not delivered yet' }, 400);

  // Stripe PaymentIntent をキャプチャ（エスクロー解放）
  if (contract.stripe_payment_intent_id) {
    await stripe.paymentIntents.capture(contract.stripe_payment_intent_id, {
      amount_to_capture: contract.amount + contract.platform_fee,
    });
  }

  const { error } = await supabase
    .from('contracts')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', contractId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// 異議申し立て
contractsRouter.post('/:id/dispute', async (c) => {
  const userId = c.get('userId');
  const contractId = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: contract } = await supabase
    .from('contracts')
    .select('worker_id, client_id, status')
    .eq('id', contractId)
    .single();

  if (!contract) return c.json({ error: 'Not found' }, 404);
  if (contract.worker_id !== userId && contract.client_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  if (!['active', 'delivered'].includes(contract.status)) {
    return c.json({ error: 'Cannot dispute in current status' }, 400);
  }

  await supabase.from('contracts').update({ status: 'disputed' }).eq('id', contractId);
  return c.json({ ok: true });
});
