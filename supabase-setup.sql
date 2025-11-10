-- Enable the pgvector extension
create extension if not exists vector;

-- Create the document_chunks table
create table document_chunks (
  id bigserial primary key,
  content text not null,
  embedding vector(1536),  -- Azure text-embedding-3-small uses 1536 dimensions
  metadata jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create an index for faster similarity searches
create index on document_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create a function to search for similar documents
create or replace function match_documents (
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.7
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.content,
    document_chunks.metadata,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create an index on metadata for faster filtering (optional)
create index idx_document_chunks_metadata on document_chunks using gin (metadata);

-- Grant access to authenticated users (adjust based on your security needs)
alter table document_chunks enable row level security;

-- Allow all operations for authenticated users (you can make this more restrictive)
create policy "Allow all operations for authenticated users"
  on document_chunks
  for all
  to authenticated
  using (true)
  with check (true);

-- Allow read access for anon users (for the chat interface)
create policy "Allow read access for anon users"
  on document_chunks
  for select
  to anon
  using (true);
