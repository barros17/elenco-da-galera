import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, ClipboardList, LogOut, Settings, User } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AbaSecao } from "@/components/AbaSecao";
import { AbaElenco } from "@/components/AbaElenco";
import { AbaJogos } from "@/components/AbaJogos";
import { SectionHubSemSecao } from "@/components/SectionHubSemSecao";
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
  cancelFootballEvent,
  createFootballEvent,
  deleteFootballEvent,
  listEventAttendance,
  listSectionEvents,
  reactivateFootballEvent,
  updateEventAttendance,
  updateFootballEvent,
} from "@/lib/event-queries";
import { withoutDialog } from "@/lib/navigation";

// ─── Search params ────────────────────────────────────────────────────────────

export type AppSearch = {
  aba: "jogos" | "elenco" | "secao";
  invite?: string;
  jogo?: string;
  visao?: "presenca" | "times";
  dialogo?:
    | "novo-jogo"
    | "editar-jogo"
    | "novo-jogador"
    | "editar-jogador"
    | "novo-estilo"
    | "editar-estilo"
    | "criar-secao"
    | "entrar-secao";
  id?: string;
  // legados — só usados para compatibilidade
  etapa?: number;
  carta?: string;
};

function translateLegacy(raw: Record<string, unknown>): Partial<AppSearch> {
  const etapa = Number(raw["etapa"]);
  const carta = raw["carta"];
  const result: Partial<AppSearch> = {};

  if (etapa === 1 || etapa === 2) {
    result.aba = "elenco";
    if (carta === "novo") result.dialogo = "novo-jogador";
    else if (typeof carta === "string" && /^[0-9a-f-]{8,}$/i.test(carta)) {
      result.dialogo = "editar-jogador";
      result.id = carta;
    }
  } else if (etapa === 3) {
    result.aba = "jogos";
    result.visao = "presenca";
  } else if (etapa === 4) {
    result.aba = "jogos";
    result.visao = "times";
  }
  return result;
}

export function validateSearch(raw: Record<string, unknown>): AppSearch {
  // Compatibilidade com links antigos etapa= carta=
  const hasLegacy = "etapa" in raw;
  const legacy = hasLegacy ? translateLegacy(raw) : {};

  const rawAba = raw["aba"] ?? legacy.aba;
  const aba: AppSearch["aba"] = rawAba === "elenco" || rawAba === "secao" ? rawAba : "jogos";

  const rawVisao = raw["visao"] ?? legacy.visao;
  const visao: AppSearch["visao"] =
    rawVisao === "presenca" || rawVisao === "times" ? rawVisao : undefined;

  const rawDialogo = raw["dialogo"] ?? legacy.dialogo;
  const dialogoValues = [
    "novo-jogo",
    "editar-jogo",
    "novo-jogador",
    "editar-jogador",
    "novo-estilo",
    "editar-estilo",
    "criar-secao",
    "entrar-secao",
  ] as const;
  const dialogo = dialogoValues.includes(rawDialogo as (typeof dialogoValues)[number])
    ? (rawDialogo as AppSearch["dialogo"])
    : undefined;

  const rawJogo = raw["jogo"];
  const jogo =
    typeof rawJogo === "string" && /^[0-9a-f-]{8,}$/i.test(rawJogo) ? rawJogo : undefined;

  const rawId = raw["id"] ?? legacy.id;
  const id = typeof rawId === "string" && /^[0-9a-f-]{8,}$/i.test(rawId) ? rawId : undefined;
  const rawInvite = raw["invite"];
  const invite =
    typeof rawInvite === "string" && /^[a-z0-9]{4,32}$/i.test(rawInvite)
      ? rawInvite.toUpperCase()
      : undefined;

  return {
    aba,
    ...(invite ? { invite } : {}),
    ...(visao ? { visao } : {}),
    ...(dialogo ? { dialogo } : {}),
    ...(jogo ? { jogo } : {}),
    ...(id ? { id } : {}),
  };
}

// Mantém export legado para os testes existentes
export type HomeSearch = { etapa: 1 | 2 | 3 | 4; jogo?: string; carta?: string };
export function validateHomeSearch(search: Record<string, unknown>): HomeSearch {
  const etapa = Number(search["etapa"]);
  return {
    etapa: etapa === 2 || etapa === 3 || etapa === 4 ? (etapa as 2 | 3 | 4) : 1,
    ...(typeof search["jogo"] === "string" && /^[0-9a-f-]{8,}$/i.test(search["jogo"])
      ? { jogo: search["jogo"] }
      : {}),
    ...(search["carta"] === "novo" ||
    (typeof search["carta"] === "string" && /^[0-9a-f-]{8,}$/i.test(search["carta"]))
      ? { carta: search["carta"] as string }
      : {}),
  };
}

