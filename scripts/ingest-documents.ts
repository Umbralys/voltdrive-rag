import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import { generateEmbedding } from '../lib/azure-openai';
import { insertDocumentChunks, clearAllDocuments } from '../lib/supabase';



interface DocumentChunk {
  content: string;
  embedding: number[];
  metadata: {
    document: string;
    page: number;
    section?: string;
    chunk_index: number;
  };
}

/**
 * Split text into chunks of approximately maxTokens
 */
function chunkText(text: string, maxTokens: number = 500): string[] {
  // Rough estimation: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  const chunks: string[] = [];
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Process a PDF file and extract text with page numbers
 */
async function processPDF(filePath: string): Promise<{ page: number; text: string }[]> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  // Extract text from each page
  const pages: { page: number; text: string }[] = [];
  
  // pdf-parse doesn't give us per-page text easily, so we'll work with the full text
  // and split it into reasonable chunks
  const fullText = data.text;
  
  // For demo purposes, we'll estimate pages based on text length
  // In production, you'd want a library that gives you per-page text
  const estimatedCharsPerPage = 2000;
  const textLength = fullText.length;
  const estimatedPages = Math.ceil(textLength / estimatedCharsPerPage);
  
  for (let i = 0; i < estimatedPages; i++) {
    const start = i * estimatedCharsPerPage;
    const end = Math.min((i + 1) * estimatedCharsPerPage, textLength);
    const pageText = fullText.slice(start, end);
    
    if (pageText.trim()) {
      pages.push({
        page: i + 1,
        text: pageText,
      });
    }
  }
  
  return pages;
}

/**
 * Ingest documents into the vector database
 */
async function ingestDocuments() {
  console.log('🚀 Starting document ingestion...\n');

  // Documents to process
  const documents = [
    {
      name: 'VoltDrive Troubleshooting Guide',
      path: path.join(process.cwd(), 'documents', 'troubleshooting_md.pdf'),
    },
    {
      name: 'VoltDrive Warranty & Pricing',
      path: path.join(process.cwd(), 'documents', 'warrantypricing_md.pdf'),
    },
  ];

  // Clear existing documents
  console.log('🗑️  Clearing existing documents...');
  await clearAllDocuments();
  console.log('✅ Cleared\n');

  const allChunks: DocumentChunk[] = [];

  // Process each document
  for (const doc of documents) {
    console.log(`📄 Processing: ${doc.name}`);
    
    if (!fs.existsSync(doc.path)) {
      console.error(`❌ File not found: ${doc.path}`);
      continue;
    }

    // Extract text from PDF
    const pages = await processPDF(doc.path);
    console.log(`   Found ${pages.length} pages`);

    // Process each page
    for (const { page, text } of pages) {
      const chunks = chunkText(text);
      console.log(`   Page ${page}: ${chunks.length} chunks`);

      // Generate embeddings for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          const embedding = await generateEmbedding(chunk);
          
          allChunks.push({
            content: chunk,
            embedding,
            metadata: {
              document: doc.name,
              page,
              chunk_index: i,
            },
          });

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`   ❌ Error generating embedding for chunk ${i} on page ${page}:`, error);
        }
      }
    }

    console.log(`✅ Processed ${doc.name}\n`);
  }

  // Insert all chunks into Supabase
  console.log(`💾 Inserting ${allChunks.length} chunks into database...`);
  
  // Insert in batches of 50 to avoid payload limits
  const batchSize = 50;
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    await insertDocumentChunks(batch);
    console.log(`   Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allChunks.length / batchSize)}`);
  }

  console.log('\n✅ Document ingestion complete!');
  console.log(`📊 Total chunks: ${allChunks.length}`);
}

// Run the ingestion
ingestDocuments().catch(console.error);
