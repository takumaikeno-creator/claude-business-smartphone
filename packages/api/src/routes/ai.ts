import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';
import type { Env } from '../index';

// プロンプトキャッシュで繰り返し使うシステムプロンプトのコストを70%削減
const SYSTEM_PROMPT = `あなたはSumaGigのAI副業アシスタントです。
SumaGigはスマートフォンで完結するマイクロジョブプラットフォームで、
ワーカーがスキマ時間に副収入を得られるよう支援しています。

あなたの役割:
- ワーカーが案件を獲得するための具体的かつ実践的なアドバイスを提供する
- 日本語で、スマートフォンで読みやすい短い文章で回答する
- 過度に丁寧すぎず、友人のように話しかける口調を意識する
- 金額や数字は具体的に示す`;

const ProposalSchema = z.object({
  job_title: z.string(),
  job_description: z.string(),
  job_category: z.string(),
  budget_min: z.number(),
  budget_max: z.number(),
});

const ProfileSchema = z.object({
  bio: z.string().max(500),
  skills: z.array(z.string()),
});

const PriceAdviceSchema = z.object({
  category: z.string(),
  job_description: z.string(),
  my_experience_level: z.enum(['beginner', 'intermediate', 'expert']),
});

const InsightSchema = z.object({
  completed_jobs: z.number(),
  total_earned: z.number(),
  top_categories: z.array(z.string()),
  avg_rating: z.number(),
});

export const aiRouter = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

aiRouter.use('*', authMiddleware);

// プレミアムチェックミドルウェア
aiRouter.use('*', async (c, next) => {
  const userId = c.get('userId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', userId)
    .single();

  if (!profile?.is_premium) {
    return c.json({ error: 'Premium subscription required', upgrade_url: '/premium' }, 403);
  }
  await next();
});

// 応募文自動生成
aiRouter.post('/proposal', zValidator('json', ProposalSchema), async (c) => {
  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const { job_title, job_description, job_category, budget_min, budget_max } = c.req.valid('json');
  const userId = c.get('userId');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, bio, skills')
    .eq('id', userId)
    .single();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }, // キャッシュ対象
      },
    ],
    messages: [
      {
        role: 'user',
        content: `以下の案件への応募文を200字以内で作成してください。

【案件情報】
タイトル: ${job_title}
カテゴリ: ${job_category}
予算: ¥${budget_min.toLocaleString()}〜¥${budget_max.toLocaleString()}
詳細: ${job_description}

【私のプロフィール】
名前: ${profile?.display_name ?? ''}
スキル: ${profile?.skills?.join(', ') ?? ''}
自己紹介: ${profile?.bio ?? ''}

ポイント:
- 最初の2文で自己紹介と実績に触れる
- なぜこの案件に適しているか具体的に
- 提案金額は予算内で最も高い額を提示
- スマホで読みやすい改行を入れる`,
      },
    ],
  });

  const proposal = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return c.json({ proposal, usage: response.usage });
});

// プロフィール最適化提案
aiRouter.post('/profile', zValidator('json', ProfileSchema), async (c) => {
  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const { bio, skills } = c.req.valid('json');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `以下のプロフィールを改善してください。

現在の自己紹介: ${bio}
スキル: ${skills.join(', ')}

要求:
1. 改善後の自己紹介（150字以内）
2. 追加すると良いスキルタグ（3つ）
3. 改善ポイントの説明（1〜2文）

JSON形式で返してください:
{"improved_bio": "...", "suggested_skills": ["...", "...", "..."], "advice": "..."}`,
      },
    ],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
  try {
    return c.json(JSON.parse(text));
  } catch {
    return c.json({ raw: text });
  }
});

// 単価交渉アドバイス
aiRouter.post('/price-advice', zValidator('json', PriceAdviceSchema), async (c) => {
  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const { category, job_description, my_experience_level } = c.req.valid('json');

  const levelLabel = { beginner: '初心者', intermediate: '中級', expert: '上級者' }[my_experience_level];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content: `以下の案件の適正単価を教えてください。

カテゴリ: ${category}
案件内容: ${job_description}
私の経験レベル: ${levelLabel}

以下の形式で回答:
1. 推奨単価帯（円）
2. 根拠（1文）
3. 交渉する場合の一言（コピペで使える文）`,
      },
    ],
  });

  const advice = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return c.json({ advice });
});

// 月次インサイト生成
aiRouter.post('/insight', zValidator('json', InsightSchema), async (c) => {
  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const { completed_jobs, total_earned, top_categories, avg_rating } = c.req.valid('json');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content: `今月のワーカーの実績を分析して、来月に向けたアドバイスを3点ください。

実績:
- 完了案件数: ${completed_jobs}件
- 総収入: ¥${total_earned.toLocaleString()}
- 得意カテゴリ: ${top_categories.join(', ')}
- 平均評価: ${avg_rating.toFixed(1)}

箇条書きで3つ、各1〜2文で簡潔に。`,
      },
    ],
  });

  const insight = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return c.json({ insight });
});
