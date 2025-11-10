# 🚀 Quick Start Guide

Get VoltDrive RAG running in 10 minutes.

## Step 1: Install Dependencies (2 min)

```bash
cd voltdrive-rag
npm install
```

## Step 2: Set Up Supabase (3 min)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy `supabase-setup.sql` → Supabase SQL Editor → Run
3. Get your credentials:
   - Project Settings → API → Copy URL and keys

## Step 3: Configure Environment (2 min)

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
AZURE_OPENAI_API_KEY=sk-...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small

NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Step 4: Ingest Documents (2 min)

```bash
npm run ingest
```

Wait for "✅ Document ingestion complete!"

## Step 5: Run! (1 min)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🎉 Done!

Try asking:
- "Why won't my VoltDrive start?"
- "What's covered under warranty?"
- "How do I improve my range?"

## Deploy to Vercel

```bash
# Push to GitHub first
git init
git add .
git commit -m "Initial commit"
git push

# Then deploy
vercel
```

Remember to add environment variables in Vercel dashboard!

---

**Having issues?** Check SETUP_CHECKLIST.md for detailed troubleshooting.
