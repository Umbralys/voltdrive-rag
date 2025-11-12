// Test the keyword matching function directly

function calculateKeywordRelevance(query: string, content: string): number {
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
    
    console.log('Query words:', queryWords);
    
    const contentLower = content.toLowerCase();
    
    let exactMatches = 0;
    let partialMatches = 0;
    
    for (const word of queryWords) {
      if (contentLower.includes(` ${word} `) || contentLower.startsWith(word) || contentLower.endsWith(word)) {
        console.log(`  ✅ Exact match: "${word}"`);
        exactMatches++;
      } else if (contentLower.includes(word)) {
        console.log(`  ⚠️  Partial match: "${word}"`);
        partialMatches += 0.5;
      } else {
        console.log(`  ❌ No match: "${word}"`);
      }
    }
    
    const totalMatches = exactMatches + partialMatches;
    const relevanceScore = queryWords.length > 0 ? totalMatches / queryWords.length : 0;
    
    console.log(`\nTotal matches: ${totalMatches} / ${queryWords.length}`);
    console.log(`Relevance score: ${relevanceScore}`);
    
    return Math.min(relevanceScore, 1.0);
  }
  
  // Test with sample content
  const query = "What's covered under warranty?";
  const content = "Battery & Drive Unit: 8-year/100,000-mile warranty covering manufacturing defects. Covers battery capacity degradation below 70% of original capacity.";
  
  console.log('Testing keyword matching:\n');
  console.log('Query:', query);
  console.log('Content:', content);
  console.log('\n---\n');
  
  calculateKeywordRelevance(query, content);