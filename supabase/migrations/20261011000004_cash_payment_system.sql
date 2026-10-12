-- Migration: 20261011000004_cash_payment_system.sql
-- Description: Cash payment method, audit trail table, and secure admin RPC for HLF 2026 Delegate Registration

-- 1. Add cash payment and payment method tracking columns to public.registrations
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'upi',
ADD COLUMN IF NOT EXISTS cash_received_by text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cash_received_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cash_amount numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cash_receipt_no text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cash_notes text DEFAULT NULL;

-- 2. Audit Trail Table for Cash Payments
CREATE TABLE IF NOT EXISTS public.registration_cash_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id text NOT NULL REFERENCES public.registrations(registration_id) ON DELETE CASCADE,
    amount numeric NOT NULL DEFAULT 50,
    received_by_email text NOT NULL,
    received_by_user_id uuid,
    receipt_no text,
    notes text,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookups by registration_id
CREATE INDEX IF NOT EXISTS idx_reg_cash_payments_reg_id 
ON public.registration_cash_payments (registration_id);

-- 3. Row Level Security for Audit Trail
ALTER TABLE public.registration_cash_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'registration_cash_payments' 
        AND policyname = 'Admins can manage cash payments'
    ) THEN
        CREATE POLICY "Admins can manage cash payments" 
        ON public.registration_cash_payments 
        FOR ALL 
        TO authenticated 
        USING (public.is_admin()) 
        WITH CHECK (public.is_admin());
    END IF;
END $$;

