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
 * Enhanced chunking with semantic boundaries and context preservation
 * Now uses larger chunks with better overlap for improved retrieval
 */
function chunkTextSemantic(
  text: string, 
  chunkSize: number = 500,  // Reduced from 1000
  overlap: number = 100      // Reduced from 200
): string[] {
  const chunks: string[] = [];
  
  // Clean up text - preserve paragraph structure
  const cleanText = text
    .replace(/\s+/g, ' ')
    .replace(/\. /g, '.\n')
    .trim();
  
  if (cleanText.length === 0) return [];
  
  // If text is shorter than chunk size, return as single chunk
  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }
  
  // Split into sentences first for better boundaries
  const sentences = cleanText.split(/(?<=[.!?])\s+/);
  
  let currentChunk = '';
  let currentLength = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceLength = sentence.length;
    
    // If adding this sentence exceeds chunk size and we have content
    if (currentLength + sentenceLength > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap (last few sentences)
      const overlapSentences = currentChunk
        .split(/(?<=[.!?])\s+/)
        .slice(-3) // Keep last 3 sentences for context
        .join(' ');
      
      currentChunk = overlapSentences + ' ' + sentence;
      currentLength = currentChunk.length;
    } else {
      // Add sentence to current chunk
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentLength += sentenceLength;
    }
  }
  
  // Add final chunk if it has content
  if (currentChunk.trim().length > 100) {
    chunks.push(currentChunk.trim());
  }
  
  console.log(`   Created ${chunks.length} semantic chunks`);
  return chunks;
}

/**
 * Enrich chunk with document context to improve embedding quality
 */
function enrichChunkWithContext(
  chunk: string,
  documentName: string,
  page: number,
  chunkIndex: number,
  totalChunks: number
): string {
  // Extract potential section header from chunk
  const lines = chunk.split('\n');
  const potentialHeader = lines[0].length < 60 && lines[0].length > 5 
    ? lines[0] 
    : null;
  
  // Add structured context that helps with retrieval
  let enrichedContent = '';
  
  // Add document metadata (helps with general queries)
  enrichedContent += `[Source: ${documentName}, Page ${page}]\n`;
  
  // Add section header if detected
  if (potentialHeader) {
    enrichedContent += `[Section: ${potentialHeader}]\n`;
  }
  
  // Add the actual content
  enrichedContent += `\n${chunk}`;
  
  return enrichedContent;
}

/**
 * Extract section headers from text for better organization
 */
function detectSections(text: string): { header: string; content: string }[] {
  const sections: { header: string; content: string }[] = [];
  
  // Split by common header patterns (all caps, numbered sections, etc.)
  const lines = text.split('\n');
  let currentHeader = 'Introduction';
  let currentContent = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect headers (all caps, short lines, or numbered)
    if (
      (trimmed.length > 0 && trimmed.length < 60 && trimmed === trimmed.toUpperCase()) ||
      /^\d+\.\s+[A-Z]/.test(trimmed) ||
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*:$/.test(trimmed)
    ) {
      // Save previous section
      if (currentContent.trim()) {
        sections.push({ header: currentHeader, content: currentContent.trim() });
      }
      currentHeader = trimmed.replace(/:$/, '');
      currentContent = '';
    } else {
      currentContent += line + '\n';
    }
  }
  
  // Add final section
  if (currentContent.trim()) {
    sections.push({ header: currentHeader, content: currentContent.trim() });
  }
  
  return sections;
}

/**
 * Process a PDF file with enhanced text extraction
 */
