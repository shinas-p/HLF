-- HLF 2026 — Master Programme Management System Migration
-- Migration: 20261009000001_master_programme_system.sql
-- Description: Creates programme_days, programme_people, programme_session_participants,
-- extends programme_items, configures RLS and seeds official 3-day programme data.

-- 1. Create programme_days table
CREATE TABLE IF NOT EXISTS public.programme_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number integer NOT NULL UNIQUE,
  date date NOT NULL,
  day_name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Add columns to programme_items if they don't already exist
ALTER TABLE public.programme_items 
  ADD COLUMN IF NOT EXISTS day_id uuid REFERENCES public.programme_days(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_number text,
  ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'Session',
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS participants jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 3. Create programme_people table
CREATE TABLE IF NOT EXISTS public.programme_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  designation text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Create programme_session_participants table
CREATE TABLE IF NOT EXISTS public.programme_session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.programme_items(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.programme_people(id) ON DELETE CASCADE,
  role text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 5. Enable RLS
ALTER TABLE public.programme_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_session_participants ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DROP POLICY IF EXISTS "Public can view programme days" ON public.programme_days;
CREATE POLICY "Public can view programme days" ON public.programme_days
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage programme days" ON public.programme_days;
CREATE POLICY "Admins can manage programme days" ON public.programme_days
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Public can view programme items" ON public.programme_items;
CREATE POLICY "Public can view programme items" ON public.programme_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage programme items" ON public.programme_items;
CREATE POLICY "Admins can manage programme items" ON public.programme_items
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Public can view programme people" ON public.programme_people;
CREATE POLICY "Public can view programme people" ON public.programme_people
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage programme people" ON public.programme_people;
CREATE POLICY "Admins can manage programme people" ON public.programme_people
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Public can view session participants" ON public.programme_session_participants;
CREATE POLICY "Public can view session participants" ON public.programme_session_participants
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage session participants" ON public.programme_session_participants;
CREATE POLICY "Admins can manage session participants" ON public.programme_session_participants
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