// ─── Rota ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/")({
  validateSearch,
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

// ─── Constantes ───────────────────────────────────────────────────────────────

const ABAS = [
  { id: "jogos" as const, label: "Jogos", icon: CalendarCheck },
  { id: "elenco" as const, label: "Elenco", icon: ClipboardList },
  { id: "secao" as const, label: "Seção", icon: Settings },
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

// ─── Componente principal ─────────────────────────────────────────────────────

function Index() {
  const navigate = useNavigate({ from: "/" });
  const search = Route.useSearch();
  const aba = search.aba;

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signInLoading, setSignInLoading] = useState(false);
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null>(null);

  // ─── Auth ────────────────────────────────────────────────────────────────────

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

  // ─── Queries ─────────────────────────────────────────────────────────────────

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

  const setSelectedEventId = useCallback(
    (id: string | null) => {
      void navigate({
        search: (prev) => {
          const { jogo: _j, ...rest } = prev;
          return id ? { ...rest, jogo: id } : rest;
        },
      });
    },
    [navigate],
  );

  useEffect(() => {
    if (!eventsQuery.data || !search.jogo) return;
    if (eventsQuery.data.some((event) => event.id === search.jogo)) return;
    void navigate({
      replace: true,
      search: (prev) => {
        const { jogo: _jogo, ...rest } = prev;
        return rest;
      },
    });
  }, [eventsQuery.data, navigate, search.jogo]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const attendanceQuery = useQuery({
    queryKey: ["event-attendance", selectedEvent?.id],
    queryFn: () => listEventAttendance(selectedEvent!.id),
    enabled: !!session && !!selectedEvent,
    refetchInterval: 10_000,
  });
  const attendance = attendanceQuery.data ?? EMPTY_ATTENDANCE;

  const confirmedPlayers = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    return getConfirmedAttendance(attendance)
      .map((row) => byId.get(row.player_id))
      .filter((p): p is Player => p !== undefined);
  }, [attendance, players]);

  // ─── Mutations / handlers ────────────────────────────────────────────────────

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

  async function handleSubmitPlayer(
    input: PlayerInput,
    isAdmin: boolean,
    isNew: boolean,
  ): Promise<Player> {
    if (!section) throw new Error("Entre ou crie uma seção antes de cadastrar seu jogador.");
    const ownPlayer = players.find((p) => p.user_id === session?.user.id) ?? null;
    // Se admin e isNew, não vincula ao próprio usuário
    const editingPlayer = isNew ? null : ownPlayer;
    const saved = editingPlayer
      ? await updatePlayer(editingPlayer.id, input, section.section_id)
      : await createPlayer(input, section.section_id, {
          linkToSelf: !(isAdmin && isNew),
        });
    if (editingPlayer?.photo_url && editingPlayer.photo_url === saved.photo_url) {
      await queryClient.invalidateQueries({
        queryKey: ["player-photo-signed-url", editingPlayer.photo_url],
      });
    }
    await refreshSectionData();
    return saved;
  }

  async function handleSubmitPlayerById(id: string | null, input: PlayerInput): Promise<Player> {
    if (!section) throw new Error("Entre ou crie uma seção antes de cadastrar seu jogador.");
    const target = id ? (players.find((p) => p.id === id) ?? null) : null;
    const saved = target
      ? await updatePlayer(target.id, input, section.section_id)
      : await createPlayer(input, section.section_id, { linkToSelf: true });
    if (target?.photo_url && target.photo_url === saved.photo_url) {
      await queryClient.invalidateQueries({
        queryKey: ["player-photo-signed-url", target.photo_url],
      });
    }
    await refreshSectionData();
    return saved;
  }

  const handleCreateEvent = useCallback(
    async (event: NewFootballEvent) => {
      const eventId = await createFootballEvent(event);
      await queryClient.invalidateQueries({ queryKey: ["section-events", event.section_id] });
      setSelectedEventId(eventId);
    },
    [queryClient, setSelectedEventId],
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
    [queryClient, refreshEvents, selectedEventId, setSelectedEventId],
  );

  // ─── Auth actions ────────────────────────────────────────────────────────────

  async function handleGoogleSignIn() {
    if (signInLoading) return;
    setSignInLoading(true);
    const invite = search.invite;
    if (invite) window.sessionStorage.setItem("pending-invite", invite);
    const redirectUrl = new URL(window.location.href);
    if (invite) redirectUrl.searchParams.set("invite", invite);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl.toString() },
    });
    if (error) {
      console.error("Google sign-in failed:", error);
      toast.error("Não foi possível iniciar o login com Google.");
    }
    setSignInLoading(false);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Supabase sign-out failed:", error);
      toast.error("Não foi possível sair da conta.");
    }
  }

  // ─── Navegação ───────────────────────────────────────────────────────────────

  function goToAba(novaAba: AppSearch["aba"]) {
    void navigate({
      search: (prev) => {
        const next = withoutDialog(prev);
        const { jogo: _jogo, visao: _visao, ...rest } = next;
        return { ...rest, aba: novaAba };
      },
    });
  }

  const closeDialog = useCallback(
    () => void navigate({ search: (prev) => withoutDialog(prev) }),
    [navigate],
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  const hasSection = !!section;
  const isAdmin = section?.is_admin ?? false;
  const ownPlayer = players.find((p) => p.user_id === session?.user.id) ?? null;

  return (
    <div className="min-h-dvh">
      <Toaster position="bottom-center" className="pb-[env(safe-area-inset-bottom)]" />

      {/* ── Cabeçalho fixo ────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          {/* Logo + nome da seção (toque vai para aba Seção) */}
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            onClick={() => {
              if (session && hasSection) goToAba("secao");
            }}
            aria-label={hasSection ? "Ir para a seção" : undefined}
          >
            <img
              src="/elenco-da-galera.jpg"
              alt=""
              aria-hidden="true"
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />
            {session && !authLoading ? (
              hasSection ? (
                <span className="min-w-0 truncate font-display text-base font-bold uppercase tracking-tight text-foreground">
                  {section!.name}
                </span>
              ) : (
                <span className="font-display text-xl font-extrabold leading-none tracking-tight text-foreground">
                  ELENCO
                  <span className="text-primary"> DA GALERA</span>
                </span>
              )
            ) : (
              <span className="font-display text-xl font-extrabold leading-none tracking-tight text-foreground">
                ELENCO
                <span className="text-primary"> DA GALERA</span>
              </span>
            )}
          </button>

          {/* Menu da conta */}
          {session && !authLoading && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors hover:border-primary/50"
                  aria-label="Menu da conta"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {session.user.email && (
                  <>
                    <DropdownMenuLabel className="max-w-full truncate text-xs font-normal text-muted-foreground">
                      {session.user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => void handleSignOut()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* ── Conteúdo principal ────────────────────────────────────────────────── */}
      <main
        className={cn(
          "mx-auto max-w-6xl min-w-0 px-[max(1rem,env(safe-area-inset-left))] py-6 pr-[max(1rem,env(safe-area-inset-right))]",
          // padding inferior: barra de abas fixas no mobile (md:) + safe area
          session && hasSection ? "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8" : "pb-8",
        )}
      >
        {authLoading ? (
          <LoadingState />
        ) : !session ? (
          <LoginScreen onSignIn={handleGoogleSignIn} loading={signInLoading} />
        ) : sectionQuery.isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando seção...</p>
        ) : sectionQuery.isError ? (
          <ErrorState
            message="Não foi possível carregar sua seção."
            onRetry={() => void sectionQuery.refetch()}
          />
        ) : !section ? (
          /* Sem seção: onboarding com dois botões grandes */
          <SectionHubSemSecao
            onChanged={refreshSectionData}
            {...(search.invite ? { invite: search.invite } : {})}
            initialDialogo={
              search.dialogo === "criar-secao" || search.dialogo === "entrar-secao"
                ? search.dialogo
                : undefined
            }
            onCloseDialogo={() => closeDialog()}
            onInviteConsumed={() =>
              void navigate({
                search: (prev) => {
                  const { invite: _invite, ...rest } = prev;
                  return rest;
                },
              })
            }
          />
        ) : playersQuery.isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando jogadores...</p>
        ) : playersQuery.isError ? (
          <ErrorState
            message={
              isMissingDatabaseTable(playersQuery.error)
                ? "O banco de dados ainda não foi atualizado. Aplique a migration section_players para carregar os jogadores."
                : "Não foi possível carregar os jogadores da seção."
            }
            onRetry={() => void playersQuery.refetch()}
          />
        ) : (
          /* ── Abas ────────────────────────────────────────────────────────── */
          <>
            {aba === "jogos" && (
              <AbaJogos
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
                confirmedPlayers={confirmedPlayers}
                gameStyles={gameStylesQuery.data ?? []}
                search={search}
                onSelectEvent={setSelectedEventId}
                onCreateEvent={handleCreateEvent}
                onUpdateEvent={handleUpdateEvent}
                onCancelEvent={(id) => handleEventAction(() => cancelFootballEvent(id), id)}
                onReactivateEvent={(id) => handleEventAction(() => reactivateFootballEvent(id), id)}
                onDeleteEvent={(id) => handleEventAction(() => deleteFootballEvent(id), id, true)}
                onSetAttendance={async (eventId, playerId, status: AttendanceStatus) => {
                  await updateEventAttendance(eventId, playerId, status);
                  await queryClient.invalidateQueries({ queryKey: ["event-attendance", eventId] });
                }}
                onNavigate={(params) =>
                  void navigate({ search: (prev) => ({ ...prev, ...params }) })
                }
                onCloseDialog={closeDialog}
                {...(session.user.id && section
                  ? {
                      draftKey: `draft:v1:${session.user.id}:${section.section_id}:event:${selectedEventId ?? "new"}`,
                    }
                  : {})}
              />
            )}

            {aba === "elenco" && (
              <AbaElenco
                players={players}
                currentUserId={session.user.id}
                isAdmin={isAdmin}
                sectionId={section.section_id}
                search={search}
                onDelete={(p) => removeMutation.mutate(p.id)}
                onSubmitPlayer={handleSubmitPlayerById}
                onNavigate={(params) =>
                  void navigate({ search: (prev) => ({ ...prev, ...params }) })
                }
                onCloseDialog={closeDialog}
                {...(session.user.id && section
                  ? { draftKeyPrefix: `draft:v1:${session.user.id}:${section.section_id}` }
                  : {})}
              />
            )}

            {aba === "secao" && (
              <AbaSecao
                section={section}
                search={search}
                onChanged={refreshSectionData}
                onNavigate={(params) =>
                  void navigate({ search: (prev) => ({ ...prev, ...params }) })
                }
                onCloseDialog={closeDialog}
              />
            )}
          </>
        )}
      </main>

      {/* ── Barra de abas (mobile: fixed bottom; desktop: no header) ─────────── */}
      {session && !authLoading && hasSection && (
        <>
          {/* Mobile: barra inferior fixa */}
          <nav
            aria-label="Navegação principal"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="mx-auto flex max-w-lg px-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
              {ABAS.map((a) => {
                const Icon = a.icon;
                const active = aba === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => goToAba(a.id)}
                    className={cn(
                      "flex min-h-[3rem] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Desktop: abas acima do conteúdo (sticky abaixo do header) */}
          <nav
            aria-label="Navegação principal"
            className="sticky top-[calc(env(safe-area-inset-top)+2.75rem)] z-20 hidden border-b border-border/60 bg-background/90 backdrop-blur md:block"
          >
            <div className="mx-auto flex max-w-6xl gap-1 px-4 py-2">
              {ABAS.map((a) => {
                const Icon = a.icon;
                const active = aba === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => goToAba(a.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-glow-gold"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {a.label}
                  </button>
                );
              })}
            </div>
          </nav>
        </>
      )}

      <footer className="border-t border-border/60 py-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        ELENCO DA GALERA
      </footer>
    </div>
  );
}

// ─── Sub-componentes auxiliares ───────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-4 py-12" role="status" aria-live="polite" aria-label="Carregando">
      <div className="mx-auto h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="mx-auto h-24 max-w-md animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

function LoginScreen({ onSignIn, loading }: { onSignIn: () => void; loading: boolean }) {
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
      <img
        src="/elenco-da-galera.jpg"
        alt=""
        aria-hidden="true"
        className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover shadow-glow-gold"
      />
      <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight text-foreground">
        ELENCO
        <span className="block text-primary">DA GALERA</span>
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Cartas para a galera e times equilibrados sem discussão.
      </p>
      <button
        type="button"
        onClick={onSignIn}
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-display text-sm font-bold uppercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90"
      >
        {loading ? "Abrindo login..." : "Continuar com Google"}
      </button>
    </section>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 text-sm font-semibold text-primary underline"
      >
        Tentar novamente
      </button>
    </div>
  );
}
