import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';
import type { Env } from '../index';

const SubscribeSchema = z.object({
  plan: z.enum(['worker_premium', 'client_premium', 'ai_assistant']),
});

const PLAN_PRICES: Record<string, { amount: number; label: string }> = {
  worker_premium:  { amount: 1480, label: 'プレミアムワーカー' },
  client_premium:  { amount: 2980, label: 'プレミアムクライアント' },
  ai_assistant:    { amount: 980,  label: 'AI副業アシスタント' },
};

export const paymentsRouter = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// サブスクリプション開始（14日無料トライアル）
paymentsRouter.post('/subscribe', authMiddleware, zValidator('json', SubscribeSchema), async (c) => {
  const userId = c.get('userId');
  const { plan } = c.req.valid('json');
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', userId)
    .single();

  if (profile?.is_premium) {
    return c.json({ error: 'Already subscribed' }, 400);
  }

  const planConfig = PLAN_PRICES[plan];
  if (!planConfig) return c.json({ error: 'Invalid plan' }, 400);

  // Stripe 顧客作成 or 取得
  const { data: customers } = await stripe.customers.search({
    query: `metadata['supabase_uid']:'${userId}'`,
    limit: 1,
  });
  let customer = customers[0];
  if (!customer) {
    customer = await stripe.customers.create({
      metadata: { supabase_uid: userId },
    });
  }

  // サブスクリプション（14日トライアル付き）
  const price = await stripe.prices.create({
    unit_amount: planConfig.amount,
    currency: 'jpy',
    recurring: { interval: 'month' },
    product_data: { name: `SumaGig ${planConfig.label}` },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    trial_period_days: 14,
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
    metadata: { supabase_uid: userId, plan },
  });

  return c.json({
    subscription_id: subscription.id,
    client_secret:
      (subscription.latest_invoice as Stripe.Invoice & { payment_intent: Stripe.PaymentIntent })
        ?.payment_intent?.client_secret ?? null,
    trial_end: subscription.trial_end,
  });
});

// Stripe Webhook（サブスクリプション有効化・失効管理）
paymentsRouter.post('/webhook', async (c) => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const body = await c.req.text();
  const sig = c.req.header('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const supabaseUid = (event.data.object as { metadata?: { supabase_uid?: string } })
    ?.metadata?.supabase_uid;

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const isActive = ['active', 'trialing'].includes(sub.status);
      if (supabaseUid) {
        await supabase.from('profiles').update({
          is_premium: isActive,
          premium_until: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        }).eq('id', supabaseUid);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      if (supabaseUid) {
        await supabase.from('profiles')
          .update({ is_premium: false, premium_until: null })
          .eq('id', supabaseUid);
      }
      break;
    }
    // 契約完了時 → ワーカーへの送金はここでキューに積む（本番はStripe Connect推奨）
    case 'payment_intent.amount_capturable_updated': {
      break;
    }
  }

  return c.json({ received: true });
});

// 7日間放置の自動承認バッチ（Cron Trigger から呼ぶ）
paymentsRouter.post('/cron/auto-complete', async (c) => {
  // Cronトリガーからのみ呼べる（Cloudflare Workers の scheduled event）
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: stale } = await supabase
    .from('contracts')
    .select('id, stripe_payment_intent_id, amount, platform_fee')
    .eq('status', 'delivered')
    .lt('delivered_at', sevenDaysAgo);

  if (!stale?.length) return c.json({ processed: 0 });

  let processed = 0;
  for (const contract of stale) {
    try {
      if (contract.stripe_payment_intent_id) {
        await stripe.paymentIntents.capture(contract.stripe_payment_intent_id);
      }
      await supabase.from('contracts').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', contract.id);
      processed++;
    } catch {
      // ログに記録して次へ
    }
  }

  return c.json({ processed });
});
