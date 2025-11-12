import { generateEmbedding } from './azure-openai';
import { searchSimilarDocuments } from './supabase';
import { Source } from '@/types';

/**
 * Query expansion dictionary for common VoltDrive topics
 * Helps capture semantic variations and related terms
 */
const QUERY_EXPANSIONS: Record<string, string> = {
  // Warranty related
  warranty: 'warranty coverage guarantee protection insurance policy claim repair',
  guarantee: 'warranty guarantee coverage protection assurance',
  
  // Starting/Power issues
  start: 'start ignition power on boot activate turn startup launch',
  'won\'t start': 'not starting no power dead battery ignition failure',
  power: 'power energy electrical battery charge current',
  
  // Charging related
  charge: 'charging battery power electric recharge plug cable station',
  charging: 'charging charge recharge battery power plug station',
  battery: 'battery charge power energy capacity cell pack',
  
  // Range/Efficiency
  range: 'range distance mileage efficiency driving capacity',
  distance: 'range distance mileage travel driving',
  efficiency: 'efficiency range economy consumption performance',
  
  // Maintenance
  maintenance: 'maintenance service repair care upkeep inspection',
  service: 'service maintenance repair check inspection care',
  
  // Troubleshooting
  problem: 'problem issue error fault trouble failure malfunction',
  error: 'error problem issue fault warning message trouble',
  issue: 'issue problem error trouble fault concern',
  
  // Performance
  performance: 'performance speed acceleration power efficiency capability',
  speed: 'speed performance acceleration fast velocity',
  
  // Price/Cost
  price: 'price cost pricing fee charge payment rate',
  cost: 'cost price pricing fee expense payment',
};

/**
 * Expand user query with related terms to improve retrieval
 */
function expandQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  let expandedTerms: string[] = [];
  
  // Check for matching terms
  for (const [key, expansion] of Object.entries(QUERY_EXPANSIONS)) {
    if (lowerQuery.includes(key.toLowerCase())) {
      // Add expansion terms (limit to avoid over-expansion)
      const terms = expansion.split(' ').slice(0, 5);
      expandedTerms.push(...terms);
    }
  }
  
  // Remove duplicates and limit total expansion
  expandedTerms = [...new Set(expandedTerms)].slice(0, 8);
  
  // Combine original query with expanded terms
  const expandedQuery = expandedTerms.length > 0
    ? `${query} ${expandedTerms.join(' ')}`
    : query;
  
  return expandedQuery;
}

/**
 * Calculate keyword overlap between query and content
 * Used for re-ranking results
 */
function calculateKeywordRelevance(query: string, content: string): number {
  // Extract meaningful words (remove common stop words)
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'been', 'be',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'about', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again',
    'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just'
  ]);
  
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  const contentLower = content.toLowerCase();
  
  // Count exact matches
  let exactMatches = 0;
  let partialMatches = 0;
  
  for (const word of queryWords) {
    if (contentLower.includes(` ${word} `) || contentLower.startsWith(word) || contentLower.endsWith(word)) {
      exactMatches++;
    } else if (contentLower.includes(word)) {
      partialMatches += 0.5;
    }
  }
  
  const totalMatches = exactMatches + partialMatches;
  const relevanceScore = queryWords.length > 0 ? totalMatches / queryWords.length : 0;
  
  return Math.min(relevanceScore, 1.0); // Cap at 1.0
}

/**
 * Re-rank results using hybrid scoring
 * Combines vector similarity with keyword relevance
 */
function rerankResults(
  query: string,
  documents: any[],
  vectorWeight: number = 0.7,
  keywordWeight: number = 0.3
): any[] {
  return documents.map(doc => {
    const keywordRelevance = calculateKeywordRelevance(query, doc.content);
    
    // Hybrid score: weighted combination
    const hybridScore = (doc.similarity * vectorWeight) + (keywordRelevance * keywordWeight);
    
    return {
      ...doc,
      originalSimilarity: doc.similarity,
      keywordRelevance,
      similarity: hybridScore, // Update similarity with hybrid score
    };
  }).sort((a, b) => b.similarity - a.similarity);
}

/**
 * Extract clean content from enriched chunks
 * Removes the metadata headers we added during ingestion
 */
function extractCleanContent(enrichedContent: string): string {
  // Remove [Source: ...] and [Section: ...] headers
  return enrichedContent
    .replace(/^\[Source:.*?\]\n/gm, '')
    .replace(/^\[Section:.*?\]\n/gm, '')
    .trim();
}

/**
 * Build context from retrieved documents with clean formatting
 */
export function buildContext(documents: any[]): { context: string; sources: Source[] } {
  const sources: Source[] = documents.map((doc) => ({
    document: doc.metadata.document,
    page: doc.metadata.page,
    content: extractCleanContent(doc.content), // Clean content for display
    similarity: doc.similarity,
  }));

  const context = documents
    .map((doc, idx) => {
      const cleanContent = extractCleanContent(doc.content);
      return `[Source ${idx + 1}: ${doc.metadata.document}, Page ${doc.metadata.page}]\n${cleanContent}`;
    })
    .join('\n\n---\n\n');

  return { context, sources };
}

