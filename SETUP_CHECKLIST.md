# VoltDrive RAG Setup Checklist

Use this checklist to ensure everything is configured correctly.

## ✅ Pre-Setup

- [ ] Node.js 18+ installed
- [ ] Azure OpenAI resource created
- [ ] Supabase account created
- [ ] VS Code installed (recommended)

## ✅ Azure OpenAI Setup

- [ ] Created GPT-4 (or GPT-3.5-turbo) deployment
  - Deployment name: _______________
- [ ] Created text-embedding-3-small deployment
  - Deployment name: _______________
- [ ] Copied API Key
- [ ] Copied Endpoint URL

## ✅ Supabase Setup

- [ ] Created new Supabase project
- [ ] Ran `supabase-setup.sql` in SQL Editor
- [ ] Verified `document_chunks` table exists
- [ ] Verified `match_documents` function exists
- [ ] Copied Project URL
- [ ] Copied anon/public key
- [ ] Copied service_role key

## ✅ Local Setup

- [ ] Cloned/downloaded project
- [ ] Ran `npm install`
- [ ] Created `.env.local` from `.env.example`
- [ ] Added all environment variables
- [ ] Verified PDFs are in `/documents` folder
- [ ] Updated file paths in `ingest-documents.ts` if needed

## ✅ Document Ingestion

- [ ] Ran `npm run ingest`
- [ ] Saw success messages in console
- [ ] Checked Supabase dashboard to verify data

## ✅ Testing

- [ ] Ran `npm run dev`
- [ ] Opened http://localhost:3000
- [ ] Sent test message
- [ ] Received response with sources
- [ ] Verified citations show correct documents/pages

## ✅ Deployment

- [ ] Pushed code to GitHub
- [ ] Created Vercel project
- [ ] Added all environment variables to Vercel
- [ ] Deployed successfully
- [ ] Tested production deployment

## 🐛 Troubleshooting Checklist

If something doesn't work, check:

- [ ] All environment variables are set correctly
- [ ] No typos in deployment names
- [ ] Supabase SQL script ran without errors
- [ ] Vector extension is enabled in Supabase
- [ ] Azure OpenAI deployments are active
- [ ] API keys have proper permissions
- [ ] Documents were ingested successfully
- [ ] Browser console shows no errors

## 📞 Need Help?

Common issues:

**"Module not found"**
→ Run `npm install` again

**"Invalid API key"**
→ Double-check your Azure OpenAI credentials

**"No matches found"**
→ Verify documents were ingested (`npm run ingest`)

**"Embedding dimension mismatch"**
→ Ensure you're using text-embedding-3-small (1536 dimensions)

**"Supabase connection failed"**
→ Verify Supabase URL and keys in .env.local
