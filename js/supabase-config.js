/**
 * HLF 2026 — Supabase Client & Event Configuration
 * Row Level Security enabled: Only public/anon key is exposed.
 * Service role keys are NEVER exposed to browser code.
 */

const HLF_CONFIG = {
  supabaseUrl: 'https://vivfwblyxcceacbbhfhk.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpdmZ3Ymx5eGNjZWFjYmJoZmhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNzg4NTcsImV4cCI6MjEwNjc1NDg1N30.KkLgybkJLYs1pHjwejiUqUOUt0e-wGYU6TzVLRnTZC4',
  
  // Official HLF Details preserved from existing website
  festival: {
    name: 'HLF 2026 — Hadith Literature Festival',
    dates: '18–20 October 2026',
    venue: 'Darul Huda Islamic University, Chemmad, Kerala',
    dept: 'Department of Hadith and Related Sciences',
    email: 'hadithliteraturefestival@gmail.com',
    phones: ['+91 73065 54055', '+91 77367 27873'],
    instagram: 'https://www.instagram.com/hadith_literature_festival/',
    instagramHandle: '@hadith_literature_festival',
    registrationFee: 50
  },

  // UPI Payment Config (configurable via admin / DB)
  payment: {
    fee: 50,
    upiId: 'hlf2026@dhiu', // Can be updated via Admin Dashboard
    payeeName: 'Hadith Literature Festival DHIU',
    note: 'HLF 2026 Registration',
    qrImagePath: 'assets/hlf-upi-qr.png' // Configurable path for official QR code image
  }
};

// Initialize Supabase Client
let _supabaseClient = null;

function getSupabase() {
  if (_supabaseClient) return _supabaseClient;
  if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    _supabaseClient = window.supabase.createClient(HLF_CONFIG.supabaseUrl, HLF_CONFIG.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    window.hlfSupabase = _supabaseClient;
    return _supabaseClient;
  }
  console.warn('Supabase JS SDK not yet loaded.');
  return null;
}

if (typeof window !== 'undefined') {
  window.HLF_CONFIG = HLF_CONFIG;
  window.getSupabase = getSupabase;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HLF_CONFIG, getSupabase };
}