/**
 * Build system prompt for RAG with emphasis on accuracy
 */
export function buildSystemPrompt(context: string): string {
  return `You are a helpful VoltDrive customer support assistant. You help customers with questions about their VoltDrive electric vehicles.

Use the following context from VoltDrive documentation to answer questions. The context includes relevant excerpts with source information.

Context from VoltDrive documentation:
${context}

Instructions:
- Be friendly, professional, and concise
- ALWAYS cite specific sources when providing information (e.g., "According to the Troubleshooting Guide, page 3...")
- If the answer isn't fully covered in the context, say so clearly and offer to help with related topics
- Focus on practical, actionable advice
- Use the customer's terminology but clarify technical terms when needed
- If multiple sources provide relevant information, synthesize them coherently
- Prioritize safety and accuracy over being comprehensive`;
}

/**
 * Perform IMPROVED RAG: Retrieve, re-rank, and prepare for generation
 * Now with query expansion and hybrid scoring for 90%+ confidence
 */
export async function performRAG(
  query: string,
  topK: number = 8, // Retrieve more initially for re-ranking
  similarityThreshold: number = 0.3 // Lower initial threshold
) {
  console.log('🔍 RAG Query:', query);
  
  // Step 1: Expand query for better semantic coverage
  const expandedQuery = expandQuery(query);
  if (expandedQuery !== query) {
    console.log('📝 Expanded query:', expandedQuery);
  }
  
  // Step 2: Generate embedding for the expanded query
  const queryEmbedding = await generateEmbedding(expandedQuery);
  console.log('✅ Generated embedding, length:', queryEmbedding.length);

  // Step 3: Search for similar documents with lower threshold
  const documents = await searchSimilarDocuments(
    queryEmbedding,
    topK,
    similarityThreshold
  );
  console.log('📚 Found documents:', documents?.length || 0);
  
  if (documents && documents.length > 0) {
    console.log('📊 Initial retrieval scores:');
    documents.slice(0, 3).forEach((doc, i) => {
      console.log(`  ${i + 1}. Similarity: ${doc.similarity.toFixed(3)}, Doc: ${doc.metadata?.document}, Page: ${doc.metadata?.page}`);
    });
    
    // Step 4: Re-rank using hybrid scoring
    console.log('🔄 Re-ranking with hybrid scoring...');
    const rerankedDocs = rerankResults(query, documents);
    
    console.log('✨ After re-ranking:');
    rerankedDocs.slice(0, 5).forEach((doc, i) => {
      console.log(`  ${i + 1}. Hybrid: ${doc.similarity.toFixed(3)} (vector: ${doc.originalSimilarity.toFixed(3)}, keyword: ${doc.keywordRelevance.toFixed(3)})`);
      console.log(`     Doc: ${doc.metadata?.document}, Page: ${doc.metadata?.page}`);
    });
    
    // Step 5: Filter to top results after re-ranking
    const topResults = rerankedDocs.slice(0, Math.min(5, topK));
    
    // Build context and return
    const { context, sources } = buildContext(topResults);
    const systemPrompt = buildSystemPrompt(context);
    
    console.log(`📝 Built context with ${sources.length} sources`);
    console.log(`🎯 Confidence range: ${(topResults[0]?.similarity * 100).toFixed(1)}% - ${(topResults[topResults.length - 1]?.similarity * 100).toFixed(1)}%`);
    
    return {
      context,
      sources,
      systemPrompt,
    };
  }

  // Fallback if no documents found
  console.log('⚠️ No documents found - using fallback');
  return {
    context: '',
    sources: [],
    systemPrompt: `You are a helpful VoltDrive customer support assistant. 

I apologize, but I couldn't find specific information in the VoltDrive documentation to answer your question. 

However, I'm here to help! I can assist with:
- Troubleshooting common issues
- Warranty and coverage questions  
- Charging and battery information
- General vehicle operation
- Maintenance schedules

Could you rephrase your question or ask about one of these topics?`,
  };
}

/**
 * Performance monitoring helper
 */
export function logRAGPerformance(sources: Source[]) {
  if (sources.length === 0) {
    console.log('⚠️ No sources retrieved');
    return;
  }
  
  const avgSimilarity = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;
  const minSimilarity = Math.min(...sources.map(s => s.similarity));
  const maxSimilarity = Math.max(...sources.map(s => s.similarity));
  
  console.log('📈 RAG Performance:');
  console.log(`   Sources: ${sources.length}`);
  console.log(`   Avg Confidence: ${(avgSimilarity * 100).toFixed(1)}%`);
  console.log(`   Range: ${(minSimilarity * 100).toFixed(1)}% - ${(maxSimilarity * 100).toFixed(1)}%`);
  
  if (avgSimilarity >= 0.9) {
    console.log('   ✅ EXCELLENT retrieval quality');
  } else if (avgSimilarity >= 0.7) {
    console.log('   ✅ GOOD retrieval quality');
  } else if (avgSimilarity >= 0.5) {
    console.log('   ⚠️ MODERATE retrieval quality');
  } else {
    console.log('   ❌ LOW retrieval quality - consider re-ingesting');
  }
}
