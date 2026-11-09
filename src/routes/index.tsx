import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, ClipboardList, LogOut, Trophy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { EventsStep } from "@/components/EventsStep";
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
import { useGameStyles } from "@/lib/game-style-queries";
import { clearPersistedQueryCache, persistQueriesForUser } from "@/lib/query-persistence";
import { clearUserDrafts } from "@/lib/draft-storage";
import { clearDraws } from "@/lib/draw-storage";
import {
  getConfirmedAttendance,
  type AttendanceStatus,
  type EventAttendance,
  type NewFootballEvent,
} from "@/lib/events";
import {
  createFootballEvent,
  updateFootballEvent,
  cancelFootballEvent,
  reactivateFootballEvent,
  deleteFootballEvent,
  listEventAttendance,
  listSectionEvents,
  updateEventAttendance,
} from "@/lib/event-queries";

export type HomeSearch = { etapa: 1 | 2 | 3 | 4; jogo?: string; carta?: string };

export function validateHomeSearch(search: Record<string, unknown>): HomeSearch {
  const etapa = Number(search["etapa"]);
  return {
    etapa: etapa === 2 || etapa === 3 || etapa === 4 ? etapa : 1,
    ...(typeof search["jogo"] === "string" && /^[0-9a-f-]{8,}$/i.test(search["jogo"])
      ? { jogo: search["jogo"] }
      : {}),
    ...(search["carta"] === "novo" ||
    (typeof search["carta"] === "string" && /^[0-9a-f-]{8,}$/i.test(search["carta"]))
      ? { carta: search["carta"] }
      : {}),
  };
}

export const Route = createFileRoute("/")({
  validateSearch: validateHomeSearch,
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
  { id: 3, label: "Presença", icon: CalendarCheck },
  { id: 4, label: "Times", icon: Trophy },
] as const;

const EMPTY_PLAYERS: Player[] = [];
const EMPTY_ATTENDANCE: EventAttendance[] = [];

function isMissingDatabaseTable(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "PGRST205" || error.code === "42P01")
  );
}

