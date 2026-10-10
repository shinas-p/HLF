-- HLF 2026 — Site Branding Persistence Migration
-- Adds persistent storage columns for logo, favicon, and official festival poster
-- Provides atomic update function for site branding assets

ALTER TABLE public.festival_settings 
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS logo_path text,
ADD COLUMN IF NOT EXISTS favicon_url text,
ADD COLUMN IF NOT EXISTS favicon_path text,
ADD COLUMN IF NOT EXISTS official_poster_url text,
ADD COLUMN IF NOT EXISTS official_poster_path text;

-- Atomic site branding update RPC for authorized administrators
CREATE OR REPLACE FUNCTION public.update_site_branding(
    p_logo_url text DEFAULT NULL,
    p_logo_path text DEFAULT NULL,
    p_favicon_url text DEFAULT NULL,
    p_favicon_path text DEFAULT NULL,
    p_official_poster_url text DEFAULT NULL,
    p_official_poster_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_updated_at timestamptz := now();
    v_result jsonb;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    -- Update festival_settings
    UPDATE public.festival_settings
    SET
        logo_url = COALESCE(p_logo_url, logo_url),
        logo_path = COALESCE(p_logo_path, logo_path),
        favicon_url = COALESCE(p_favicon_url, favicon_url),
        favicon_path = COALESCE(p_favicon_path, favicon_path),
        official_poster_url = COALESCE(p_official_poster_url, official_poster_url),
        official_poster_path = COALESCE(p_official_poster_path, official_poster_path),
        updated_at = v_updated_at
    WHERE id = 'general';

    -- If official poster was provided, synchronize with posters table
    IF p_official_poster_url IS NOT NULL AND p_official_poster_url <> '' THEN
        UPDATE public.posters
        SET is_active = false
        WHERE is_active = true;

        INSERT INTO public.posters (
            title,
            description,
            image_url,
            storage_path,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            'Official HLF 2026 Poster',
            'Primary festival promotional poster',
            p_official_poster_url,
            COALESCE(p_official_poster_path, ''),
            true,
            v_updated_at,
            v_updated_at
        );
    END IF;

    SELECT to_jsonb(f) INTO v_result
    FROM public.festival_settings f
    WHERE id = 'general';

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_site_branding(text, text, text, text, text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_site_branding(text, text, text, text, text, text) FROM anon, public;
