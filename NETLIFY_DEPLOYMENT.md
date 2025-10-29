# Netlify Deployment Guide

This guide explains how to deploy the Event Registration System to Netlify.

## Overview

The application is a **hybrid static site** with:
- **Static files** served from the `public/` directory
- **Serverless function** for Supabase configuration (`netlify/functions/config.js`)

## Prerequisites

1. A Netlify account
2. A Supabase project with:
   - Supabase URL
   - Supabase Anon Key
3. Git repository connected to Netlify

## Step 1: Configure Build Settings

In your Netlify site dashboard, go to **Site configuration** → **Build & deploy** → **Build settings**:

```
Base directory: /
Build command: echo 'No build required'
Publish directory: public
Functions directory: netlify/functions
```

These settings are already configured in your `netlify.toml` file (if present) or can be set in the Netlify dashboard.

## Step 2: Set Environment Variables

Go to **Site configuration** → **Environment variables** and add:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Your Supabase anonymous key |

**Important:** These must be set in Netlify's dashboard. The `.env` file is only for local development and is **not** deployed to Netlify.

### How to find your Supabase credentials:

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → Use for `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → Use for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 3: Deploy

### Option A: Deploy via Git

1. Push your code to GitHub/GitLab/Bitbucket
2. Connect your repository to Netlify
3. Netlify will automatically deploy on every push

### Option B: Manual Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

## Step 4: Verify Deployment

After deployment:

1. Open your Netlify site URL (e.g., `https://your-site.netlify.app`)
2. Open browser DevTools → Console
3. You should see: `"Supabase client initialized successfully"`
4. **No errors** about missing configuration

### Troubleshooting

If you see errors like `"Supabase URL is not configured"`:

1. **Check environment variables** in Netlify dashboard
2. Make sure variable names match exactly:
   - `NEXT_PUBLIC_SUPABASE_URL` (not `SUPABASE_URL`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not `SUPABASE_ANON_KEY`)
3. **Redeploy** after adding environment variables (they're injected at build time)
4. Check the **Function logs** in Netlify dashboard → Functions → `config`

## How It Works

### Local Development

When running `npm start`:
- Express server runs on `http://localhost:3000`
- Frontend fetches config from `/api/config` endpoint (server.js)
- Environment variables loaded from `.env` file

### Production (Netlify)

When deployed to Netlify:
- Static files served from `public/` directory
- Frontend fetches config from `/.netlify/functions/config` (serverless function)
- Environment variables loaded from Netlify dashboard settings
- Automatic fallback: tries Netlify Functions first, then `/api/config` (for compatibility)

### Code Flow

1. Browser loads `events.html` or `register.html`
2. Loads `supabase-client.js` which:
   - Tries `/.netlify/functions/config` (for Netlify)
   - Falls back to `/api/config` (for local dev)
3. Initializes Supabase client with fetched credentials
4. App is ready to use

## File Structure

```
.
├── netlify/
│   └── functions/
│       └── config.js           # Serverless function for Supabase config
├── public/                     # Static files (published to Netlify)
│   ├── index.html
│   ├── events.html
│   ├── register.html
│   ├── login.html
│   ├── supabase-client.js     # Fetches config from function
│   ├── auth.js
│   ├── events.js
│   └── ...
├── server.js                   # Express server (local dev only)
├── .env                        # Local environment variables (NOT deployed)
└── NETLIFY_DEPLOYMENT.md       # This file
```

## Security Notes

- **Never commit** `.env` file to version control
- The `.env` file should be in `.gitignore`
- Supabase anon key is **safe to expose** in the frontend (it's public)
- Row Level Security (RLS) in Supabase protects your data
- All sensitive operations should be protected by Supabase RLS policies

## Support

If you encounter issues:

1. Check Netlify **Function logs** for errors
2. Check browser **Console** for JavaScript errors
3. Verify environment variables are set correctly
4. Try a fresh deployment (clear cache and redeploy)
