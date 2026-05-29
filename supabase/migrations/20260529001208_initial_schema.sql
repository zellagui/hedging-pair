-- Trading Journal Schema Migration
-- Migrates data from localStorage/Blob to Supabase with per-user isolation

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.challenge_status as enum (
  'evaluation',
  'passed',
  'failed',
  'funded',
  'paid_out'
);

create type public.trade_direction as enum (
  'long',
  'short'
);

create type public.pair_status as enum (
  'open',
  'profitable',
  'loss',
  'break-even',
  'invalid'
);

create type public.plan_status as enum (
  'planned',
  'open',
  'closed'
);

create type public.round_mode as enum (
  'up',
  'nearest'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Identities (Workspaces/Trader profiles)
create table public.identities (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  note text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- Journal Sessions (Daily trading sessions)
create table public.journal_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  notes text not null default '',
  closed boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- Challenges (Prop-firm evaluations and funded accounts)
create table public.challenges (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_id uuid not null references public.identities(id) on delete cascade,
  name text not null default '',
  fee numeric not null default 0,
  balance numeric not null default 0,
  current_profit_target numeric not null default 0,
  max_drawdown numeric not null default 0,
  daily_loss_cap numeric not null default 0,
  status public.challenge_status not null default 'evaluation',
  note text not null default '',
  payout_amount numeric,
  payout_at timestamptz,
  disbursement_at timestamptz,
  ledger_phases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- Trades (Individual trade legs - prop or personal)
create table public.trades (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_id uuid not null references public.identities(id) on delete cascade,
  challenge_id uuid references public.challenges(id) on delete cascade,
  session_id uuid references public.journal_sessions(id) on delete set null,
  symbol text not null,
  direction public.trade_direction not null,
  size numeric not null,
  entry_price numeric not null,
  exit_price numeric,
  direct_pnl numeric,
  current_price numeric,
  stop_loss numeric,
  take_profit numeric,
  fees numeric not null default 0,
  notes text not null default '',
  screenshot text,
  planned_pnl numeric,
  actual_pnl numeric,
  planned_tp_points numeric,
  planned_sl_points numeric,
  hedge_plan_id text,
  performance_variance numeric,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- Hedge Pairs (Links prop + personal trade legs)
create table public.hedge_pairs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  phase_number integer not null,
  prop_trade_id uuid not null references public.trades(id) on delete cascade,
  personal_trade_id uuid not null references public.trades(id) on delete cascade,
  combined_pnl numeric not null default 0,
  status public.pair_status not null default 'open',
  manually_set_status boolean not null default false,
  plan_id uuid,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(prop_trade_id),
  unique(personal_trade_id)
);

-- Phase Plans (Pre-planned hedge strategies)
create table public.phase_plans (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  phase_number integer not null,
  prop_tp_usd numeric not null,
  prop_sl_usd numeric not null,
  prop_contracts numeric not null,
  personal_target_profit numeric not null,
  personal_point_value numeric not null,
  buffer numeric not null,
  buffer_prop_sl numeric not null,
  buffer_prop_tp numeric not null,
  buffer_personal_tp numeric not null,
  buffer_personal_sl numeric not null,
  lot_step numeric not null,
  min_lot numeric not null,
  round_mode public.round_mode not null,
  expected_payout numeric not null,
  prop_symbol text not null,
  personal_symbol text not null,
  personal_entry_price numeric,
  hedge_pair_id uuid references public.hedge_pairs(id) on delete set null,
  status public.plan_status not null default 'planned',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- User Journal Settings (Active workspace selection)
create table public.user_journal_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_identity_id uuid references public.identities(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- User-scoped queries (most important for RLS performance)
create index identities_user_id_idx on public.identities(user_id);
create index challenges_user_id_idx on public.challenges(user_id);
create index challenges_identity_id_idx on public.challenges(identity_id);
create index trades_user_id_idx on public.trades(user_id);
create index trades_identity_id_idx on public.trades(identity_id);
create index trades_challenge_id_idx on public.trades(challenge_id);
create index trades_session_id_idx on public.trades(session_id);
create index hedge_pairs_user_id_idx on public.hedge_pairs(user_id);
create index hedge_pairs_prop_trade_id_idx on public.hedge_pairs(prop_trade_id);
create index hedge_pairs_personal_trade_id_idx on public.hedge_pairs(personal_trade_id);
create index phase_plans_user_id_idx on public.phase_plans(user_id);
create index phase_plans_challenge_id_idx on public.phase_plans(challenge_id);
create index journal_sessions_user_id_idx on public.journal_sessions(user_id);

-- Temporal queries
create index trades_created_at_idx on public.trades(created_at desc);
create index challenges_created_at_idx on public.challenges(created_at desc);
create index journal_sessions_date_idx on public.journal_sessions(date desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
alter table public.identities enable row level security;
alter table public.challenges enable row level security;
alter table public.trades enable row level security;
alter table public.hedge_pairs enable row level security;
alter table public.phase_plans enable row level security;
alter table public.journal_sessions enable row level security;
alter table public.user_journal_settings enable row level security;

-- Identities: Users can only access their own workspaces
create policy "users_own_identities"
  on public.identities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Challenges: Users can only access their own challenges
create policy "users_own_challenges"
  on public.challenges
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trades: Users can only access their own trades
create policy "users_own_trades"
  on public.trades
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Hedge Pairs: Users can only access their own pairs
create policy "users_own_hedge_pairs"
  on public.hedge_pairs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Phase Plans: Users can only access their own plans
create policy "users_own_phase_plans"
  on public.phase_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Journal Sessions: Users can only access their own sessions
create policy "users_own_sessions"
  on public.journal_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- User Settings: Users can only access their own settings
create policy "users_own_settings"
  on public.user_journal_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for auto-updating updated_at
create trigger update_identities_updated_at
  before update on public.identities
  for each row
  execute function public.update_updated_at_column();

create trigger update_challenges_updated_at
  before update on public.challenges
  for each row
  execute function public.update_updated_at_column();

create trigger update_trades_updated_at
  before update on public.trades
  for each row
  execute function public.update_updated_at_column();

create trigger update_hedge_pairs_updated_at
  before update on public.hedge_pairs
  for each row
  execute function public.update_updated_at_column();

create trigger update_phase_plans_updated_at
  before update on public.phase_plans
  for each row
  execute function public.update_updated_at_column();

create trigger update_journal_sessions_updated_at
  before update on public.journal_sessions
  for each row
  execute function public.update_updated_at_column();

create trigger update_user_journal_settings_updated_at
  before update on public.user_journal_settings
  for each row
  execute function public.update_updated_at_column();
