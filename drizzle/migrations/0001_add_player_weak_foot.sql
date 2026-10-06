ALTER TABLE public.players
  ADD COLUMN weak_foot INTEGER NOT NULL DEFAULT 0
  CHECK (weak_foot BETWEEN 0 AND 5);

COMMENT ON COLUMN public.players.weak_foot IS 'Nota de perna ruim do jogador, de 0 a 5.';