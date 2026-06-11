CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_hash TEXT NOT NULL UNIQUE,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_prompt_hash ON public.ai_response_cache(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_expires_at ON public.ai_response_cache(expires_at);