async function processPDF(filePath: string): Promise<{ page: number; text: string; section?: string }[]> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  
  const fullText = data.text;
  const numPages = data.numpages;
  
  console.log(`   PDF: ${numPages} pages, ${fullText.length} characters`);
  
  // Detect sections in the document
  const sections = detectSections(fullText);
  console.log(`   Detected ${sections.length} sections`);
  
  // Use actual page count if available
  if (numPages && numPages > 0) {
    const charsPerPage = Math.ceil(fullText.length / numPages);
    const pages: { page: number; text: string; section?: string }[] = [];
    
    for (let i = 0; i < numPages; i++) {
      const start = i * charsPerPage;
      const end = Math.min((i + 1) * charsPerPage, fullText.length);
      const pageText = fullText.slice(start, end);
      
      if (pageText.trim()) {
        // Find which section this page belongs to
        let pageSection = undefined;
        let currentPos = 0;
        for (const section of sections) {
          currentPos += section.content.length;
          if (currentPos > start) {
            pageSection = section.header;
            break;
          }
        }
        
        pages.push({
          page: i + 1,
          text: pageText,
          section: pageSection,
        });
      }
    }
    
    return pages;
  }
  
  // Fallback: estimate pages
  const estimatedCharsPerPage = 2000;
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
 * Ingest documents with improved chunking and enrichment
 */
async function ingestDocuments() {
  console.log('🚀 Starting IMPROVED document ingestion...\n');
  console.log('📈 Enhancements:');
  console.log('   - Medium semantic chunks (500 chars)');
  console.log('   - Better sentence boundaries');
  console.log('   - Context enrichment for embeddings');
  console.log('   - Section detection\n');

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
  let totalChunksCreated = 0;

  // Process each document
  for (const doc of documents) {
    console.log(`📄 Processing: ${doc.name}`);
    
    if (!fs.existsSync(doc.path)) {
      console.error(`❌ File not found: ${doc.path}`);
      continue;
    }

    // Extract text from PDF with sections
    const pages = await processPDF(doc.path);
    console.log(`   Found ${pages.length} pages`);

    // Process each page
    for (const { page, text, section } of pages) {
      // Use improved semantic chunking with 500-char chunks
      const chunks = chunkTextSemantic(text, 500, 100);
      console.log(`   Page ${page}: ${chunks.length} chunks (${text.length} chars)${section ? `, Section: ${section}` : ''}`);
      
      totalChunksCreated += chunks.length;

      // Generate embeddings for each chunk with enrichment
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          // Enrich chunk with context before embedding
          const enrichedChunk = enrichChunkWithContext(
            chunk,
            doc.name,
            page,
            i,
            chunks.length
          );
          
          // Embed the enriched version (has context)
          const embedding = await generateEmbedding(enrichedChunk);
          
          // But STORE the plain version (for keyword matching)
          allChunks.push({
            content: chunk, // Store PLAIN chunk for keyword matching
            embedding,      // Use enriched embedding for semantic search
            metadata: {
              document: doc.name,
              page,
              section: section,
              chunk_index: i,
            },
          });

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Progress indicator
          if (allChunks.length % 10 === 0) {
            process.stdout.write(`   Progress: ${allChunks.length} chunks embedded...\r`);
          }
        } catch (error) {
          console.error(`   ❌ Error generating embedding for chunk ${i} on page ${page}:`, error);
        }
      }
    }

    console.log(`✅ Processed ${doc.name}\n`);
  }

  // Insert all chunks into Supabase
  console.log(`\n💾 Inserting ${allChunks.length} chunks into database...`);
  console.log(`📊 Average chunk size: ${Math.round(allChunks.reduce((sum, c) => sum + c.content.length, 0) / allChunks.length)} characters`);
  
  // Insert in batches
  const batchSize = 50;
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    await insertDocumentChunks(batch);
    console.log(`   Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allChunks.length / batchSize)}`);
  }

  console.log('\n✅ IMPROVED document ingestion complete!');
  console.log(`📊 Summary:`);
  console.log(`   - Total chunks: ${allChunks.length}`);
  console.log(`   - Documents: ${documents.length}`);
  console.log(`   - Chunks per document: ~${Math.round(allChunks.length / documents.length)}`);
  console.log('\n🎯 Expected improvements:');
  console.log('   - Better semantic coherence');
  console.log('   - Higher similarity scores (target: 0.75-0.95+)');
  console.log('   - More relevant retrievals');
}

// Run the ingestion
ingestDocuments().catch(console.error);