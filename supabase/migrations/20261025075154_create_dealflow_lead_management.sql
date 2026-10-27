/*
# Create DealFlow owner-scoped lead management tables

1. New Tables
- `leads`: private lead records owned by the signed-in user, including seller contact details, property information, pipeline stage, estimated deal inputs, assignment, notes, and follow-up dates.
- `lead_activities`: private, appendable activity history linked to a lead.
- `follow_ups`: private calendar and follow-up records linked to an optional lead, with completion tracking.

2. Security
- Row Level Security is enabled on all three tables.
- Access is restricted to authenticated users and scoped through `owner_id = auth.uid()`.
- The owner is filled by the database session and is not accepted as a trusted browser value.
- Grants expose only the CRUD operations needed by the signed-in application.

3. Integrity and automation
- Foreign keys keep activities and follow-ups attached to existing leads owned by the same user.
- Dates and numeric deal inputs have safe defaults and checks where appropriate.
- Completing a follow-up automatically records a completed activity in the lead history.

4. Compatibility
- All objects use IF NOT EXISTS or replace-safe policy handling.
- No existing tables, columns, or records are removed or changed.
*/

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  property_address text NOT NULL DEFAULT '',
  property_type text NOT NULL DEFAULT 'Single Family',
  estimated_arv numeric(14,2),
  estimated_repairs numeric(14,2),
  asking_price numeric(14,2),
  lead_source text NOT NULL DEFAULT 'Website',
  stage text NOT NULL DEFAULT 'New' CHECK (stage IN ('New', 'Contacted', 'Hot', 'Cold', 'Closed')),
  notes text NOT NULL DEFAULT '',
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz,
  next_follow_up_date date,
  closed_profit numeric(14,2) NOT NULL DEFAULT 0 CHECK (closed_profit >= 0)
);

CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'Note',
  note text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'Lead Follow-up' CHECK (event_type IN ('Lead Follow-up', 'Property Appointment', 'Lead Call', 'Meeting', 'Deal Deadline')),
  event_date date NOT NULL,
  start_time time NOT NULL DEFAULT '10:00',
  notes text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_owner_stage_idx ON public.leads(owner_id, stage);
CREATE INDEX IF NOT EXISTS leads_owner_follow_up_idx ON public.leads(owner_id, next_follow_up_date);
CREATE INDEX IF NOT EXISTS leads_owner_activity_idx ON public.leads(owner_id, last_activity_at);
CREATE INDEX IF NOT EXISTS follow_ups_owner_date_idx ON public.follow_ups(owner_id, event_date, completed);
CREATE INDEX IF NOT EXISTS lead_activities_lead_date_idx ON public.lead_activities(lead_id, occurred_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO authenticated;

DROP POLICY IF EXISTS "leads_select_own" ON public.leads;
CREATE POLICY "leads_select_own" ON public.leads FOR SELECT TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "leads_insert_own" ON public.leads;
CREATE POLICY "leads_insert_own" ON public.leads FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "leads_update_own" ON public.leads;
CREATE POLICY "leads_update_own" ON public.leads FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "leads_delete_own" ON public.leads;
CREATE POLICY "leads_delete_own" ON public.leads FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "lead_activities_select_own" ON public.lead_activities;
CREATE POLICY "lead_activities_select_own" ON public.lead_activities FOR SELECT TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "lead_activities_insert_own" ON public.lead_activities;
CREATE POLICY "lead_activities_insert_own" ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_id AND leads.owner_id = auth.uid()));
DROP POLICY IF EXISTS "lead_activities_update_own" ON public.lead_activities;
CREATE POLICY "lead_activities_update_own" ON public.lead_activities FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "lead_activities_delete_own" ON public.lead_activities;
CREATE POLICY "lead_activities_delete_own" ON public.lead_activities FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "follow_ups_select_own" ON public.follow_ups;
CREATE POLICY "follow_ups_select_own" ON public.follow_ups FOR SELECT TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "follow_ups_insert_own" ON public.follow_ups;
CREATE POLICY "follow_ups_insert_own" ON public.follow_ups FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND (lead_id IS NULL OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_id AND leads.owner_id = auth.uid())));
DROP POLICY IF EXISTS "follow_ups_update_own" ON public.follow_ups;
CREATE POLICY "follow_ups_update_own" ON public.follow_ups FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND (lead_id IS NULL OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_id AND leads.owner_id = auth.uid())));
DROP POLICY IF EXISTS "follow_ups_delete_own" ON public.follow_ups;
CREATE POLICY "follow_ups_delete_own" ON public.follow_ups FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_completed_follow_up()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed = true AND OLD.completed = false THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
    IF NEW.lead_id IS NOT NULL THEN
      INSERT INTO public.lead_activities (owner_id, lead_id, activity_type, note, occurred_at)
      VALUES (NEW.owner_id, NEW.lead_id, 'Follow-up completed', NEW.title, NEW.completed_at);
      UPDATE public.leads SET last_activity_at = NEW.completed_at, updated_at = now() WHERE id = NEW.lead_id AND owner_id = NEW.owner_id;
    END IF;
  ELSIF NEW.completed = false THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS follow_ups_completion_activity ON public.follow_ups;
CREATE TRIGGER follow_ups_completion_activity
BEFORE UPDATE OF completed ON public.follow_ups
FOR EACH ROW EXECUTE FUNCTION public.record_completed_follow_up();

REVOKE EXECUTE ON FUNCTION public.record_completed_follow_up() FROM PUBLIC, anon, authenticated;
