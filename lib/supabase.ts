import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
}

// Client for browser/client-side operations
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Admin client for server-side operations (ingestion, etc.)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Search for similar documents using vector similarity
 */
export async function searchSimilarDocuments(
  embedding: number[],
  matchCount: number = 5,
  matchThreshold: number = 0.7
) {
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
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
 * Insert document chunks with embeddings
 */
export async function insertDocumentChunks(chunks: Array<{
  content: string;
  embedding: number[];
  metadata: any;
}>) {
  const { data, error } = await supabaseAdmin
    .from('document_chunks')
    .insert(chunks);

  if (error) {
    console.error('Error inserting document chunks:', error);
    throw error;
  }

  return data;
}

/**
 * Clear all document chunks (useful for re-ingestion)
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
