-- USDT TRC-20 walleting tables (idempotent)

CREATE TABLE IF NOT EXISTS public.user_wallets (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  address varchar UNIQUE,
  encrypted_private_key text,
  last_scanned_at timestamp,
  note varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usdt_deposits (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  address varchar NOT NULL,
  txid varchar NOT NULL UNIQUE,
  amount_usdt numeric(20,6) NOT NULL,
  status varchar NOT NULL DEFAULT 'pending', -- pending | confirmed | applied
  applied_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usdt_withdrawals (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  destination_address varchar NOT NULL,
  amount_usdt numeric(20,6) NOT NULL,
  status varchar NOT NULL DEFAULT 'queued', -- queued | locked | processing | completed | failed
  txid varchar,
  fail_reason varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  completed_at timestamp
);

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  action varchar NOT NULL,
  details jsonb,
  created_at timestamp DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_usdt_deposits_user ON public.usdt_deposits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usdt_withdrawals_user ON public.usdt_withdrawals(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- Secure these tables against PostgREST exposure while allowing direct backend
-- connections (which do not set request.jwt.claims) and service_role via REST.
-- -----------------------------------------------------------------------------

-- Enable and force RLS on walleting tables
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.usdt_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usdt_deposits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.usdt_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usdt_withdrawals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions FORCE ROW LEVEL SECURITY;

-- Revoke privileges from REST-exposed roles (defense in depth)
REVOKE ALL ON TABLE public.user_wallets FROM anon, authenticated;
REVOKE ALL ON TABLE public.usdt_deposits FROM anon, authenticated;
REVOKE ALL ON TABLE public.usdt_withdrawals FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_actions FROM anon, authenticated;

-- Helper predicate: allow backend (direct DB) or service_role via PostgREST.
-- For direct DB connections, request.jwt.claims is NULL. For REST with service key,
-- auth.role() = 'service_role'.

-- user_wallets policies
DROP POLICY IF EXISTS allow_backend_or_service ON public.user_wallets;
CREATE POLICY allow_backend_or_service ON public.user_wallets
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true) IS NULL
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true) IS NULL
    OR auth.role() = 'service_role'
  );

-- usdt_deposits policies
DROP POLICY IF EXISTS allow_backend_or_service ON public.usdt_deposits;
CREATE POLICY allow_backend_or_service ON public.usdt_deposits
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true) IS NULL
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true) IS NULL
    OR auth.role() = 'service_role'
  );

-- usdt_withdrawals policies
DROP POLICY IF EXISTS allow_backend_or_service ON public.usdt_withdrawals;
CREATE POLICY allow_backend_or_service ON public.usdt_withdrawals
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true) IS NULL
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true) IS NULL
    OR auth.role() = 'service_role'
  );

-- admin_actions policies
DROP POLICY IF EXISTS allow_backend_or_service ON public.admin_actions;
CREATE POLICY allow_backend_or_service ON public.admin_actions
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true) IS NULL
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true) IS NULL
    OR auth.role() = 'service_role'
  );
