export type JobCategory = 'content' | 'design' | 'research' | 'translation' | 'ai';
export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type ContractStatus = 'active' | 'delivered' | 'completed' | 'disputed';
export type UserRole = 'worker' | 'client' | 'both';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          role: UserRole;
          bio: string | null;
          skills: string[];
          rating: number;
          review_count: number;
          is_premium: boolean;
          premium_until: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'rating' | 'review_count' | 'is_premium' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      jobs: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          description: string;
          category: JobCategory;
          budget_min: number;
          budget_max: number;
          deadline: string | null;
          status: JobStatus;
          is_featured: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['jobs']['Row'], 'id' | 'status' | 'is_featured' | 'created_at'>;
        Update: Partial<Pick<Database['public']['Tables']['jobs']['Row'], 'title' | 'description' | 'budget_min' | 'budget_max' | 'deadline' | 'status'>>;
      };
      applications: {
        Row: {
          id: string;
          job_id: string;
          worker_id: string;
          message: string;
          proposed_price: number;
          status: ApplicationStatus;
          created_at: string;
        };
        Insert: Pick<Database['public']['Tables']['applications']['Row'], 'job_id' | 'worker_id' | 'message' | 'proposed_price'>;
        Update: Pick<Database['public']['Tables']['applications']['Row'], 'status'>;
      };
      contracts: {
        Row: {
          id: string;
          job_id: string;
          worker_id: string;
          client_id: string;
          amount: number;
          platform_fee: number;
          status: ContractStatus;
          stripe_payment_intent_id: string | null;
          delivered_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
      };
      messages: {
        Row: {
          id: string;
          contract_id: string;
          sender_id: string;
          content: string | null;
          file_url: string | null;
          file_type: string | null;
          created_at: string;
        };
        Insert: Pick<Database['public']['Tables']['messages']['Row'], 'contract_id' | 'sender_id' | 'content' | 'file_url' | 'file_type'>;
        Update: never;
      };
    };
  };
}

// ── View models (UI用に整形済みの型) ──
export interface JobListItem {
  id: string;
  title: string;
  category: JobCategory;
  budget_min: number;
  budget_max: number;
  deadline: string | null;
  is_featured: boolean;
  created_at: string;
  client: Pick<Database['public']['Tables']['profiles']['Row'], 'display_name' | 'avatar_url' | 'rating'>;
}

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  content: 'コンテンツ制作',
  design: '画像・動画編集',
  research: 'データ・リサーチ',
  translation: '翻訳・文字起こし',
  ai: 'AI代行',
};

export const CATEGORY_ICONS: Record<JobCategory, string> = {
  content: '✍️',
  design: '🎨',
  research: '🔍',
  translation: '🌐',
  ai: '🤖',
};
