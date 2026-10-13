-- Migration: 20261013000001_quiz_competition_system.sql
-- Description: Dedicated Quiz Competition registration table, sequence, RLS policies, and secure RPCs

-- 1. Create sequence for unique quiz registration references
CREATE SEQUENCE IF NOT EXISTS public.hlf_quiz_reg_seq START WITH 1001;

-- 2. Create quiz_registrations table
CREATE TABLE IF NOT EXISTS public.quiz_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_ref text UNIQUE NOT NULL,
    full_name text NOT NULL,
    mobile text NOT NULL,
    email text,
    institution text NOT NULL,
    course text,
    department text,
    district text DEFAULT 'General',
    status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'attended', 'cancelled')),
    team_name text DEFAULT NULL,
    partner_name text DEFAULT NULL,
    partner_mobile text DEFAULT NULL,
    notes text DEFAULT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes for fast search, filter, and unique lookups
CREATE INDEX IF NOT EXISTS idx_quiz_reg_ref ON public.quiz_registrations (quiz_ref);
CREATE INDEX IF NOT EXISTS idx_quiz_reg_mobile ON public.quiz_registrations (mobile);
CREATE INDEX IF NOT EXISTS idx_quiz_reg_status ON public.quiz_registrations (status);
CREATE INDEX IF NOT EXISTS idx_quiz_reg_created ON public.quiz_registrations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_reg_institution ON public.quiz_registrations (institution);

-- 4. Enable Row Level Security
ALTER TABLE public.quiz_registrations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policy: Admins have full access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'quiz_registrations' 
        AND policyname = 'Admins have full access to quiz registrations'
    ) THEN
        CREATE POLICY "Admins have full access to quiz registrations" 
        ON public.quiz_registrations 
        FOR ALL 
        TO authenticated 
        USING (public.is_admin()) 
        WITH CHECK (public.is_admin());
    END IF;
END $$;

-- 6. Public RPC: Secure Quiz Registration Submission
CREATE OR REPLACE FUNCTION public.submit_quiz_registration(
    p_full_name text,
    p_mobile text,
    p_institution text,
    p_email text DEFAULT NULL,
    p_course text DEFAULT NULL,
    p_department text DEFAULT NULL,
    p_district text DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_team_name text DEFAULT NULL,
    p_partner_name text DEFAULT NULL,
    p_partner_mobile text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_clean_mobile text;
    v_existing public.quiz_registrations%ROWTYPE;
    v_quiz_ref text;
    v_id uuid;
    v_created_at timestamptz;
BEGIN
    -- Input Validation
    IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
        RAISE EXCEPTION 'Full name is required (minimum 2 characters)';
    END IF;

    IF p_mobile IS NULL OR length(trim(p_mobile)) < 10 THEN
        RAISE EXCEPTION 'Valid 10-digit mobile number is required';
    END IF;

    IF p_institution IS NULL OR length(trim(p_institution)) < 2 THEN
        RAISE EXCEPTION 'College / Institution is required';
    END IF;

    -- Clean mobile: extract digits
    v_clean_mobile := regexp_replace(trim(p_mobile), '\D', '', 'g');
    IF length(v_clean_mobile) > 10 THEN
        -- If country code prefix like 919876543210, take last 10 digits
        v_clean_mobile := right(v_clean_mobile, 10);
    END IF;

    IF length(v_clean_mobile) < 10 THEN
        RAISE EXCEPTION 'Invalid mobile number format. Please provide a 10-digit mobile number.';
    END IF;

    -- Check for existing registration with same mobile number
    SELECT * INTO v_existing
    FROM public.quiz_registrations
    WHERE right(regexp_replace(mobile, '\D', '', 'g'), 10) = v_clean_mobile
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'is_duplicate', true,
            'id', v_existing.id,
            'quiz_ref', v_existing.quiz_ref,
            'full_name', v_existing.full_name,
            'mobile', v_existing.mobile,
            'institution', v_existing.institution,
            'status', v_existing.status,
            'created_at', to_char(v_existing.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
            'message', 'Participant is already registered with Reference ' || v_existing.quiz_ref
        );
    END IF;

    -- Generate reference number: HLF26-QUIZ-1001
    v_quiz_ref := 'HLF26-QUIZ-' || LPAD(nextval('public.hlf_quiz_reg_seq')::text, 4, '0');
    v_created_at := now();

    -- Insert into quiz_registrations
    INSERT INTO public.quiz_registrations (
        quiz_ref,
        full_name,
        mobile,
        email,
        institution,
        course,
        department,
        district,
        status,
        team_name,
        partner_name,
        partner_mobile,
        notes,
        created_at,
        updated_at
    ) VALUES (
        v_quiz_ref,
        trim(p_full_name),
        trim(p_mobile),
        nullif(trim(p_email), ''),
        trim(p_institution),
        nullif(trim(p_course), ''),
        nullif(trim(p_department), ''),
        coalesce(nullif(trim(p_district), ''), 'General'),
        'registered',
        nullif(trim(p_team_name), ''),
        nullif(trim(p_partner_name), ''),
        nullif(trim(p_partner_mobile), ''),
        nullif(trim(p_notes), ''),
        v_created_at,
        v_created_at
    ) RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', false,
        'id', v_id,
        'quiz_ref', v_quiz_ref,
        'full_name', trim(p_full_name),
        'mobile', trim(p_mobile),
        'institution', trim(p_institution),
        'status', 'registered',
        'created_at', to_char(v_created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
    );
END;
$$;

-- Grant execution to public / anon for submission
GRANT EXECUTE ON FUNCTION public.submit_quiz_registration(text, text, text, text, text, text, text, text, text, text, text) TO anon, authenticated, service_role;

-- 7. Admin RPC: Update Quiz Registration Status
CREATE OR REPLACE FUNCTION public.update_quiz_registration_status(
    p_quiz_id uuid,
    p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_row public.quiz_registrations%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only festival admins can update quiz registration status';
    END IF;

    IF p_status NOT IN ('registered', 'confirmed', 'attended', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status. Must be registered, confirmed, attended, or cancelled';
    END IF;

    UPDATE public.quiz_registrations
    SET status = p_status,
        updated_at = now()
    WHERE id = p_quiz_id
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quiz registration not found';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'id', v_row.id,
        'quiz_ref', v_row.quiz_ref,
        'status', v_row.status,
        'updated_at', to_char(v_row.updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_quiz_registration_status(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_quiz_registration_status(uuid, text) FROM anon;
