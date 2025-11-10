import { AzureOpenAI } from 'openai';

if (!process.env.AZURE_OPENAI_API_KEY) {
  throw new Error('AZURE_OPENAI_API_KEY is not set');
}

if (!process.env.AZURE_OPENAI_ENDPOINT) {
  throw new Error('AZURE_OPENAI_ENDPOINT is not set');
}

export const azureOpenAI = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview', // Updated
});

export const CHAT_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-mini';
export const EMBEDDING_DEPLOYMENT = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small';

/**
 * Generate embeddings for text using Azure OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await azureOpenAI.embeddings.create({
      model: EMBEDDING_DEPLOYMENT,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate chat completion with streaming
 */
export async function generateChatCompletion(
  messages: Array<{ role: string; content: string }>,
  stream: boolean = true
) {
  return azureOpenAI.chat.completions.create({
    model: CHAT_DEPLOYMENT,
    messages,
    temperature: 0.7,
    max_tokens: 1000,
    stream,
  });
}
