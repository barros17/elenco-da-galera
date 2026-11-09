import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildFormation } from "@/lib/team-formations";
import { useGameStyleMutations, useGameStyles, type GameStyle } from "@/lib/game-style-queries";
import { styleTotal } from "@/lib/game-style-utils";
import { supabase } from "@/integrations/supabase/client";

type Props = { sectionId: string; isAdmin: boolean };
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

export function GameStylesPanel({ sectionId, isAdmin }: Props) {
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
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const total = styleTotal(form);
  const slots = buildFormation({
    hasGoalkeeper: form.has_goalkeeper,
    defenders: form.defenders,
    midfielders: form.midfielders,
    attackers: form.attackers,
  });

  function start(style?: GameStyle) {
    if (style) {
      setEditing(style.id);
      setForm({
        name: style.name,
        players_per_team: style.players_per_team,
        has_goalkeeper: style.has_goalkeeper,
        defenders: style.defenders,
        midfielders: style.midfielders,
        attackers: style.attackers,
      });
    } else {
      setEditing(null);
      setForm(empty);
    }
    setOpen(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (editing)
        await mutations.update.mutateAsync({ ...form, id: editing, section_id: sectionId });
      else await mutations.create.mutateAsync(form);
      toast.success(editing ? "Estilo atualizado." : "Estilo criado.");
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  async function remove(style: GameStyle) {
    const used =
      scheduledEvents.data?.filter((event) => event.game_style_id === style.id).length ?? 0;
    if (
      !window.confirm(
        `Excluir o estilo “${style.name}”? ${used > 0 ? `${used} jogo(s) agendado(s) usam este estilo. ` : ""}Jogos já criados manterão seu snapshot.`,
      )
    )
      return;
    try {
      await mutations.remove.mutateAsync(style.id);
      toast.success("Estilo excluído.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  return (
    <section className="mt-5 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold">Estilos de jogo</h3>
          <p className="text-sm text-muted-foreground">Formações personalizadas para esta seção.</p>
        </div>
        {isAdmin && (
          <Button type="button" size="sm" onClick={() => start()}>
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
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.map((style) => (
            <article key={style.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold">{style.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {style.players_per_team} por time ·{" "}
                    {style.has_goalkeeper ? "com goleiro" : "sem goleiro"}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar ${style.name}`}
                      onClick={() => start(style)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Excluir ${style.name}`}
                      onClick={() => void remove(style)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {style.defenders} defensores · {style.midfielders} meias · {style.attackers}{" "}
                atacantes
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum estilo personalizado cadastrado.
        </p>
      )}
      {open && isAdmin && (
        <form
          onSubmit={(event) => void save(event)}
          className="mt-4 grid gap-4 rounded-xl border border-primary/40 bg-primary/5 p-4 sm:grid-cols-2 [&>div]:min-w-0"
        >
          <div className="space-y-2">
            <Label htmlFor="style-name">Nome</Label>
            <Input
              id="style-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={40}
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
                {key === "defenders" ? "Defensores" : key === "midfielders" ? "Meias" : "Atacantes"}
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
          <div className="flex gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={
                total !== form.players_per_team ||
                mutations.create.isPending ||
                mutations.update.isPending
              }
            >
              Salvar estilo
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
