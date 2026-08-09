-- Run once against a fresh database. POST /auth/register picks the cheapest
-- active plan automatically when the caller doesn't specify one, so at least
-- one row here is required before self-service signup will work.

INSERT INTO subscription_plans (name, price_cents, billing_cycle, max_students, features, is_active) VALUES
  ('Free Trial', 0,    'monthly', 100,  jsonb_build_object('attendance', true, 'fees', true, 'results', true, 'announcements', true), TRUE),
  ('Standard',   4900, 'monthly', 500,  jsonb_build_object('attendance', true, 'fees', true, 'results', true, 'announcements', true), TRUE),
  ('Pro',        9900, 'monthly', NULL, jsonb_build_object('attendance', true, 'fees', true, 'results', true, 'announcements', true), TRUE);
