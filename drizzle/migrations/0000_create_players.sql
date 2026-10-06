CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  position TEXT NOT NULL CHECK (position IN ('GOL','ZAG','LAT','VOL','MEI','ATA')),
  skills JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall INTEGER NOT NULL DEFAULT 1 CHECK (overall BETWEEN 1 AND 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX players_session_id_idx ON public.players (session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode ler jogadores" ON public.players FOR SELECT USING (true);
CREATE POLICY "Qualquer um pode criar jogadores" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Qualquer um pode atualizar jogadores" ON public.players FOR UPDATE USING (true);
CREATE POLICY "Qualquer um pode excluir jogadores" ON public.players FOR DELETE USING (true);