import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { supabase } from '../lib/supabase';

async function debugChunks() {
  console.log('🔍 Checking database chunks...\n');
  
  const { data, error } = await supabase
    .from('document_chunks')
    .select('id, content, metadata')
    .limit(3);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    data.forEach((chunk, i) => {
      console.log(`\n📄 Chunk ${i + 1}:`);
      console.log(`   Doc: ${chunk.metadata.document}, Page: ${chunk.metadata.page}`);
      console.log(`   Content length: ${chunk.content.length} chars`);
      console.log(`   First 200 chars: "${chunk.content.substring(0, 200)}..."`);
      console.log(`   Contains "warranty": ${chunk.content.toLowerCase().includes('warranty')}`);
      console.log(`   Contains "coverage": ${chunk.content.toLowerCase().includes('coverage')}`);
    });
  } else {
    console.log('❌ No chunks found in database');
  }
}

debugChunks().catch(console.error);