function Index() {
  const navigate = useNavigate({ from: "/" });
  const search = Route.useSearch();
  const step = search.etapa;
  const [editing, setEditing] = useState<Player | null>(null);
  const creatingNew = search.carta === "novo";
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      if (_event === "SIGNED_OUT" || _event === "USER_UPDATED") {
        queryClient.clear();
        clearPersistedQueryCache(session?.user.id);
        if (session?.user.id) {
          clearUserDrafts(session.user.id);
          clearDraws();
        }
      }
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
  }, [queryClient, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;
    if (previousUserId.current && previousUserId.current !== session.user.id) {
      queryClient.clear();
      clearPersistedQueryCache(previousUserId.current);
      clearUserDrafts(previousUserId.current);
      clearDraws();
    }
    previousUserId.current = session.user.id;
    return persistQueriesForUser(queryClient, session.user.id);
  }, [queryClient, session?.user.id]);

  const sectionQuery = useQuery({
    queryKey: ["section"],
    queryFn: getMySection,
    enabled: !!session,
    staleTime: 5 * 60_000,
  });

  const section = sectionQuery.data ?? null;
  const gameStylesQuery = useGameStyles(section?.section_id);
  const playersQuery = useQuery({
    queryKey: ["players", section?.section_id],
    queryFn: () => listPlayers(section!.section_id),
    enabled: !!session && !!section,
    staleTime: 5 * 60_000,
  });
  const players = playersQuery.data ?? EMPTY_PLAYERS;
  const eventsQuery = useQuery({
    queryKey: ["section-events", section?.section_id],
    queryFn: () => listSectionEvents(section!.section_id, section!.is_admin),
    enabled: !!session && !!section,
    refetchInterval: 15_000,
  });
  const events = eventsQuery.data ?? [];
  const selectedEventId = search.jogo ?? null;
  const setSelectedEventId = (id: string | null) => {
    void navigate({
      search: (previous) => {
        const { jogo: _jogo, ...rest } = previous;
        return id ? { ...rest, jogo: id } : rest;
      },
    });
  };

  useEffect(() => {
    if (!eventsQuery.data) return;
    if (search.jogo && eventsQuery.data.some((event) => event.id === search.jogo)) return;
    const next = eventsQuery.data[0]?.id ?? null;
    if (next !== search.jogo) setSelectedEventId(next);
  }, [eventsQuery.data, search.jogo]);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const attendanceQuery = useQuery({
    queryKey: ["event-attendance", selectedEvent?.id],
    queryFn: () => listEventAttendance(selectedEvent!.id),
    enabled: !!session && !!selectedEvent,
    refetchInterval: 10_000,
  });
  const attendance = attendanceQuery.data ?? EMPTY_ATTENDANCE;
  const confirmedPlayers = useMemo(() => {
    const playersById = new Map(players.map((player) => [player.id, player]));
    return getConfirmedAttendance(attendance)
      .map((row) => playersById.get(row.player_id))
      .filter((player): player is Player => player !== undefined);
  }, [attendance, players]);
  const handleCreateEvent = useCallback(
    async (event: NewFootballEvent) => {
      const eventId = await createFootballEvent(event);
      await queryClient.invalidateQueries({ queryKey: ["section-events", event.section_id] });
      setSelectedEventId(eventId);
    },
    [queryClient],
  );
  const refreshEvents = useCallback(
    async () =>
      queryClient.invalidateQueries({ queryKey: ["section-events", section?.section_id] }),
    [queryClient, section?.section_id],
  );
  const handleUpdateEvent = useCallback(
    async (event: NewFootballEvent & { id: string }) => {
      await updateFootballEvent(event);
      await refreshEvents();
      await queryClient.invalidateQueries({ queryKey: ["event-attendance", event.id] });
    },
    [queryClient, refreshEvents],
  );
  const handleEventAction = useCallback(
    async (action: () => Promise<void>, eventId: string, clearSelection = false) => {
      await action();
      await refreshEvents();
      await queryClient.invalidateQueries({ queryKey: ["event-attendance", eventId] });
      if (clearSelection && selectedEventId === eventId) setSelectedEventId(null);
    },
    [queryClient, refreshEvents, selectedEventId],
  );
  const ownPlayer = players.find((player) => player.user_id === session?.user.id) ?? null;
  const isAdmin = section?.is_admin ?? false;
  const playerFromUrl =
    search.carta && search.carta !== "novo"
      ? (players.find((player) => player.id === search.carta) ?? null)
      : null;
  const playerBeingEdited = creatingNew ? null : (playerFromUrl ?? editing ?? ownPlayer);

  async function refreshSectionData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["section"] }),
      queryClient.invalidateQueries({ queryKey: ["section-members"] }),
      queryClient.invalidateQueries({ queryKey: ["players"] }),
      queryClient.invalidateQueries({ queryKey: ["event-attendance"] }),
    ]);
  }

  const removeMutation = useMutation({
    mutationFn: (playerId: string) => deletePlayer(playerId, section!.section_id),
    onSuccess: () => {
      void refreshSectionData();
      toast.success("Jogador excluído.");
    },
    onError: (error) => {
      console.error("Player deletion failed:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o jogador.");
    },
  });

  async function handleSubmit(input: PlayerInput) {
    if (!section) throw new Error("Entre ou crie uma seção antes de cadastrar seu jogador.");
    const saved = playerBeingEdited
      ? await updatePlayer(playerBeingEdited.id, input, section.section_id)
      : await createPlayer(input, section.section_id, {
          // Administrador adicionando um jogador extra: não fica vinculado a ninguém.
          linkToSelf: !(isAdmin && creatingNew),
        });
    if (playerBeingEdited?.photo_url && playerBeingEdited.photo_url === saved.photo_url) {
      await queryClient.invalidateQueries({
        queryKey: ["player-photo-signed-url", playerBeingEdited.photo_url],
      });
    }
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
    <div className="min-h-dvh">
      <Toaster position="bottom-center" className="pb-[env(safe-area-inset-bottom)]" />
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-5 text-center sm:py-7">
          <h1>
            <span className="mx-auto flex w-fit items-center justify-center gap-3">
              <img
                src="/elenco-da-galera.jpg"
                alt=""
                aria-hidden="true"
                className="h-14 w-14 rounded-2xl object-cover shadow-glow-gold sm:h-16 sm:w-16"
              />
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
        <nav className="sticky top-0 z-20 border-b border-border/60 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="scrollbar-none mx-auto flex min-w-0 max-w-6xl gap-2 overflow-x-auto px-[max(0.75rem,env(safe-area-inset-left))] py-3 pr-[max(0.75rem,env(safe-area-inset-right))]">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const active = step === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (s.id === 1) {
                      setEditing(ownPlayer);
                    }
                    void navigate({ search: (previous) => ({ ...previous, etapa: s.id }) });
                  }}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-display font-bold uppercase tracking-wide transition-all sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-glow-gold"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="min-w-0 max-w-full truncate">
                    <span className="sm:hidden">{s.label}</span>
                    <span className="hidden sm:inline">
                      {s.id}. {s.label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {session && !authLoading && section && (
        <SectionHub section={section} onChanged={refreshSectionData} />
      )}

      <main className="mx-auto max-w-6xl min-w-0 px-[max(1rem,env(safe-area-inset-left))] py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))]">
        {authLoading ? (
          <div className="space-y-4 py-12" aria-label="Carregando">
            <div className="mx-auto h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="mx-auto h-24 max-w-md animate-pulse rounded-2xl bg-muted" />
          </div>
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
              {isMissingDatabaseTable(playersQuery.error)
                ? "O banco de dados ainda não foi atualizado. Aplique a migration section_players para carregar os jogadores."
                : "Não foi possível carregar os jogadores da seção."}
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
              canCancel={creatingNew}
              onSubmit={handleSubmit}
              draftKey={
                session?.user.id && section
                  ? `draft:v1:${session.user.id}:${section.section_id}:player:${creatingNew ? "new" : (playerBeingEdited?.id ?? "self")}`
                  : undefined
              }
              onDone={(saved) => {
                setEditing(saved);
                void navigate({
                  search: (previous) => {
                    const { carta: _carta, ...rest } = previous;
                    return { ...rest, etapa: 2 };
                  },
                });
              }}
              onCancelEdit={() => {
                setEditing(null);
                void navigate({
                  search: (previous) => {
                    const { carta: _carta, ...rest } = previous;
                    return { ...rest, etapa: 2 };
                  },
                });
              }}
            />
          </section>
        ) : step === 2 ? (
          <section className="animate-rise space-y-6">
            <h2 className="font-display text-2xl text-foreground">Etapa 2 — Lista de jogadores</h2>
            <PlayersGallery
              players={players}
              currentUserId={session.user.id}
              isAdmin={isAdmin}
              onAdd={() => {
                setEditing(null);
                void navigate({ search: (previous) => ({ ...previous, etapa: 1, carta: "novo" }) });
              }}
              onEdit={(p) => {
                setEditing(p);
                void navigate({ search: (previous) => ({ ...previous, etapa: 1, carta: p.id }) });
              }}
              onDelete={(p) => removeMutation.mutate(p.id)}
            />
          </section>
        ) : step === 3 ? (
          <EventsStep
            sectionId={section.section_id}
            players={players}
            currentUserId={session.user.id}
            isAdmin={isAdmin}
            events={events}
            selectedEventId={selectedEventId}
            attendance={attendance}
            eventsLoading={eventsQuery.isLoading}
            eventsError={eventsQuery.isError}
            eventsErrorMessage={
              isMissingDatabaseTable(eventsQuery.error)
                ? "Aplique as migrations de eventos e presença no Supabase para habilitar os jogos."
                : "Não foi possível carregar os jogos."
            }
            attendanceLoading={attendanceQuery.isLoading}
            attendanceError={attendanceQuery.isError}
            attendanceErrorMessage={
              isMissingDatabaseTable(attendanceQuery.error)
                ? "Aplique as migrations de eventos e presença no Supabase para habilitar as presenças."
                : "Não foi possível carregar as presenças."
            }
            onSelectEvent={setSelectedEventId}
            onCreateEvent={handleCreateEvent}
            onUpdateEvent={handleUpdateEvent}
            onCancelEvent={(eventId) =>
              handleEventAction(() => cancelFootballEvent(eventId), eventId)
            }
            onReactivateEvent={(eventId) =>
              handleEventAction(() => reactivateFootballEvent(eventId), eventId)
            }
            onDeleteEvent={(eventId) =>
              handleEventAction(() => deleteFootballEvent(eventId), eventId, true)
            }
            onSetAttendance={async (eventId, playerId, status: AttendanceStatus) => {
              await updateEventAttendance(eventId, playerId, status);
              await queryClient.invalidateQueries({ queryKey: ["event-attendance", eventId] });
            }}
            onRefreshEvents={() => void eventsQuery.refetch()}
            onRefreshAttendance={() => void attendanceQuery.refetch()}
            gameStyles={gameStylesQuery.data ?? []}
            draftKey={
              session?.user.id && section
                ? `draft:v1:${session.user.id}:${section.section_id}:event:${selectedEventId ?? "new"}`
                : undefined
            }
          />
        ) : (
          <section className="animate-rise space-y-6">
            <TeamsStep
              event={selectedEvent}
              confirmedPlayers={confirmedPlayers}
              attendanceLoading={attendanceQuery.isLoading}
              attendanceError={attendanceQuery.isError}
            />
          </section>
        )}
      </main>

      <footer className="border-t border-border/60 py-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        ELENCO DA GALERA
      </footer>
    </div>
  );
}
