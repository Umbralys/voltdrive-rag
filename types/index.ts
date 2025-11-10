export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export interface Source {
  document: string;
  page: number;
  content: string;
  similarity: number;
}

export interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    document: string;
    page: number;
    section?: string;
    chunk_index: number;
  };
}

export interface ChatRequest {
  message: string;
  conversationHistory?: Message[];
}

export interface ChatResponse {
  message: string;
  sources: Source[];
}

export interface EmbeddingResponse {
  embedding: number[];
}
