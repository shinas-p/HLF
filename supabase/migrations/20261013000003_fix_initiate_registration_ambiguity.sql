-- Migration: 20261013000003_fix_initiate_registration_ambiguity.sql
-- Description: Resolve PostgREST RPC function overloading ambiguity for initiate_registration.
-- Confirmed obsolete conflicting overload:
--   public.initiate_registration_deprecated(p_full_name text, p_mobile text, p_institution text, p_email text, p_course text, p_department text, p_district text, p_special_requirements text, p_accommodation_required boolean, p_food_required boolean)
-- Canonical unambiguous RPC signature:
--   public.initiate_registration(p_full_name text, p_mobile text, p_institution text, p_email text, p_course text, p_department text, p_district text, p_accommodation_required boolean, p_food_required boolean, p_special_requirements text)

-- 1. Ensure any legacy/deprecated function overload permissions are revoked and neutralized
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' 
          AND p.proname = 'initiate_registration_deprecated'
    ) THEN
        REVOKE ALL ON FUNCTION public.initiate_registration_deprecated(text, text, text, text, text, text, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
    END IF;
END $$;

-- 2. Define the single, canonical public.initiate_registration RPC
CREATE OR REPLACE FUNCTION public.initiate_registration(
    p_full_name text,
    p_mobile text,
    p_institution text,
    p_email text DEFAULT NULL,
    p_course text DEFAULT NULL,
    p_department text DEFAULT NULL,
    p_district text DEFAULT NULL,
    p_accommodation_required boolean DEFAULT false,
    p_food_required boolean DEFAULT false,
    p_special_requirements text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reg_id text;
    v_id uuid;
    v_created_at timestamptz;
    v_total_seats integer := 30;
    v_baseline_seats integer := 10;
    v_confirmed_count integer := 0;
BEGIN
    -- Input Validation
    IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
        RAISE EXCEPTION 'Full name is required (minimum 2 characters)';
    END IF;
    IF p_mobile IS NULL OR length(trim(p_mobile)) < 10 THEN
        RAISE EXCEPTION 'Valid mobile number is required (minimum 10 digits)';
    END IF;
    IF p_institution IS NULL OR length(trim(p_institution)) < 2 THEN
        RAISE EXCEPTION 'College / Institution is required';
    END IF;

    -- Capacity Check Protection
    SELECT 
        coalesce(total_programme_seats, 30),
        coalesce(baseline_booked_seats, 10)
    INTO v_total_seats, v_baseline_seats
    FROM public.festival_settings
    WHERE id = 'general';

    IF v_total_seats IS NULL OR v_total_seats <= 0 THEN
        v_total_seats := 30;
    END IF;
    IF v_baseline_seats IS NULL OR v_baseline_seats < 0 THEN
        v_baseline_seats := 10;
    END IF;

    SELECT count(*) INTO v_confirmed_count
    FROM public.registrations
    WHERE payment_status = 'verified'
      AND coalesce(registration_status, 'confirmed') NOT IN ('cancelled', 'rejected');

    IF (v_baseline_seats + v_confirmed_count) >= v_total_seats THEN
        RAISE EXCEPTION 'All seats are booked. Delegate registration is currently full.';
    END IF;

    v_reg_id := 'HLF26-' || LPAD(nextval('hlf_reg_seq')::text, 4, '0');
    v_created_at := now();

    INSERT INTO public.registrations (
        registration_id,
        full_name,
        mobile,
        email,
        institution,
        course,
        department,
        district,
        accommodation_required,
        food_required,
        special_requirements,
        transaction_id,
        registration_fee,
        payment_status,
        registration_status,
        created_at,
        updated_at
    ) VALUES (
        v_reg_id,
        trim(p_full_name),
        trim(p_mobile),
        nullif(trim(p_email), ''),
        trim(p_institution),
        nullif(trim(p_course), ''),
        nullif(trim(p_department), ''),
        coalesce(nullif(trim(p_district), ''), 'General'),
        coalesce(p_accommodation_required, false),
        coalesce(p_food_required, false),
        nullif(trim(p_special_requirements), ''),
        '',
        50.00,
        'pending',
        'submitted',
        v_created_at,
        v_created_at
    ) RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'success', true,
        'id', v_id,
        'registration_id', v_reg_id,
        'full_name', trim(p_full_name),
        'institution', trim(p_institution),
        'mobile', trim(p_mobile),
        'registration_fee', 50.00,
        'payment_status', 'pending',
        'registration_status', 'submitted',
        'created_at', to_char(v_created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
    );
END;
$$;

-- 3. Security grants
GRANT EXECUTE ON FUNCTION public.initiate_registration(text, text, text, text, text, text, text, boolean, boolean, text) TO anon, authenticated, service_role;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
