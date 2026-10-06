import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, LogOut, Trophy, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { PlayerForm } from "@/components/PlayerForm";
import { PlayersGallery } from "@/components/PlayersGallery";
import { SectionHub } from "@/components/SectionHub";
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
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { getMySection } from "@/lib/sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elenco da Galera — Monte seu time" },
      {
        name: "description",
        content:
          "Monte o elenco da sua seção, crie cartas de jogadores e sorteie times equilibrados com a galera.",
      },
      { property: "og:title", content: "Elenco da Galera — Monte seu time" },
      {
        property: "og:description",
        content:
          "Monte o elenco da sua seção, crie cartas de jogadores e sorteie times equilibrados com a galera.",
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
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      queryClient.clear();
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("Unable to restore Supabase session:", error);
        toast.error("Não foi possível verificar seu login. Atualize a página e tente novamente.");
      }
      setSession(data.session);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [queryClient]);

  const sectionQuery = useQuery({
    queryKey: ["section"],
    queryFn: getMySection,
    enabled: mounted && !!session,
  });

  const section = sectionQuery.data ?? null;
  const playersQuery = useQuery({
    queryKey: ["players", section?.section_id],
    queryFn: () => listPlayers(section!.section_id),
    enabled: mounted && !!session && !!section,
  });
  const players = playersQuery.data ?? [];
  const ownPlayer = players.find((player) => player.user_id === session?.user.id) ?? null;
  const playerBeingEdited = editing ?? ownPlayer;

  async function refreshSectionData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["section"] }),
      queryClient.invalidateQueries({ queryKey: ["section-members"] }),
      queryClient.invalidateQueries({ queryKey: ["players"] }),
    ]);
  }

  const removeMutation = useMutation({
    mutationFn: (playerId: string) => deletePlayer(playerId, section!.section_id),
    onSuccess: () => {
      void refreshSectionData();
      toast.success("Jogador excluído.");
    },
    onError: () => toast.error("Não foi possível excluir o jogador."),
  });

  async function handleSubmit(input: PlayerInput) {
    if (!section) throw new Error("Entre ou crie uma seção antes de cadastrar seu jogador.");
    const saved = playerBeingEdited
      ? await updatePlayer(playerBeingEdited.id, input, section.section_id)
      : await createPlayer(input, section.section_id);
    await refreshSectionData();
    return saved;
  }

  async function handleGoogleSignIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      console.error("Google sign-in failed:", error);
      toast.error("Não foi possível iniciar o login com Google.");
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Supabase sign-out failed:", error);
      toast.error("Não foi possível sair da conta.");
    }
  }

  return (
    <div className="min-h-screen">
      <Toaster position="bottom-center" />
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-5 text-center sm:py-7">
          <h1>
            <span className="mx-auto flex w-fit items-center justify-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/60 bg-primary/10 text-primary shadow-glow-gold sm:h-14 sm:w-14">
                <UsersRound className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
              </span>
              <span className="text-left font-display text-4xl leading-none font-extrabold tracking-tight text-foreground sm:text-5xl">
                ELENCO
                <span className="block text-primary">DA GALERA</span>
              </span>
            </span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Cartas para a galera e times equilibrados sem discussão.
          </p>
          {session && (
            <div className="mt-4 flex items-center justify-center gap-3">
              {session.user.email && (
                <span className="max-w-[15rem] truncate text-xs text-muted-foreground">
                  {session.user.email}
                </span>
              )}
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
          )}
        </div>
      </header>

      {session && !authLoading && section && (
        <nav className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl gap-2 px-3 py-3">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const active = step === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (s.id === 1) setEditing(ownPlayer);
                    setStep(s.id);
                  }}
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
      )}

      {session && !authLoading && section && (
        <SectionHub section={section} onChanged={refreshSectionData} />
      )}

      <main className="mx-auto max-w-6xl px-4 py-8">
        {authLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Verificando login...</p>
        ) : !session ? (
          <section className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
            <h2 className="font-display text-2xl text-foreground">Entre para continuar</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Faça login com Google para criar ou entrar em uma seção e montar o elenco com seu
              grupo.
            </p>
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-display text-sm font-bold uppercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90"
            >
              Continuar com Google
            </button>
          </section>
        ) : sectionQuery.isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando seção...</p>
        ) : sectionQuery.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-destructive">Não foi possível carregar sua seção.</p>
            <button
              type="button"
              onClick={() => void sectionQuery.refetch()}
              className="mt-3 text-sm font-semibold text-primary underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : !section ? (
          <SectionHub section={null} onChanged={refreshSectionData} />
        ) : playersQuery.isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando jogadores...</p>
        ) : playersQuery.isError ? (
          <div className="py-12 text-center">
            <p className="text-sm text-destructive">
              Não foi possível carregar os jogadores da seção.
            </p>
            <button
              type="button"
              onClick={() => void playersQuery.refetch()}
              className="mt-3 text-sm font-semibold text-primary underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : step === 1 ? (
          <section className="animate-rise space-y-6">
            <h2 className="font-display text-2xl text-foreground">
              {playerBeingEdited
                ? `Editando ${playerBeingEdited.name}`
                : "Etapa 1 — Cadastro de jogador"}
            </h2>
            <PlayerForm
              editing={playerBeingEdited}
              onSubmit={handleSubmit}
              onDone={(saved) => {
                setEditing(saved);
                setStep(2);
              }}
              onCancelEdit={() => {
                setEditing(null);
                setStep(2);
              }}
            />
          </section>
        ) : step === 2 ? (
          <section className="animate-rise space-y-6">
            <h2 className="font-display text-2xl text-foreground">Etapa 2 — Lista de jogadores</h2>
            <PlayersGallery
              players={players}
              currentUserId={session.user.id}
              onEdit={(p) => {
                setEditing(p);
                setStep(1);
              }}
              onDelete={(p) => removeMutation.mutate(p.id)}
            />
          </section>
        ) : (
          <section className="animate-rise space-y-6">
            <h2 className="font-display text-2xl text-foreground">Etapa 3 — Gerar times</h2>
            <TeamsStep players={players} />
          </section>
        )}
      </main>

      <footer className="border-t border-border/60 py-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        ELENCO DA GALERA
      </footer>
    </div>
  );
}
