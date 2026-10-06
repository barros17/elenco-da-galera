import { useMemo, useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerCard } from "@/components/PlayerCard";
import type { Player } from "@/lib/players";

type Props = {
  players: Player[];
  currentUserId: string;
  onEdit: (player: Player) => void;
  onDelete: (player: Player) => void;
};

export function PlayersGallery({ players, currentUserId, onEdit, onDelete }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players;
    return [...list].sort((a, b) => b.overall - a.overall);
  }, [players, query]);

  const average = players.length
    ? Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="font-display text-3xl font-bold text-primary">{players.length}</div>
          <div className="text-xs tracking-widest text-muted-foreground uppercase">Jogadores</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="font-display text-3xl font-bold text-accent">{average}</div>
          <div className="text-xs tracking-widest text-muted-foreground uppercase">
            Overall médio
          </div>
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jogador"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
          {players.length === 0
            ? "Nenhum jogador cadastrado ainda. Comece pela etapa 1."
            : "Nenhum jogador encontrado com esse nome."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-5">
          {filtered.map((p) => (
            <div key={p.id} className="animate-rise space-y-2">
              <PlayerCard
                name={p.name}
                position={p.position}
                skills={p.skills}
                weakFoot={p.weak_foot}
                photoUrl={p.photo_url}
                overall={p.overall}
              />
              {p.user_id === currentUserId ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => onEdit(p)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar meu jogador
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(p)}
                    aria-label={`Excluir ${p.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ) : (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  Jogador de outro usuário
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
