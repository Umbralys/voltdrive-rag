# VoltDrive RAG Demo

A production-ready RAG (Retrieval-Augmented Generation) demo for VoltDrive, a fictional EV company. Features a clean chat interface powered by Azure OpenAI and Supabase vector database.

## 🚀 Features

- **Clean Chat Interface**: ChatGPT-style conversation experience
- **Real-time Streaming**: See responses as they're generated
- **Source Citations**: Every answer includes references to source documents with page numbers
- **Vector Search**: Semantic search using Azure OpenAI embeddings + Supabase pgvector
- **Cost-Optimized**: Efficient chunking, caching, and minimal API calls
- **Production-Ready**: Built with Next.js 14 App Router, TypeScript, and Tailwind

## 📋 Prerequisites

- Node.js 18+ installed
- Azure OpenAI resource with:
  - GPT-4 (or GPT-3.5-turbo) deployment
  - text-embedding-3-small deployment
- Supabase account (free tier works great)
- VS Code (recommended)

## 🛠️ Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd voltdrive-rag
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Copy the contents of `supabase-setup.sql` and run it
4. This will:
   - Enable the pgvector extension
   - Create the `document_chunks` table
   - Set up the similarity search function
   - Configure security policies

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your credentials:

```env
# Azure OpenAI - Get from Azure Portal
AZURE_OPENAI_API_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4  # Your chat model deployment name
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Supabase - Get from Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Finding Your Keys:**

**Azure OpenAI:**
- Go to Azure Portal → Your OpenAI resource
- Click "Keys and Endpoint" in the left sidebar
- Copy Key 1 and Endpoint

**Supabase:**
- Go to Project Settings → API
- Copy the Project URL and anon/public key
- Copy the service_role key (keep this secure!)

### 4. Add Your Documents

Create a `documents` folder and add your PDFs:

```bash
mkdir documents
# Copy your PDFs into this folder
# The script expects:
# - troubleshooting_md.pdf
# - warrantypricing_md.pdf
```

Or update the file paths in `scripts/ingest-documents.ts` to match your PDFs.

### 5. Ingest Documents

Run the ingestion script to process PDFs and upload to Supabase:

```bash
npm run ingest
```

This will:
- Parse your PDFs
- Split them into semantic chunks (~500 tokens each)
- Generate embeddings using Azure OpenAI
- Store everything in Supabase

**Note:** This may take 5-10 minutes depending on document size. You'll see progress in the console.

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🚢 Deployment to Vercel

### Quick Deploy

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add all environment variables from `.env.local`
5. Deploy!

### Using Vercel CLI

```bash
npm install -g vercel
vercel
```

**Important:** Make sure to add all environment variables in Vercel's dashboard under Project Settings → Environment Variables.

## 📁 Project Structure

```
voltdrive-rag/
├── app/
│   ├── api/
│   │   └── chat/route.ts          # Streaming chat endpoint
│   ├── page.tsx                    # Main chat page
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Global styles
├── components/
│   ├── ChatInterface.tsx           # Main chat UI
│   ├── MessageList.tsx             # Message rendering
│   └── SourceCitation.tsx          # Source badges
├── lib/
│   ├── azure-openai.ts             # Azure OpenAI client
│   ├── supabase.ts                 # Supabase client
│   └── rag.ts                      # RAG orchestration
├── scripts/
│   └── ingest-documents.ts         # Document processing
├── types/
│   └── index.ts                    # TypeScript definitions
└── documents/                      # Your PDF files (not in git)
```

## 🎯 How It Works

### Document Ingestion (One-time)

1. **Parse PDFs** → Extract text with page numbers
2. **Chunk Text** → Split into ~500 token chunks
3. **Generate Embeddings** → Azure OpenAI creates vector representations
4. **Store in Supabase** → Save chunks with metadata (document, page, etc.)

### Query Flow (Runtime)

1. **User asks question** → "Why won't my VoltDrive start?"
2. **Generate query embedding** → Convert question to vector
3. **Vector similarity search** → Find top 5 most relevant chunks in Supabase
4. **Build context** → Combine retrieved chunks into prompt
5. **Generate response** → Azure OpenAI streams answer with context
6. **Show sources** → Display which documents/pages were used

## 💰 Cost Optimization

- **Embeddings**: ~$0.00002 per 1K tokens (one-time cost during ingestion)
- **Chat**: ~$0.01-0.03 per query (depending on model)
- **Supabase**: Free tier handles 500MB database + 2GB transfer
- **Vercel**: Free tier handles hobby projects

**Estimated costs for demo:**
- Initial ingestion: ~$0.10-0.50 (one-time)
- 100 queries: ~$1-3
- Monthly Supabase: $0 (free tier)
- Monthly Vercel: $0 (free tier)

## 🔧 Customization

### Change Chunk Size

In `scripts/ingest-documents.ts`, adjust:

```typescript
const chunks = chunkText(text, 500);  // Change 500 to your preferred token count
```

### Adjust Retrieval

In `lib/rag.ts`, modify:

```typescript
await searchSimilarDocuments(queryEmbedding, 5, 0.7);
// Parameters: (embedding, topK, similarityThreshold)
```

### Customize UI

All styling uses Tailwind CSS. Colors are defined in:
- `tailwind.config.js` - Theme colors
- `app/globals.css` - CSS variables

## 🐛 Troubleshooting

### "Cannot find module" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Embedding dimension mismatch
Check that your Azure deployment uses text-embedding-3-small (1536 dimensions). If using a different model, update the vector dimension in `supabase-setup.sql`.

### No results from search
- Check that documents were ingested successfully
- Lower the similarity threshold in `lib/rag.ts`
- Verify embeddings are generating correctly

### Supabase connection issues
- Verify your Supabase URL and keys in `.env.local`
- Check that RLS policies are set up correctly
- Ensure the vector extension is enabled

## 📚 Additional Resources

- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Supabase pgvector Guide](https://supabase.com/docs/guides/ai/vector-databases)
- [Next.js App Router Docs](https://nextjs.org/docs/app)

## 🤝 Contributing

This is a demo project, but feel free to:
- Report issues
- Suggest improvements
- Fork and customize for your needs

## 📄 License

MIT License - Use this however you'd like!

---

Built with ⚡ by a developer who knows RAG
