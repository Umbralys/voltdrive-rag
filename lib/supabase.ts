import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Client for browser/client-side operations
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Admin client for server-side operations (ingestion, etc.)
// Uses service role key to bypass RLS policies
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * STANDARD vector similarity search
 * Uses the original match_documents function
 */
export async function searchSimilarDocuments(
  queryEmbedding: number[],
  matchCount: number = 5,
  matchThreshold: number = 0.7
) {
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error('Error searching documents:', error);
    throw error;
  }

  return data;
}

/**
 * HYBRID search combining vector similarity and keyword matching
 * This is the recommended function for better retrieval quality
 */
export async function hybridSearch(
  queryEmbedding: number[],
  queryText: string,
  matchCount: number = 8,
  similarityThreshold: number = 0.3,
  vectorWeight: number = 0.7,
  keywordWeight: number = 0.3
) {
  const { data, error } = await supabase.rpc('hybrid_search', {
    query_embedding: queryEmbedding,
    query_text: queryText,
    match_count: matchCount,
    similarity_threshold: similarityThreshold,
    vector_weight: vectorWeight,
    keyword_weight: keywordWeight,
  });

  if (error) {
    console.error('Error in hybrid search:', error);
    throw error;
  }

  return data;
}

/**
 * Search within a specific document
 */
export async function searchByDocument(
  queryEmbedding: number[],
  documentName: string,
  matchCount: number = 5,
  matchThreshold: number = 0.5
) {
  const { data, error } = await supabase.rpc('search_by_document', {
    query_embedding: queryEmbedding,
    document_name: documentName,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error('Error searching by document:', error);
    throw error;
  }

  return data;
}

/**
 * Insert document chunks into the database
 */
export async function insertDocumentChunks(
  chunks: Array<{
    content: string;
    embedding: number[];
    metadata: Record<string, any>;
  }>
) {
  const { data, error } = await supabaseAdmin
    .from('document_chunks')
    .insert(chunks)
    .select();

  if (error) {
    console.error('Error inserting chunks:', error);
    throw error;
  }

  return data;
}

/**
 * Clear all documents from the database
 */
export async function clearAllDocuments() {
  const { error } = await supabaseAdmin
    .from('document_chunks')
    .delete()
    .neq('id', 0); // Delete all rows

  if (error) {
    console.error('Error clearing documents:', error);
    throw error;
  }
}

/**
 * Get statistics about stored documents
 */
export async function getDocumentStats() {
  const { data, error } = await supabase
    .from('document_chunks')
    .select('metadata', { count: 'exact' });

  if (error) {
    console.error('Error getting stats:', error);
    throw error;
  }

  // Aggregate by document
  const stats = (data || []).reduce((acc: Record<string, number>, chunk: any) => {
    const docName = chunk.metadata?.document || 'Unknown';
    acc[docName] = (acc[docName] || 0) + 1;
    return acc;
  }, {});

  return {
    totalChunks: data?.length || 0,
    byDocument: stats,
  };
}

/**
 * Analyze similarity distribution for a given query
 * Useful for debugging retrieval quality
 */
export async function analyzeSimilarityDistribution(queryEmbedding: number[]) {
  const { data, error } = await supabase.rpc('analyze_similarity_distribution', {
    query_embedding: queryEmbedding,
  });

  if (error) {
    console.error('Error analyzing distribution:', error);
    throw error;
  }

  return data;
}
