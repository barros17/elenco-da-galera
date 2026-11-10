import { useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { buildFormation } from "@/lib/team-formations";
import { useGameStyleMutations, useGameStyles, type GameStyle } from "@/lib/game-style-queries";
import { styleTotal } from "@/lib/game-style-utils";
import { supabase } from "@/integrations/supabase/client";
import type { AppSearch } from "@/routes/index";

type Props = {
  sectionId: string;
  isAdmin: boolean;
  /** Se fornecido, o painel usa a URL para controlar qual pop-up está aberto */
  search?: AppSearch;
  onNavigate?: (params: Partial<AppSearch>) => void;
  onCloseDialog?: () => void;
};

type FormState = {
  name: string;
  players_per_team: number;
  has_goalkeeper: boolean;
  defenders: number;
  midfielders: number;
  attackers: number;
};

const empty: FormState = {
  name: "",
  players_per_team: 4,
  has_goalkeeper: false,
  defenders: 1,
  midfielders: 2,
  attackers: 1,
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível salvar o estilo.";
}

export function GameStylesPanel({ sectionId, isAdmin, search, onNavigate, onCloseDialog }: Props) {
  const query = useGameStyles(sectionId);
  const mutations = useGameStyleMutations(sectionId);
  const scheduledEvents = useQuery({
    queryKey: ["scheduled-events-by-style", sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, game_style_id")
        .eq("section_id", sectionId)
        .eq("status", "scheduled");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<FormState>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GameStyle | null>(null);

  // Controle do pop-up: via URL quando onNavigate disponível, senão estado local
  const useUrlControl = !!onNavigate;
  const [localOpen, setLocalOpen] = useState(false);

  const dialogoAberto = useUrlControl
    ? search?.dialogo === "novo-estilo" || search?.dialogo === "editar-estilo"
    : localOpen;

  function openDialog(style?: GameStyle) {
    if (style) {
      setEditingId(style.id);
      setForm({
        name: style.name,
        players_per_team: style.players_per_team,
        has_goalkeeper: style.has_goalkeeper,
        defenders: style.defenders,
        midfielders: style.midfielders,
        attackers: style.attackers,
      });
    } else {
      setEditingId(null);
      setForm(empty);
    }
    if (useUrlControl) {
      onNavigate?.({
        dialogo: style ? "editar-estilo" : "novo-estilo",
        ...(style?.id ? { id: style.id } : {}),
      });
    } else {
      setLocalOpen(true);
    }
  }

  function closeDialog() {
    if (useUrlControl) {
      onCloseDialog?.();
    } else {
      setLocalOpen(false);
    }
    setEditingId(null);
    setForm(empty);
  }

  const isDirty =
    form.name !== empty.name ||
    form.players_per_team !== empty.players_per_team ||
    form.has_goalkeeper !== empty.has_goalkeeper ||
    form.defenders !== empty.defenders ||
    form.midfielders !== empty.midfielders ||
    form.attackers !== empty.attackers;

  async function save() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do estilo.");
      return;
    }
    if (styleTotal(form) !== form.players_per_team) {
      toast.error("O total de jogadores na formação não bate com jogadores por time.");
      return;
    }
    try {
      if (editingId) {
        await mutations.update.mutateAsync({ ...form, id: editingId, section_id: sectionId });
      } else {
        await mutations.create.mutateAsync(form);
      }
      toast.success(editingId ? "Estilo atualizado." : "Estilo criado.");
      closeDialog();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await mutations.remove.mutateAsync(pendingDelete.id);
      toast.success("Estilo excluído.");
      setPendingDelete(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const total = styleTotal(form);
  const slots = buildFormation({
    hasGoalkeeper: form.has_goalkeeper,
    defenders: form.defenders,
    midfielders: form.midfielders,
    attackers: form.attackers,
  });

  const usedCountForStyle = (styleId: string) =>
    scheduledEvents.data?.filter((e) => e.game_style_id === styleId).length ?? 0;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold uppercase tracking-wide">
            Estilos de jogo
          </h3>
          <p className="text-sm text-muted-foreground">Formações personalizadas para esta seção.</p>
        </div>
        {isAdmin && (
          <Button type="button" size="sm" onClick={() => openDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Novo estilo
          </Button>
        )}
      </div>

      {query.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Carregando estilos...</p>
      ) : query.error ? (
        <p className="mt-3 text-sm text-destructive">Não foi possível carregar os estilos.</p>
      ) : query.data?.length ? (
        <div className="mt-3 space-y-2">
          {query.data.map((style) => (
            <article
              key={style.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <h4 className="font-semibold">{style.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {style.players_per_team} por time ·{" "}
                  {style.has_goalkeeper ? "com goleiro" : "sem goleiro"} · {style.defenders}D-
                  {style.midfielders}M-{style.attackers}A
                </p>
              </div>
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Opções para ${style.name}`}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openDialog(style)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setPendingDelete(style)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum estilo personalizado cadastrado.
        </p>
      )}

      {/* ── Pop-up de criar/editar estilo ─────────────────────────────────── */}
      {isAdmin && (
        <ResponsiveDialog
          open={dialogoAberto}
          onOpenChange={(open) => !open && closeDialog()}
          title={editingId ? "Editar estilo" : "Novo estilo de jogo"}
          description="Configure a formação e o número de jogadores por time."
          dirty={isDirty}
          footer={({ requestClose }) => (
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={requestClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={
                  total !== form.players_per_team ||
                  mutations.create.isPending ||
                  mutations.update.isPending
                }
                onClick={() => void save()}
              >
                {editingId ? "Salvar alterações" : "Criar estilo"}
              </Button>
            </div>
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2 [&>div]:min-w-0">
            <div className="space-y-2">
              <Label htmlFor="style-name">Nome</Label>
              <Input
                id="style-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={40}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="style-size">Jogadores por time</Label>
              <Input
                id="style-size"
                type="number"
                min={2}
                max={11}
                value={form.players_per_team}
                onChange={(e) => setForm({ ...form, players_per_team: Number(e.target.value) })}
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.has_goalkeeper}
                onChange={(e) => setForm({ ...form, has_goalkeeper: e.target.checked })}
              />{" "}
              Com goleiro
            </label>
            {(["defenders", "midfielders", "attackers"] as const).map((key) => (
              <div className="space-y-2" key={key}>
                <Label htmlFor={`style-${key}`}>
                  {key === "defenders"
                    ? "Defensores"
                    : key === "midfielders"
                      ? "Meias"
                      : "Atacantes"}
                </Label>
                <Input
                  id={`style-${key}`}
                  type="number"
                  min={0}
                  max={11}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <p
                className={`text-sm font-semibold ${total === form.players_per_team ? "text-primary" : "text-destructive"}`}
              >
                Total calculado: {total}/{form.players_per_team}
              </p>
              {total !== form.players_per_team && (
                <p className="text-sm text-destructive">
                  Faltam {Math.max(0, form.players_per_team - total)} jogadores na formação.
                </p>
              )}
              <div className="relative mt-3 h-32 rounded-lg border-2 border-white/50 bg-emerald-800">
                {slots.map((slot) => (
                  <span
                    key={slot.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-black/80 px-1 text-[9px] text-white"
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  >
                    {slot.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </ResponsiveDialog>
      )}

      {/* ── AlertDialog excluir estilo ────────────────────────────────────── */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir &ldquo;{pendingDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const used = pendingDelete ? usedCountForStyle(pendingDelete.id) : 0;
                return used > 0
                  ? `${used} jogo(s) agendado(s) usam este estilo. Jogos já criados manterão seu snapshot de formação.`
                  : "Jogos já criados com este estilo manterão seu snapshot de formação.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
