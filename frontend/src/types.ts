export type PageName = 'landing' | 'dashboard' | 'auth' | 'docs';
export type ThemeMode = 'dark' | 'light' | 'system';

export interface Plan {
  id: number;
  tier: number;
  slug: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  token_limit: number;
  api_calls_limit: number;
  max_team_members: number;
  is_popular: boolean;
  features: string[];
}

export interface SubscriptionInfo {
  plan_slug: string;
  plan_name: string;
  tier: number;
  billing_cycle: 'monthly' | 'yearly';
  status: string;
  tokens_used: number;
  token_limit: number;
  expires_at: string;
}

export interface TransactionItem {
  tx_code: string;
  plan_name: string;
  amount: number;
  payment_method: string;
  status: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  maskedKey: string;
  createdAt: string;
  spentRub: number;
  tokensUsed: number;
  tokenLimit: number | null;
  lastUsed: string;
  status: string;
}

export interface UserInfo {
  id: number;
  email: string;
  full_name: string;
  role?: 'admin' | 'user';
}

export interface SiteConfig {
  brandName: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
  stat3Value: string;
  stat3Label: string;
  stat4Value: string;
  stat4Label: string;
  supportEmail: string;
}

export interface AdminUserItem {
  id: number;
  email: string;
  full_name: string;
  role: string;
  plan_name: string;
  transactions_count: number;
  keys_count: number;
}
