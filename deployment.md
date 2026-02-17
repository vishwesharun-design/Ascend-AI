# Deployment Guide

This application is ready for deployment on **Vercel** (recommended) or **Netlify**.

## Option 1: Vercel Deployment (Recommended)

1.  **Push to GitHub**: Ensure your code is pushed to a GitHub repository.
2.  **Import to Vercel**:
    *   Go to [Vercel Dashboard](https://vercel.com/dashboard).
    *   Click **Add New...** > **Project**.
    *   Import your GitHub repository.
3.  **Configure Project**:
    *   **Framework Preset**: Select `Vite`.
    *   **Root Directory**: Leave as `./` (default).
    *   **Build Command**: `npm run build` (default).
    *   **Output Directory**: `dist` (default).
    *   **Install Command**: `npm install` (default).
4.  **Add Environment Variables**:
    *   Expand the **Environment Variables** section.
    *   Add the following key-value pair:
        *   **Key**: `GEMINI_API_KEY`
        *   **Value**: *[Paste your AIzaSy... key here]*
5.  **Deploy**: Click **Deploy**.

**Why Vercel?**
*   Vercel automatically detects the `api/` directory and deploys it as Serverless Functions, meaning your backend logic just works without extra setup!

---

## Option 2: Netlify Deployment

1.  **Push to GitHub**.
2.  **Import to Netlify**.
3.  **Configure Build**:
    *   **Build command**: `npm run build`
    *   **Publish directory**: `dist`
4.  **Environment Variables**:
    *   Go to **Site settings** > **Build & deploy** > **Environment**.
    *   Add `GEMINI_API_KEY`.
5.  **Note**: Netlify requires extra configuration (a `netlify.toml` file) to handle the serverless functions in the `api/` folder correctly. Vercel is easier for this specific project structure.
