-- Migration: 20261013000002_seat_availability_system.sql
-- Description: Limited seat progress tracking, aggregate seat availability RPC, and server-side capacity protection for HLF 2026

-- 1. Add configurable seat fields to public.festival_settings
ALTER TABLE public.festival_settings
ADD COLUMN IF NOT EXISTS total_programme_seats integer NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS baseline_booked_seats integer NOT NULL DEFAULT 10;

-- Ensure general settings row has the confirmed initial values
UPDATE public.festival_settings
SET total_programme_seats = 30,
    baseline_booked_seats = 10
WHERE id = 'general';

-- 2. Secure Public RPC: Get Aggregate Seat Availability (Zero Private Participant Data Exposed)
CREATE OR REPLACE FUNCTION public.get_seat_availability()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total integer := 30;
    v_baseline integer := 10;
    v_confirmed_count integer := 0;
    v_booked integer;
    v_remaining integer;
    v_pct numeric;
    v_is_full boolean;
BEGIN
    -- 1. Fetch configurable totals from festival_settings
    SELECT 
        coalesce(total_programme_seats, 30),
        coalesce(baseline_booked_seats, 10)
    INTO v_total, v_baseline
    FROM public.festival_settings
    WHERE id = 'general';

    IF v_total IS NULL OR v_total <= 0 THEN
        v_total := 30;
    END IF;
    IF v_baseline IS NULL OR v_baseline < 0 THEN
        v_baseline := 10;
    END IF;

    -- 2. Count genuinely confirmed delegate bookings
    -- Rule: Must have payment_status = 'verified' and NOT be cancelled/rejected
    SELECT count(*) INTO v_confirmed_count
    FROM public.registrations
    WHERE payment_status = 'verified'
      AND coalesce(registration_status, 'confirmed') NOT IN ('cancelled', 'rejected');

    -- 3. Calculate metrics
    v_booked := v_baseline + v_confirmed_count;
    IF v_booked > v_total THEN
        v_booked := v_total;
    END IF;

    v_remaining := greatest(0, v_total - v_booked);
    v_pct := round((v_booked::numeric / v_total::numeric) * 100);
    v_is_full := (v_booked >= v_total);

    RETURN jsonb_build_object(
        'success', true,
        'total_seats', v_total,
        'confirmed_online_count', v_confirmed_count,
        'baseline_booked_seats', v_baseline,
        'booked_seats', v_booked,
        'remaining_seats', v_remaining,
        'booking_progress', v_pct,
        'is_full', v_is_full
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_seat_availability() TO anon, authenticated, service_role;

-- 3. Update initiate_registration to enforce safe server-side capacity protection
CREATE OR REPLACE FUNCTION public.initiate_registration(
    p_full_name text,
    p_mobile text,
    p_institution text,
    p_email text DEFAULT NULL,
    p_course text DEFAULT NULL,
    p_department text DEFAULT NULL,
    p_district text DEFAULT NULL,
    p_special_requirements text DEFAULT NULL,
    p_accommodation_required boolean DEFAULT false,
    p_food_required boolean DEFAULT false
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
        50,
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
        'registration_fee', 50,
        'payment_status', 'pending',
        'registration_status', 'submitted',
        'created_at', to_char(v_created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.initiate_registration(text, text, text, text, text, text, text, boolean, boolean, text) TO anon, authenticated, service_role;

-- 4. RPC to update programme seat settings (Total capacity & Baseline booked)
CREATE OR REPLACE FUNCTION public.set_programme_seat_settings(
    p_total_seats integer,
    p_baseline_booked_seats integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.festival_settings
    SET total_programme_seats = coalesce(p_total_seats, 30),
        baseline_booked_seats = coalesce(p_baseline_booked_seats, 10),
        updated_at = now()
    WHERE id = 'general';

    RETURN jsonb_build_object(
        'success', true,
        'total_programme_seats', p_total_seats,
        'baseline_booked_seats', p_baseline_booked_seats
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_programme_seat_settings(integer, integer) TO anon, authenticated, service_role;
