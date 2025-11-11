import { generateEmbedding } from './azure-openai';
import { searchSimilarDocuments } from './supabase';
import { Source } from '@/types';

/**
 * Build context from retrieved documents
 */
export function buildContext(documents: any[]): { context: string; sources: Source[] } {
  const sources: Source[] = documents.map((doc) => ({
    document: doc.metadata.document,
    page: doc.metadata.page,
    content: doc.content,
    similarity: doc.similarity,
  }));

  const context = documents
    .map((doc, idx) => {
      return `[Source ${idx + 1}: ${doc.metadata.document}, Page ${doc.metadata.page}]\n${doc.content}`;
    })
    .join('\n\n');

  return { context, sources };
}

/**
 * Build system prompt for RAG
 */
export function buildSystemPrompt(context: string): string {
  return `You are a helpful VoltDrive customer support assistant. You help customers with questions about their VoltDrive electric vehicles.

Use the following context from VoltDrive documentation to answer questions. If the answer isn't in the context, politely say so and offer to help with related topics you do know about.

Context from VoltDrive documentation:
${context}

Instructions:
- Be friendly, professional, and concise
- Cite specific sources when providing information (e.g., "According to the troubleshooting guide...")
- If unsure, acknowledge uncertainty rather than making up information
- Focus on practical, actionable advice
- Use the customer's terminology but clarify technical terms when needed`;
}

/**
 * Perform RAG: Retrieve relevant context and prepare for generation
 */
export async function performRAG(query: string, topK: number = 5) {
  console.log('🔍 RAG Query:', query);
  
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  console.log('✅ Generated embedding, length:', queryEmbedding.length);

  // Search for similar documents
  const documents = await searchSimilarDocuments(queryEmbedding, topK, 0.5);
  console.log('📚 Found documents:', documents?.length || 0);
  
  if (documents && documents.length > 0) {
    console.log('Top 3 results:');
    documents.slice(0, 3).forEach((doc, i) => {
      console.log(`  ${i + 1}. Similarity: ${doc.similarity.toFixed(3)}, Doc: ${doc.metadata?.document}, Page: ${doc.metadata?.page}`);
      console.log(`     Preview: ${doc.content.substring(0, 80)}...`);
    });
  }

  if (!documents || documents.length === 0) {
    console.log('⚠️ No documents found - using fallback');
    return {
      context: '',
      sources: [],
      systemPrompt: `You are a helpful VoltDrive customer support assistant. The user's question doesn't match any specific documentation, but try to be helpful based on general knowledge about electric vehicles and customer support.`,
    };
  }

  // Build context and sources
  const { context, sources } = buildContext(documents);
  console.log('📝 Built context with', sources.length, 'sources');

  // Build system prompt
  const systemPrompt = buildSystemPrompt(context);

  return {
    context,
    sources,
    systemPrompt,
  };
}
