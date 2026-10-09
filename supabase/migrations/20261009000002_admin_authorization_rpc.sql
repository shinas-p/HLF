-- HLF 2026 — Admin Authorization RPC & RBAC Migration
-- Fixes RPC schema cache error: public.add_admin_user(p_email)

-- 1. Drop foreign key constraint on admin_users so pre-authorizing colleague emails is supported
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_id_fkey;

-- 2. Ensure case-insensitive unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_lower_idx ON public.admin_users (lower(email));

-- 3. Upgrade is_admin() to support checking by id OR email
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE id = auth.uid() 
           OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    );
END;
$$;

-- 4. Upgrade RLS on public.admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin users" ON public.admin_users;
CREATE POLICY "Admins can view admin users" ON public.admin_users
    FOR SELECT TO authenticated
    USING (
        is_admin() 
        OR id = auth.uid() 
        OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    );

-- 5. Trigger on auth.users to sync admin_users.id when a pre-authorized admin signs up
CREATE OR REPLACE FUNCTION public.handle_admin_auth_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    UPDATE public.admin_users
    SET id = NEW.id
    WHERE lower(email) = lower(NEW.email) AND id != NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_sync_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_sync_admin
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_admin_auth_sync();

-- 6. Implement public.add_admin_user(p_email, p_role)
CREATE OR REPLACE FUNCTION public.add_admin_user(
    p_email text,
    p_role text DEFAULT 'admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_clean_email text;
    v_clean_role text;
    v_existing_auth_id uuid;
    v_new_id uuid;
    v_caller_role text;
BEGIN
    -- 1. Check authentication
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to authorize administrators';
    END IF;

    -- 2. Verify caller is an authorized super_admin
    SELECT role INTO v_caller_role
    FROM public.admin_users
    WHERE id = auth.uid() 
       OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    LIMIT 1;

    IF v_caller_role IS NULL OR v_caller_role != 'super_admin' THEN
        RAISE EXCEPTION 'Access denied: Only a super administrator can authorize new administrators';
    END IF;

    -- 3. Validate input email
    IF p_email IS NULL OR trim(p_email) = '' THEN
        RAISE EXCEPTION 'Email address is required';
    END IF;

    v_clean_email := lower(trim(p_email));

    IF v_clean_email !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid email address format: %', p_email;
    END IF;

    -- 4. Validate role
    v_clean_role := lower(trim(coalesce(p_role, 'admin')));
    IF v_clean_role NOT IN ('admin', 'super_admin') THEN
        v_clean_role := 'admin';
    END IF;

    -- 5. Prevent duplicate authorization
    IF EXISTS (SELECT 1 FROM public.admin_users WHERE lower(email) = v_clean_email) THEN
        RAISE EXCEPTION 'Admin user with email % is already authorized', v_clean_email;
    END IF;

    -- 6. Link to existing auth user if already registered, otherwise generate UUID
    SELECT id INTO v_existing_auth_id
    FROM auth.users
    WHERE lower(email) = v_clean_email
    LIMIT 1;

    IF v_existing_auth_id IS NOT NULL THEN
        v_new_id := v_existing_auth_id;
    ELSE
        v_new_id := gen_random_uuid();
    END IF;

    -- 7. Insert into public.admin_users
    INSERT INTO public.admin_users (id, email, role, created_at)
    VALUES (v_new_id, v_clean_email, v_clean_role, now());

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Admin %s authorized successfully', v_clean_email),
        'email', v_clean_email,
        'role', v_clean_role,
        'id', v_new_id
    );
END;
$$;

-- 7. Permissions: Grant execute to authenticated users (role checked inside function), revoke from anon
REVOKE ALL ON FUNCTION public.add_admin_user(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_admin_user(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_admin_user(text, text) TO authenticated;

-- 8. Signal PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
