import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Trophy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { PlayerForm } from "@/components/PlayerForm";
import { PlayersGallery } from "@/components/PlayersGallery";
import { TeamsStep } from "@/components/TeamsStep";
import {
  createPlayer,
  deletePlayer,
  listPlayers,
  updatePlayer,
  type PlayerInput,
} from "@/lib/player-queries";
import type { Player } from "@/lib/players";
import { cn } from "@/lib/utils";
import leagueLogo from "@/assets/uefa-c6-league-logo-display.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
       { title: "UEFA C6 LEAGUE — Cartas e times equilibrados" },
      {
        name: "description",
        content:
          "Cadastre os jogadores da sua pelada, gere cartas com overall por posição e sorteie times equilibrados em segundos.",
      },
       { property: "og:title", content: "UEFA C6 LEAGUE — Cartas e times equilibrados" },
      {
        property: "og:description",
        content:
          "Cadastre jogadores, veja a carta de cada um e sorteie times equilibrados para a pelada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STEPS = [
  { id: 1, label: "Cadastro", icon: UserPlus },
  { id: 2, label: "Jogadores", icon: ClipboardList },
  { id: 3, label: "Times", icon: Trophy },
] as const;

function Index() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [editing, setEditing] = useState<Player | null>(null);
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => setMounted(true), []);

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: listPlayers,
    enabled: mounted,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["players"] });

  const removeMutation = useMutation({
    mutationFn: deletePlayer,
    onSuccess: () => {
      invalidate();
      toast.success("Jogador excluído.");
    },
    onError: () => toast.error("Não foi possível excluir o jogador."),
  });

  async function handleSubmit(input: PlayerInput) {
    const saved = editing ? await updatePlayer(editing.id, input) : await createPlayer(input);
    await invalidate();
    return saved;
  }

  return (
    <div className="min-h-screen">
      <Toaster position="bottom-center" />
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
         <div className="mx-auto max-w-6xl px-4 py-5 text-center sm:py-7">
           <h1>
             <img
               src={leagueLogo}
               alt="UEFA C6 LEAGUE"
               width={1264}
               height={391}
               className="mx-auto h-auto w-full max-w-[25rem]"
             />
           </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Cartas para a galera e times equilibrados sem discussão.
          </p>
        </div>
      </header>

      <nav className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 px-3 py-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-display text-sm font-bold uppercase tracking-wide transition-all",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-glow-gold"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {s.id}. {s.label}
                </span>
                <span className="sm:hidden">{s.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {step === 1 && (
          <section className="animate-rise space-y-6">
            <h2 className="font-display text-2xl text-foreground">
              {editing ? `Editando ${editing.name}` : "Etapa 1 — Cadastro de jogadores"}
            </h2>
            <PlayerForm
              editing={editing}
              onSubmit={handleSubmit}
              onDone={() => {
                if (editing) {
                  setEditing(null);
                  setStep(2);
                }
              }}
              onCancelEdit={() => {
                setEditing(null);
                setStep(2);
              }}
            />
          </section>
        )}

        {step === 2 && (
          <section className="animate-rise space-y-6">
            <h2 className="font-display text-2xl text-foreground">Etapa 2 — Lista de jogadores</h2>
            <PlayersGallery
              players={players}
              onEdit={(p) => {
                setEditing(p);
                setStep(1);
              }}
              onDelete={(p) => removeMutation.mutate(p.id)}
            />
          </section>
        )}

        {step === 3 && (
          <section className="animate-rise space-y-6">
            <h2 className="font-display text-2xl text-foreground">Etapa 3 — Gerar times</h2>
            <TeamsStep players={players} />
          </section>
        )}
      </main>

      <footer className="border-t border-border/60 py-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        UEFA C6 LEAGUE
      </footer>
    </div>
  );
}
