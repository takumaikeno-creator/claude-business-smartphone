import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { jobsRouter } from './routes/jobs';
import { applicationsRouter } from './routes/applications';
import { contractsRouter } from './routes/contracts';
import { aiRouter } from './routes/ai';
import { paymentsRouter } from './routes/payments';

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PAYPAY_API_KEY: string;
  PAYPAY_API_SECRET: string;
  PAYPAY_MERCHANT_ID: string;
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Env }>();

// ── グローバルミドルウェア ──
app.use('*', logger());
app.use('*', secureHeaders());
app.use('/api/*', cors({
  origin: ['https://sumagig.vercel.app', 'http://localhost:3000'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// ── ヘルスチェック ──
app.get('/', (c) => c.json({ status: 'ok', service: 'SumaGig API', version: '0.1.0' }));
app.get('/health', (c) => c.json({ status: 'healthy', ts: new Date().toISOString() }));

// ── ルーター ──
app.route('/api/v1/jobs', jobsRouter);
app.route('/api/v1', applicationsRouter);          // /jobs/:id/apply など
app.route('/api/v1/contracts', contractsRouter);
app.route('/api/v1/ai', aiRouter);
app.route('/api/v1/payments', paymentsRouter);

// ── Cloudflare Workers Cron Trigger ──
const scheduled: ExportedHandlerScheduledHandler<Env> = async (_event, env, _ctx) => {
  const res = await app.request(
    'http://localhost/api/v1/payments/cron/auto-complete',
    { method: 'POST' },
    env
  );
  console.log('[cron] auto-complete:', await res.json());
};

export default {
  fetch: app.fetch,
  scheduled,
};
