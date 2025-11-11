import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

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
 * Split text into smaller, overlapping chunks for better retrieval
 */
function chunkText(text: string, chunkSize: number = 400, overlap: number = 80): string[] {
  const chunks: string[] = [];
  
  // Clean up text
  const cleanText = text.replace(/\s+/g, ' ').trim();
  
  if (cleanText.length === 0) return [];
  
  // If text is shorter than chunk size, return as single chunk
  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }
  
  // Create overlapping chunks
  let start = 0;
  while (start < cleanText.length) {
    let end = start + chunkSize;
    
    // Try to break at sentence boundary
    if (end < cleanText.length) {
      const sentenceEnd = cleanText.slice(start, end).lastIndexOf('. ');
      if (sentenceEnd > chunkSize * 0.5) {
        end = start + sentenceEnd + 1;
      }
    }
    
    const chunk = cleanText.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(chunk);
    }
    
    // Move start forward, accounting for overlap
    start = end - overlap;
    
    // Prevent infinite loop
    if (start >= cleanText.length) break;
  }
  
  return chunks;
}

/**
 * Process a PDF file and extract text with page numbers
 */
async function processPDF(filePath: string): Promise<{ page: number; text: string }[]> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  const fullText = data.text;
  const numPages = data.numpages;
  
  console.log(`   PDF has ${numPages} actual pages, ${fullText.length} characters`);
  
  // Use actual page count if available
  if (numPages && numPages > 0) {
    const charsPerPage = Math.ceil(fullText.length / numPages);
    const pages: { page: number; text: string }[] = [];
    
    for (let i = 0; i < numPages; i++) {
      const start = i * charsPerPage;
      const end = Math.min((i + 1) * charsPerPage, fullText.length);
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
  
  // Fallback: estimate pages
  const estimatedCharsPerPage = 1500;
  const estimatedPages = Math.ceil(fullText.length / estimatedCharsPerPage);
  const pages: { page: number; text: string }[] = [];
  
  for (let i = 0; i < estimatedPages; i++) {
    const start = i * estimatedCharsPerPage;
    const end = Math.min((i + 1) * estimatedCharsPerPage, fullText.length);
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
      const chunks = chunkText(text, 400, 80);
      console.log(`   Page ${page}: ${chunks.length} chunks (${text.length} chars)`);

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

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`   ❌ Error generating embedding for chunk ${i} on page ${page}:`, error);
        }
      }
    }

    console.log(`✅ Processed ${doc.name}\n`);
  }

  // Insert all chunks into Supabase
  console.log(`💾 Inserting ${allChunks.length} chunks into database...`);
  
  // Insert in batches
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