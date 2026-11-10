import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plus, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlayerCard } from "@/components/PlayerCard";
import { PlayerFormDialog } from "@/components/PlayerFormDialog";
import type { Player } from "@/lib/players";
import type { PlayerInput } from "@/lib/player-queries";
import type { AppSearch } from "@/routes/index";

const POSITIONS_FILTER = ["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"] as const;

type Props = {
  players: Player[];
  currentUserId: string;
  isAdmin: boolean;
  search: AppSearch;
  onDelete: (player: Player) => void;
  onSubmitPlayer: (id: string | null, input: PlayerInput) => Promise<Player>;
  onNavigate: (params: Partial<AppSearch>) => void;
  onCloseDialog: () => void;
  draftKeyPrefix?: string;
};

export function AbaElenco({
  players,
  currentUserId,
  isAdmin,
  search,
  onDelete,
  onSubmitPlayer,
  onNavigate,
  onCloseDialog,
  draftKeyPrefix,
}: Props) {
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState<string>("Todos");
  const [pendingDelete, setPendingDelete] = useState<Player | null>(null);

  const ownPlayer = players.find((p) => p.user_id === currentUserId) ?? null;

  // Diálogo ativo vindo da URL
  const dialogoAberto = search.dialogo === "novo-jogador" || search.dialogo === "editar-jogador";
  const editingId = search.dialogo === "editar-jogador" ? (search.id ?? null) : null;
  const editingPlayer = editingId ? (players.find((p) => p.id === editingId) ?? null) : null;
  const isNewPlayer = search.dialogo === "novo-jogador";

  useEffect(() => {
    if (search.dialogo === "editar-jogador" && editingId && !editingPlayer) {
      toast.error("Jogador não encontrado ou sem permissão.");
      onCloseDialog();
    }
  }, [editingId, editingPlayer, onCloseDialog, search.dialogo]);

  function openDialog(dialogo: "novo-jogador" | "editar-jogador", id?: string) {
    onNavigate({ dialogo, ...(id ? { id } : {}) });
  }

  function closeDialog() {
    onCloseDialog();
  }

  async function handleSubmit(input: PlayerInput): Promise<Player> {
    if (editingId && !editingPlayer) {
      throw new Error("Jogador não encontrado ou sem permissão.");
    }
    const targetId = editingId ?? (ownPlayer && !isNewPlayer ? ownPlayer.id : null);
    const saved = await onSubmitPlayer(targetId, input);
    return saved;
  }

  function handleDone(saved: Player) {
    closeDialog();
    // Scroll até a carta salva
    setTimeout(() => {
      const el = document.getElementById(`player-card-${saved.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? players.filter((p) => p.name.toLowerCase().includes(q)) : [...players];
    if (posFilter !== "Todos") list = list.filter((p) => p.position === posFilter);
    return list.sort((a, b) => b.overall - a.overall);
  }, [players, query, posFilter]);

  return (
    <section className="space-y-6 animate-rise">
      <h1 className="sr-only">Elenco</h1>
      {/* ── Seu card ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-base font-bold uppercase tracking-wide text-foreground">
          Seu card
        </h2>
        {ownPlayer ? (
          <div className="flex flex-wrap items-end gap-4">
            <PlayerCard
              name={ownPlayer.name}
              position={ownPlayer.position}
              skills={ownPlayer.skills}
              weakFoot={ownPlayer.weak_foot}
              photoUrl={ownPlayer.photo_url}
              overall={ownPlayer.overall}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openDialog("editar-jogador", ownPlayer.id)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar meu card
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Você ainda não tem um card nesta seção.</p>
            <Button onClick={() => openDialog("novo-jogador")}>
              <Plus className="mr-1.5 h-4 w-4" />
              Criar meu card
            </Button>
          </div>
        )}
      </div>

      {/* ── Controles ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        {/* Busca */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            aria-label="Buscar jogador"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jogador"
            className="pl-9"
          />
        </div>

        {/* Filtro por posição */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por posição">
          {["Todos", ...POSITIONS_FILTER].map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPosFilter(pos)}
              aria-pressed={posFilter === pos}
              className={
                posFilter === pos
                  ? "min-h-11 rounded-full border border-primary bg-primary px-3 py-1 text-xs font-bold text-primary-foreground md:min-h-0"
                  : "min-h-11 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-foreground md:min-h-0"
              }
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Admin: adicionar jogador */}
        {isAdmin && (
          <Button size="sm" className="ml-auto" onClick={() => openDialog("novo-jogador")}>
            <Plus className="mr-1.5 h-4 w-4" />
            Adicionar jogador
          </Button>
        )}
      </div>

      {/* Contagem */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "jogador" : "jogadores"}
        {posFilter !== "Todos" ? ` em ${posFilter}` : ""}
      </p>

      {/* ── Galeria ──────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-muted-foreground">
            {players.length === 0
              ? "Nenhum jogador cadastrado ainda."
              : "Nenhum jogador encontrado com esses filtros."}
          </p>
          {players.length === 0 && !ownPlayer && (
            <Button className="mt-4" onClick={() => openDialog("novo-jogador")}>
              <Plus className="mr-1.5 h-4 w-4" />
              Criar meu card
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-5">
          {filtered.map((player) => {
            const isOwn = player.user_id === currentUserId;
            const canManage = isOwn || isAdmin;
            return (
              <div
                key={player.id}
                id={`player-card-${player.id}`}
                className="animate-rise space-y-1.5"
              >
                <PlayerCard
                  name={player.name}
                  position={player.position}
                  skills={player.skills}
                  weakFoot={player.weak_foot}
                  photoUrl={player.photo_url}
                  overall={player.overall}
                />
                {canManage ? (
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Opções para ${player.name}`}
                          className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground md:min-h-0 md:min-w-0"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDialog("editar-jogador", player.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setPendingDelete(player)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <p className="py-1 text-center text-xs text-muted-foreground">
                    {player.user_id ? "Jogador de outro usuário" : "Adicionado pelo admin"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pop-up de jogador ─────────────────────────────────────────────── */}
      <PlayerFormDialog
        open={dialogoAberto && (isNewPlayer || !!editingPlayer)}
        onOpenChange={(open) => !open && closeDialog()}
        editing={isNewPlayer ? null : editingPlayer}
        isNew={isNewPlayer}
        isAdmin={isAdmin}
        onSubmit={handleSubmit}
        onDone={handleDone}
        {...(draftKeyPrefix
          ? { draftKey: `${draftKeyPrefix}:player:${isNewPlayer ? "new" : (editingId ?? "self")}` }
          : {})}
      />

      {/* ── AlertDialog excluir jogador ───────────────────────────────────── */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O jogador será removido desta seção. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) {
                  onDelete(pendingDelete);
                  setPendingDelete(null);
                }
              }}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
