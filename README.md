# HLF 2026 — Hadith Literature Festival

Official website, delegate registration system, and administrative console for the Hadith Literature Festival 2026, hosted by the Department of Hadith and Related Sciences at Darul Huda Islamic University (DHIU), Chemmad, Kerala (18–20 October 2026).

## Directory Structure

```
HLF WEBSITE/
│
├── admin/
│   └── index.html               # Administrative management dashboard
│
├── assets/
│   ├── images/
│   │   ├── logo/                # Official HLF logo & favicon
│   │   ├── posters/             # Official promotional & keynote posters
│   │   ├── gallery/             # Festival photo gallery images
│   │   ├── events/              # Event session visuals
│   │   └── general/             # General banners & decorative media
│   │
│   ├── icons/                   # Local icons
│   └── fonts/                   # Local font assets
│
├── css/
│   └── registration.css         # Styling for delegate registration & UI modals
│
├── js/
│   ├── registration.js          # In-website registration & payment logic
│   ├── admin.js                 # Admin dashboard logic, verifications & exports
│   ├── supabase-config.js       # Supabase client initialization & festival settings
│   └── site-images.js           # Centralized site images & dynamic branding loader
│
├── index.html                   # Main landing page
├── serve.js                     # Local static development server
├── package.json                 # Project configuration
├── package-lock.json
├── .env.example                 # Environment variables configuration template
└── README.md
```

## Running Locally

To run the local development server:

```bash
node serve.js
```

Or using npm:

```bash
npm start
```

The website will be served at `http://localhost:3300/`.
- **Main Website**: `http://localhost:3300/`
- **Delegate Registration Modal**: `http://localhost:3300/#register`
- **Admin Dashboard**: `http://localhost:3300/admin/`
