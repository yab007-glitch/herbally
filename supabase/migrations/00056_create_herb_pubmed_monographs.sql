-- PubMed-compiled monograph information sheets.
--
-- For herbs that have no hand-written (human-authored) monograph, we compile a
-- PubMed-grounded information sheet via scripts/generate-pubmed-monograph.ts
-- (Ollama Cloud glm-5.2). Every factual claim in `content` is cited to a real
-- PubMed PMID listed in `citations`. The synthesis is AI-assisted; a reviewer
-- (e.g. Dr. Dawn Wong) can flip status to 'reviewed'.
--
-- Access: anyone may READ (public catalog, shown on herb pages); only the
-- service role (server-side ingestion) can write — anon/authenticated get no
-- write policy, so the public anon key cannot poison sheets.

CREATE TABLE IF NOT EXISTS public.herb_pubmed_monographs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE REFERENCES public.herbs(slug) ON DELETE CASCADE,
  content JSONB NOT NULL,
  citations JSONB DEFAULT '[]'::jsonb,
  pmids TEXT[] DEFAULT '{}',
  article_count INT DEFAULT 0,
  model TEXT,
  generated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status TEXT DEFAULT 'compiled',
  last_reviewed TIMESTAMPTZ,
  reviewed_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.herb_pubmed_monographs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "herb_pubmed_monographs is publicly readable" ON public.herb_pubmed_monographs;
CREATE POLICY "herb_pubmed_monographs is publicly readable"
  ON public.herb_pubmed_monographs
  FOR SELECT
  USING (true);
