-- Add plan_interval and cancel_at_period_end for billing display
alter table subscriptions add column if not exists plan_interval text default 'monthly';
alter table subscriptions add column if not exists cancel_at_period_end boolean default false;
