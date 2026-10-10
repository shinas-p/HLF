/**
 * HLF 2026 — Centralized Site Images & Branding Configuration
 * Manages default local fallback assets and synchronizes with Supabase-managed visual assets.
 */

const DEFAULT_SITE_IMAGES = {
  logo: 'assets/images/logo/hlf-logo.png',
  favicon: 'assets/images/logo/favicon.png',
  officialPoster: 'assets/images/posters/hlf-2026-official-poster.png',
  featuredImage: 'assets/images/posters/hlf-2026-official-poster.png',
  qrCode: ''
};

// Global active site images (initialized with local defaults)
const HLF_SITE_IMAGES = { ...DEFAULT_SITE_IMAGES };

/**
 * Resolve relative asset path depending on whether the caller is root or admin subdirectory
 */
function getAssetPath(key, isSubdir = false) {
  const path = HLF_SITE_IMAGES[key] || DEFAULT_SITE_IMAGES[key] || '';
  if (isSubdir && !path.startsWith('http') && !path.startsWith('/')) {
    return '../' + path;
  }
  return path;
}

/**
 * Fetch dynamic site branding / active poster from Supabase with graceful local fallback
 */
async function loadDynamicSiteImages() {
  try {
    const sb = (typeof window !== 'undefined' && window.getSupabase) ? window.getSupabase() : null;
    if (!sb) return HLF_SITE_IMAGES;

    // 1. Fetch site settings from festival_settings
    const { data: settingsData, error: settingsErr } = await sb
      .from('festival_settings')
      .select('upi_qr_image_url, logo_url, favicon_url, official_poster_url')
      .eq('id', 'general')
      .maybeSingle();

    if (!settingsErr && settingsData) {
      if (settingsData.logo_url && settingsData.logo_url.trim()) {
        HLF_SITE_IMAGES.logo = settingsData.logo_url.trim();
      }
      if (settingsData.favicon_url && settingsData.favicon_url.trim()) {
        HLF_SITE_IMAGES.favicon = settingsData.favicon_url.trim();
      }
      if (settingsData.official_poster_url && settingsData.official_poster_url.trim()) {
        HLF_SITE_IMAGES.officialPoster = settingsData.official_poster_url.trim();
        HLF_SITE_IMAGES.featuredImage = settingsData.official_poster_url.trim();
      }
      if (settingsData.upi_qr_image_url && settingsData.upi_qr_image_url.trim()) {
        HLF_SITE_IMAGES.qrCode = settingsData.upi_qr_image_url.trim();
      }
    }

    // 2. If official poster wasn't in festival_settings, check active poster in posters table
    if (!HLF_SITE_IMAGES.officialPoster || HLF_SITE_IMAGES.officialPoster === DEFAULT_SITE_IMAGES.officialPoster) {
      const { data: posterData, error: posterErr } = await sb
        .from('posters')
        .select('image_url')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!posterErr && posterData?.image_url && posterData.image_url.trim()) {
        HLF_SITE_IMAGES.officialPoster = posterData.image_url.trim();
        HLF_SITE_IMAGES.featuredImage = posterData.image_url.trim();
      }
    }

    // 3. Check for featured image in gallery_items table
    const { data: featData, error: featErr } = await sb
      .from('gallery_items')
      .select('image_url')
      .eq('featured', true)
      .eq('published', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!featErr && featData?.image_url && featData.image_url.trim()) {
      HLF_SITE_IMAGES.featuredImage = featData.image_url.trim();
    }

  } catch (err) {
    console.warn('Could not load dynamic site images from Supabase, using local defaults:', err);
  }

  return HLF_SITE_IMAGES;
}

if (typeof window !== 'undefined') {
  window.DEFAULT_SITE_IMAGES = DEFAULT_SITE_IMAGES;
  window.HLF_SITE_IMAGES = HLF_SITE_IMAGES;
  window.getAssetPath = getAssetPath;
  window.loadDynamicSiteImages = loadDynamicSiteImages;
  try {
    window.loadDynamicSiteImagesPromise = loadDynamicSiteImages();
  } catch (_) {}
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_SITE_IMAGES,
    HLF_SITE_IMAGES,
    getAssetPath,
    loadDynamicSiteImages
  };
}