-- 4. Delegate RPC: Select Cash Payment Option (sets method to 'cash' without verifying)
CREATE OR REPLACE FUNCTION public.confirm_registration_cash(
    p_registration_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_row public.registrations%ROWTYPE;
BEGIN
    IF p_registration_id IS NULL OR trim(p_registration_id) = '' THEN
        RAISE EXCEPTION 'Registration ID is required';
    END IF;

    SELECT * INTO v_row
    FROM public.registrations
    WHERE registration_id = trim(p_registration_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration with ID % not found', p_registration_id;
    END IF;

    -- If already verified or confirmed, do not revert to pending
    IF v_row.payment_status = 'verified' THEN
        RETURN jsonb_build_object(
            'success', true,
            'registration_id', v_row.registration_id,
            'full_name', v_row.full_name,
            'institution', v_row.institution,
            'mobile', v_row.mobile,
            'payment_method', v_row.payment_method,
            'payment_status', v_row.payment_status,
            'registration_status', v_row.registration_status,
            'created_at', to_char(v_row.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
        );
    END IF;

    UPDATE public.registrations
    SET payment_method = 'cash',
        payment_status = 'pending',
        registration_status = 'submitted',
        updated_at = now()
    WHERE registration_id = trim(p_registration_id)
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
        'success', true,
        'registration_id', v_row.registration_id,
        'full_name', v_row.full_name,
        'institution', v_row.institution,
        'mobile', v_row.mobile,
        'payment_method', v_row.payment_method,
        'registration_fee', v_row.registration_fee,
        'payment_status', v_row.payment_status,
        'registration_status', v_row.registration_status,
        'created_at', to_char(v_row.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_registration_cash(text) TO anon, authenticated, service_role;

-- 5. Update confirm_registration_screenshot to explicitly ensure payment_method = 'upi'
CREATE OR REPLACE FUNCTION public.confirm_registration_screenshot(
    p_registration_id text,
    p_payment_screenshot_path text,
    p_payment_screenshot_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_row public.registrations%ROWTYPE;
BEGIN
    IF p_registration_id IS NULL OR trim(p_registration_id) = '' THEN
        RAISE EXCEPTION 'Registration ID is required';
    END IF;
    IF p_payment_screenshot_path IS NULL OR trim(p_payment_screenshot_path) = '' THEN
        RAISE EXCEPTION 'Payment screenshot is required';
    END IF;

    SELECT * INTO v_row
    FROM public.registrations
    WHERE registration_id = trim(p_registration_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration with ID % not found', p_registration_id;
    END IF;

    UPDATE public.registrations
    SET payment_method = 'upi',
        payment_screenshot_path = trim(p_payment_screenshot_path),
        payment_screenshot_url = trim(p_payment_screenshot_url),
        payment_status = 'pending',
        registration_status = 'submitted',
        updated_at = now()
    WHERE registration_id = trim(p_registration_id)
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
        'success', true,
        'registration_id', v_row.registration_id,
        'full_name', v_row.full_name,
        'institution', v_row.institution,
        'mobile', v_row.mobile,
        'payment_method', v_row.payment_method,
        'payment_screenshot_path', v_row.payment_screenshot_path,
        'payment_screenshot_url', v_row.payment_screenshot_url,
        'registration_fee', v_row.registration_fee,
        'payment_status', v_row.payment_status,
        'registration_status', v_row.registration_status,
        'created_at', to_char(v_row.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_registration_screenshot(text, text, text) TO anon, authenticated, service_role;

-- 6. Secure Admin-Only RPC: Record Cash Payment with Audit Trail
CREATE OR REPLACE FUNCTION public.record_cash_payment(
    p_registration_id text,
    p_amount numeric DEFAULT 50,
    p_notes text DEFAULT NULL,
    p_receipt_no text DEFAULT NULL,
    p_received_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_admin_email text;
    v_admin_user_id uuid;
    v_reg public.registrations%ROWTYPE;
    v_cash_id uuid;
    v_effective_received_at timestamptz;
BEGIN
    -- 1. Enforce server-side authenticated admin authorization
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required: You must be signed in as an admin to record cash payments';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only festival admins can record cash payments';
    END IF;

    -- Resolve authenticated admin identity
    v_admin_user_id := auth.uid();
    SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_user_id;
    IF v_admin_email IS NULL THEN
        SELECT email INTO v_admin_email FROM public.admin_users WHERE id = v_admin_user_id;
    END IF;
    IF v_admin_email IS NULL THEN
        v_admin_email := 'admin@hlf2026';
    END IF;

    -- 2. Input validation
    IF p_registration_id IS NULL OR trim(p_registration_id) = '' THEN
        RAISE EXCEPTION 'Registration ID is required';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid cash amount. Registration fee is ₹50';
    END IF;

    -- 3. Fetch registration
    SELECT * INTO v_reg
    FROM public.registrations
    WHERE registration_id = trim(p_registration_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration % not found', p_registration_id;
    END IF;

    -- Prevent duplicate recording if already verified
    IF v_reg.payment_status = 'verified' THEN
        RAISE EXCEPTION 'Payment for % has already been verified', p_registration_id;
    END IF;

    v_effective_received_at := coalesce(p_received_at, now());

    -- 4. Insert into immutable audit trail
    INSERT INTO public.registration_cash_payments (
        registration_id,
        amount,
        received_by_email,
        received_by_user_id,
        receipt_no,
        notes,
        recorded_at,
        created_at
    ) VALUES (
        v_reg.registration_id,
        p_amount,
        v_admin_email,
        v_admin_user_id,
        nullif(trim(p_receipt_no), ''),
        nullif(trim(p_notes), ''),
        v_effective_received_at,
        now()
    ) RETURNING id INTO v_cash_id;

    -- 5. Update registration record with cash audit fields
    UPDATE public.registrations
    SET payment_method = 'cash',
        payment_status = 'verified',
        registration_status = 'confirmed',
        cash_received_by = v_admin_email,
        cash_received_at = v_effective_received_at,
        cash_amount = p_amount,
        cash_receipt_no = nullif(trim(p_receipt_no), ''),
        cash_notes = nullif(trim(p_notes), ''),
        updated_at = now()
    WHERE registration_id = v_reg.registration_id
    RETURNING * INTO v_reg;

    RETURN jsonb_build_object(
        'success', true,
        'cash_payment_id', v_cash_id,
        'registration_id', v_reg.registration_id,
        'full_name', v_reg.full_name,
        'amount', p_amount,
        'received_by', v_admin_email,
        'received_at', to_char(v_effective_received_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
        'payment_status', v_reg.payment_status,
        'registration_status', v_reg.registration_status
    );
END;
$$;

-- Grant permissions: only authenticated users & service role can invoke
GRANT EXECUTE ON FUNCTION public.record_cash_payment(text, numeric, text, text, timestamptz) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.record_cash_payment(text, numeric, text, text, timestamptz) FROM anon;
