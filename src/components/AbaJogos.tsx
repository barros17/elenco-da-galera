import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  LocateFixed,
  MapPin,
  MoreHorizontal,
  Navigation,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { TeamsStep } from "@/components/TeamsStep";
import type { Player } from "@/lib/players";
import type { GameStyle } from "@/lib/game-style-queries";
import { eventActions } from "@/lib/event-management";
import {
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
  hasOnlyShortMapLink,
  INVALID_GOOGLE_MAPS_LINK_MESSAGE,
  isAllowedGoogleMapsLink,
  isGenericGoogleMapsLink,
} from "@/lib/event-location";
import {
  type AttendanceStatus,
  type EventAttendance,
  type FootballEvent,
  type GameModality,
  type NewFootballEvent,
  MODALITY_LABELS,
} from "@/lib/events";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft-storage";
import type { AppSearch } from "@/routes/index";

// ─── Tipos e helpers ──────────────────────────────────────────────────────────

type Props = {
  sectionId: string;
  players: Player[];
  currentUserId: string;
  isAdmin: boolean;
  events: FootballEvent[];
  selectedEventId: string | null;
  attendance: EventAttendance[];
  eventsLoading: boolean;
  eventsError: boolean;
  eventsErrorMessage: string;
  attendanceLoading: boolean;
  attendanceError: boolean;
  attendanceErrorMessage: string;
  confirmedPlayers: Player[];
  gameStyles: GameStyle[];
  search: AppSearch;
  onSelectEvent: (id: string | null) => void;
  onCreateEvent: (event: NewFootballEvent) => Promise<void>;
  onUpdateEvent: (event: NewFootballEvent & { id: string }) => Promise<void>;
  onCancelEvent: (eventId: string) => Promise<void>;
  onReactivateEvent: (eventId: string) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onSetAttendance: (eventId: string, playerId: string, status: AttendanceStatus) => Promise<void>;
  onNavigate: (params: Partial<AppSearch>) => void;
  onCloseDialog: () => void;
  draftKey?: string;
};

const MODALITIES: Array<{ value: GameModality; label: string }> = [
  { value: "futsal", label: "Futsal" },
  { value: "fut7", label: "Fut7" },
  { value: "campo11", label: "Futebol de campo" },
];

function localDateTimeValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function statusLabel(status: AttendanceStatus): string {
  if (status === "CONFIRMED") return "Vai";
  if (status === "DECLINED") return "Não vai";
  return "Aguardando";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.";
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AbaJogos({
  sectionId,
  players,
  currentUserId,
  isAdmin,
  events,
  selectedEventId,
  attendance,
  eventsLoading,
  eventsError,
  eventsErrorMessage,
  attendanceLoading,
  attendanceError,
  attendanceErrorMessage,
  confirmedPlayers,
  gameStyles,
  search,
  onSelectEvent,
  onCreateEvent,
  onUpdateEvent,
  onCancelEvent,
  onReactivateEvent,
  onDeleteEvent,
  onSetAttendance,
  onNavigate,
  onCloseDialog,
  draftKey,
}: Props) {
  // ─── Visão: lista ou detalhe ──────────────────────────────────────────────
  const selectedEvent = selectedEventId
    ? (events.find((e) => e.id === selectedEventId) ?? null)
    : null;

  // Se selectedEventId existe mas não tem evento correspondente, volta para lista
  useEffect(() => {
    if (selectedEventId && events.length > 0 && !selectedEvent) {
      toast.error("Jogo não encontrado ou sem permissão.");
      onSelectEvent(null);
    }
  }, [selectedEventId, selectedEvent, events.length, onSelectEvent]);

  const visao = search.visao ?? "presenca";

  // ─── Estado do formulário de jogo ─────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(() =>
    localDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  );
  const [endsAt, setEndsAt] = useState(() =>
    localDateTimeValue(new Date(Date.now() + 26 * 60 * 60 * 1000)),
  );
  const [modality, setModality] = useState<GameModality>("futsal");
  const [gameStyleId, setGameStyleId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationLink, setLocationLink] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [editingOriginalFormat, setEditingOriginalFormat] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"cancel" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [canceledOpen, setCanceledOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Pop-up de jogo via URL
  const jogoDialogo = search.dialogo;
  const isEventDialogOpen = jogoDialogo === "novo-jogo" || jogoDialogo === "editar-jogo";
  const editingEventId = jogoDialogo === "editar-jogo" ? (search.id ?? null) : null;

  // ─── Rascunho do form de jogo ─────────────────────────────────────────────
  useEffect(() => {
    if (!draftKey || isEventDialogOpen) return;
    const draft = loadDraft<{
      title: string;
      startsAt: string;
      endsAt: string;
      modality: GameModality;
      gameStyleId: string | null;
      locationName: string;
      locationAddress: string;
      locationLink: string;
    }>(draftKey);
    if (!draft) return;
    setTitle(draft.title);
    setStartsAt(draft.startsAt);
    setEndsAt(draft.endsAt);
    setModality(draft.modality);
    setGameStyleId(draft.gameStyleId);
    setLocationName(draft.locationName);
    setLocationAddress(draft.locationAddress);
    setLocationLink(draft.locationLink);
  }, [draftKey, isEventDialogOpen]);

  useEffect(() => {
    if (!draftKey) return;
    saveDraft(draftKey, {
      title,
      startsAt,
      endsAt,
      modality,
      gameStyleId,
      locationName,
      locationAddress,
      locationLink,
    });
  }, [
    draftKey,
    title,
    startsAt,
    endsAt,
    modality,
    gameStyleId,
    locationName,
    locationAddress,
    locationLink,
  ]);

  // ─── Abrir pop-up de edição (preenche form com dados do evento) ───────────
  useEffect(() => {
    if (!editingEventId) return;
    const event = events.find((e) => e.id === editingEventId);
    if (!event) return;
    setTitle(event.title);
    setStartsAt(localDateTimeValue(new Date(event.starts_at)));
    setEndsAt(localDateTimeValue(new Date(event.ends_at)));
    setModality(event.modality);
    setGameStyleId(event.game_style_id);
    setLocationName(event.location_name ?? "");
    setLocationAddress(event.location_address ?? "");
    setLocationLink(event.location_link ?? "");
    setLocationLat(event.location_lat);
    setLocationLng(event.location_lng);
    setEditingOriginalFormat(`${event.modality}:${event.game_style_id ?? ""}`);
    setLocationOpen(!!(event.location_name || event.location_address || event.location_link));
  }, [editingEventId, events]);

  function resetForm() {
    if (draftKey) clearDraft(draftKey);
    setTitle("");
    setModality("futsal");
    setGameStyleId(null);
    setLocationName("");
    setLocationAddress("");
    setLocationLink("");
    setLocationLat(null);
    setLocationLng(null);
    setEditingOriginalFormat(null);
    setLocationOpen(false);
    setFormDirty(false);
  }

  function openNovoJogo() {
    resetForm();
    onNavigate({ dialogo: "novo-jogo" });
    setTimeout(() => titleInputRef.current?.focus(), 50);
  }

  function openEditarJogo(eventId: string) {
    setFormDirty(false);
    onNavigate({ dialogo: "editar-jogo", id: eventId });
  }

  function closeJogoDialog() {
    onCloseDialog();
  }

  // ─── Form validation & submit ─────────────────────────────────────────────
  const formatChanged =
    editingEventId !== null &&
    editingOriginalFormat !== null &&
    editingOriginalFormat !== `${modality}:${gameStyleId ?? ""}` &&
    attendance.length > 0;

  const isFormDirty = formDirty;

  async function saveEvent() {
    if (!title.trim()) {
      toast.error("Informe o nome do jogo.");
      return;
    }
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      toast.error("O horário de término precisa ser depois do início.");
      return;
    }
    if (modality === "custom" && !gameStyleId) {
      toast.error("Selecione um estilo personalizado.");
      return;
    }
    if (locationLink.trim() && !isAllowedGoogleMapsLink(locationLink)) {
      toast.error(INVALID_GOOGLE_MAPS_LINK_MESSAGE);
      return;
    }
    if ((locationLat === null) !== (locationLng === null)) {
      toast.error("Latitude e longitude precisam ser informadas juntas.");
      return;
    }

    setBusy(true);
    try {
      const input: NewFootballEvent = {
        section_id: sectionId,
        title: title.trim(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        modality,
        game_style_id: modality === "custom" ? gameStyleId : null,
        location_name: locationName.trim() || null,
        location_address: locationAddress.trim() || null,
        location_link: locationLink.trim() || null,
        location_lat: locationLat,
        location_lng: locationLng,
      };
      if (editingEventId) {
        await onUpdateEvent({ ...input, id: editingEventId });
        toast.success("Jogo atualizado.");
      } else {
        await onCreateEvent(input);
        toast.success("Jogo criado. A galera já pode confirmar presença.");
      }
      resetForm();
      closeJogoDialog();
    } catch (error) {
      console.error("Event save failed:", error);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  // ─── Localização ─────────────────────────────────────────────────────────
  function useMyLocation() {
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      toast.error("A localização exige um contexto seguro (HTTPS).");
      return;
    }
    if (!navigator.geolocation) {
      toast.error("A geolocalização não está disponível neste dispositivo.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLat(Number(pos.coords.latitude.toFixed(7)));
        setLocationLng(Number(pos.coords.longitude.toFixed(7)));
        toast.success("Localização preenchida. Confirme as coordenadas antes de salvar.");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) toast.error("Permissão de localização negada.");
        else if (err.code === err.TIMEOUT) toast.error("Tempo esgotado ao obter sua localização.");
        else toast.error("Não foi possível obter sua localização.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function clearLocation() {
    setLocationLat(null);
    setLocationLng(null);
    toast.success("Coordenadas removidas.");
  }

  // ─── Ações do evento ──────────────────────────────────────────────────────
  async function runPendingAction() {
    if (!selectedEvent || !pendingAction) return;
    setBusy(true);
    try {
      if (pendingAction === "cancel") {
        await onCancelEvent(selectedEvent.id);
        toast.success("Jogo cancelado.");
      } else {
        await onDeleteEvent(selectedEvent.id);
        toast.success("Jogo excluído.");
        onSelectEvent(null);
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function reactivate() {
    if (!selectedEvent) return;
    setBusy(true);
    try {
      await onReactivateEvent(selectedEvent.id);
      toast.success("Jogo reativado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function updateAttendance(playerId: string, status: AttendanceStatus) {
    if (!selectedEvent) return;
    setBusy(true);
    try {
      await onSetAttendance(selectedEvent.id, playerId, status);
    } catch (error) {
      console.error("Attendance update failed:", error);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const attendanceByPlayerId = new Map(attendance.map((row) => [row.player_id, row]));
  const ownPlayer = players.find((p) => p.user_id === currentUserId) ?? null;
  const ownAttendance = ownPlayer
    ? (attendanceByPlayerId.get(ownPlayer.id) ?? undefined)
    : undefined;
  const confirmedCount = attendance.filter((row) => row.status === "CONFIRMED").length;
  const declinedCount = attendance.filter((row) => row.status === "DECLINED").length;
  const pendingCount = attendance.filter((row) => row.status === "PENDING").length;

  // ─── Lista de jogos ───────────────────────────────────────────────────────
  const now = Date.now();
  const scheduledEvents = events.filter((e) => e.status === "scheduled");
  const upcomingEvents = scheduledEvents.filter((e) => new Date(e.ends_at).getTime() >= now);
  const pastEvents = scheduledEvents.filter((e) => new Date(e.ends_at).getTime() < now);
  const canceledEvents = events.filter((e) => e.status === "canceled");
  const nextEvent = upcomingEvents[0] ?? null;
  const otherScheduled = upcomingEvents.slice(1);

  // ─── Render: visão lista ──────────────────────────────────────────────────
  if (!selectedEvent) {
    return (
      <section className="space-y-6 animate-rise">
        <h1 className="sr-only">Jogos</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold text-foreground">Jogos</h2>
          {isAdmin && (
            <Button onClick={openNovoJogo}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo jogo
            </Button>
          )}
        </div>

        {eventsLoading ? (
          <p className="text-sm text-muted-foreground">Carregando jogos...</p>
        ) : eventsError ? (
          <div>
            <p className="text-sm text-destructive">{eventsErrorMessage}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-muted-foreground">
              {isAdmin
                ? "Nenhum jogo criado ainda."
                : "O administrador ainda não criou um jogo para esta seção."}
            </p>
            {isAdmin && (
              <Button className="mt-4" onClick={openNovoJogo}>
                <Plus className="mr-1.5 h-4 w-4" />
                Criar o primeiro jogo
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Próximo jogo em destaque */}
            {nextEvent && (
              <EventCard
                event={nextEvent}
                gameStyles={gameStyles}
                onOpen={() => onSelectEvent(nextEvent.id)}
                highlighted
              />
            )}

            {/* Outros jogos agendados */}
            {otherScheduled.length > 0 && (
              <div className="space-y-2">
                {otherScheduled.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    gameStyles={gameStyles}
                    onOpen={() => onSelectEvent(event.id)}
                  />
                ))}
              </div>
            )}

            {/* Jogos anteriores */}
            {pastEvents.length > 0 && (
              <Collapsible open={canceledOpen} onOpenChange={setCanceledOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span>Anteriores ({pastEvents.length})</span>
                    {canceledOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2">
                    {pastEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        gameStyles={gameStyles}
                        onOpen={() => onSelectEvent(event.id)}
                        dimmed
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            {canceledEvents.length > 0 && (
              <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span>Cancelados ({canceledEvents.length})</span>
                    {pastOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2">
                    {canceledEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        gameStyles={gameStyles}
                        onOpen={() => onSelectEvent(event.id)}
                        dimmed
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}

        {/* Pop-up: novo jogo */}
        <EventFormDialog
          open={isEventDialogOpen}
          onOpenChange={(open) => !open && closeJogoDialog()}
          title={editingEventId ? "Editar jogo" : "Novo jogo"}
          isEditing={!!editingEventId}
          dirty={isFormDirty}
          busy={busy}
          form={{
            title,
            startsAt,
            endsAt,
            modality,
            gameStyleId,
            locationName,
            locationAddress,
            locationLink,
            locationLat,
            locationLng,
          }}
          gameStyles={gameStyles}
          formatChanged={formatChanged}
          locationOpen={locationOpen}
          titleInputRef={titleInputRef}
          onChangeTitle={(value) => {
            setFormDirty(true);
            setTitle(value);
          }}
          onChangeStartsAt={(value) => {
            setFormDirty(true);
            setStartsAt(value);
          }}
          onChangeEndsAt={(value) => {
            setFormDirty(true);
            setEndsAt(value);
          }}
          onChangeModality={(mod, styleId) => {
            setFormDirty(true);
            setModality(mod);
            setGameStyleId(styleId);
          }}
          onChangeLocationName={(value) => {
            setFormDirty(true);
            setLocationName(value);
          }}
          onChangeLocationAddress={(value) => {
            setFormDirty(true);
            setLocationAddress(value);
          }}
          onChangeLocationLink={(value) => {
            setFormDirty(true);
            setLocationLink(value);
          }}
          onToggleLocation={setLocationOpen}
          onUseMyLocation={useMyLocation}
          onClearLocation={clearLocation}
          onSave={() => void saveEvent()}
        />
      </section>
    );
  }

  // ─── Render: visão detalhe ────────────────────────────────────────────────
  return (
    <section className="space-y-5 animate-rise">
      {/* Cabeçalho do detalhe */}
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={() => onSelectEvent(null)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          aria-label="Voltar para a lista de jogos"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold text-foreground">
                {selectedEvent.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(
                  new Date(selectedEvent.starts_at),
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {selectedEvent.modality === "custom"
                    ? (gameStyles.find((s) => s.id === selectedEvent.game_style_id)?.name ??
                      "Estilo personalizado")
                    : MODALITIES.find((m) => m.value === selectedEvent.modality)?.label}
                </span>
                {selectedEvent.status === "canceled" && (
                  <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-bold text-destructive">
                    Cancelado
                  </span>
                )}
              </div>
            </div>

            {/* Menu admin */}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Opções do jogo"
                    className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {eventActions(true, selectedEvent.status).includes("edit") ? (
                    <>
                      <DropdownMenuItem onClick={() => openEditarJogo(selectedEvent.id)}>
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPendingAction("cancel")}>
                        Cancelar jogo
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onClick={() => void reactivate()} disabled={busy}>
                      Reativar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setPendingAction("delete")}
                  >
                    Excluir jogo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Seletor de visão */}
      <div className="flex gap-2">
        {(["presenca", "times"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-current={visao === v ? "page" : undefined}
            onClick={() => onNavigate({ visao: v })}
            className={
              visao === v
                ? "rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary-foreground"
                : "rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold uppercase tracking-wide text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }
          >
            {v === "presenca" ? "Presença" : "Times"}
          </button>
        ))}
      </div>

      {/* Visão Presença */}
      {visao === "presenca" && (
        <VisaoPresenca
          selectedEvent={selectedEvent}
          players={players}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          attendance={attendance}
          attendanceLoading={attendanceLoading}
          attendanceError={attendanceError}
          attendanceErrorMessage={attendanceErrorMessage}
          ownPlayer={ownPlayer}
          ownAttendance={ownAttendance}
          confirmedCount={confirmedCount}
          declinedCount={declinedCount}
          pendingCount={pendingCount}
          busy={busy}
          onUpdateAttendance={updateAttendance}
        />
      )}

      {/* Visão Times */}
      {visao === "times" && (
        <TeamsStep
          event={selectedEvent}
          confirmedPlayers={confirmedPlayers}
          attendanceLoading={attendanceLoading}
          attendanceError={attendanceError}
        />
      )}

      {/* Pop-up de edição de jogo */}
      <EventFormDialog
        open={isEventDialogOpen}
        onOpenChange={(open) => !open && closeJogoDialog()}
        title="Editar jogo"
        isEditing
        dirty={isFormDirty}
        busy={busy}
        form={{
          title,
          startsAt,
          endsAt,
          modality,
          gameStyleId,
          locationName,
          locationAddress,
          locationLink,
          locationLat,
          locationLng,
        }}
        gameStyles={gameStyles}
        formatChanged={formatChanged}
        locationOpen={locationOpen}
        titleInputRef={titleInputRef}
        onChangeTitle={(value) => {
          setFormDirty(true);
          setTitle(value);
        }}
        onChangeStartsAt={(value) => {
          setFormDirty(true);
          setStartsAt(value);
        }}
        onChangeEndsAt={(value) => {
          setFormDirty(true);
          setEndsAt(value);
        }}
        onChangeModality={(mod, styleId) => {
          setFormDirty(true);
          setModality(mod);
          setGameStyleId(styleId);
        }}
        onChangeLocationName={(value) => {
          setFormDirty(true);
          setLocationName(value);
        }}
        onChangeLocationAddress={(value) => {
          setFormDirty(true);
          setLocationAddress(value);
        }}
        onChangeLocationLink={(value) => {
          setFormDirty(true);
          setLocationLink(value);
        }}
        onToggleLocation={setLocationOpen}
        onUseMyLocation={useMyLocation}
        onClearLocation={clearLocation}
        onSave={() => void saveEvent()}
      />

      {/* AlertDialog para cancelar/excluir jogo */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === "delete" ? "Excluir jogo?" : "Cancelar jogo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === "delete"
                ? "A exclusão é irreversível e remove também todas as presenças deste jogo."
                : "O jogo ficará indisponível para presença e sorteio, mas poderá ser reativado depois."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void runPendingAction();
              }}
              disabled={busy}
            >
              {pendingAction === "delete" ? "Excluir definitivamente" : "Cancelar jogo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// ─── Componentes auxiliares ────────────────────────────────────────────────────

function EventCard({
  event,
  gameStyles,
  onOpen,
  highlighted,
  dimmed,
}: {
  event: FootballEvent;
  gameStyles: GameStyle[];
  onOpen: () => void;
  highlighted?: boolean;
  dimmed?: boolean;
}) {
  const modalityLabel =
    event.modality === "custom"
      ? (gameStyles.find((s) => s.id === event.game_style_id)?.name ?? "Estilo personalizado")
      : MODALITY_LABELS[event.modality];

  return (
    <div
      className={`rounded-2xl border bg-card transition-opacity ${
        highlighted ? "border-primary/60 shadow-glow-gold" : "border-border"
      } ${dimmed ? "opacity-60" : ""}`}
    >
      <button type="button" onClick={onOpen} className="w-full rounded-2xl p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block font-semibold text-foreground">{event.title}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(event.starts_at),
              )}{" "}
              · {modalityLabel}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {event.status === "canceled" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Cancelado
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

// ─── Visão Presença ───────────────────────────────────────────────────────────

function VisaoPresenca({
  selectedEvent,
  players,
  currentUserId,
  isAdmin,
  attendance,
  attendanceLoading,
  attendanceError,
  attendanceErrorMessage,
  ownPlayer,
  ownAttendance,
  confirmedCount,
  declinedCount,
  pendingCount,
  busy,
  onUpdateAttendance,
}: {
  selectedEvent: FootballEvent;
  players: Player[];
  currentUserId: string;
  isAdmin: boolean;
  attendance: EventAttendance[];
  attendanceLoading: boolean;
  attendanceError: boolean;
  attendanceErrorMessage: string;
  ownPlayer: Player | null;
  ownAttendance: EventAttendance | undefined;
  confirmedCount: number;
  declinedCount: number;
  pendingCount: number;
  busy: boolean;
  onUpdateAttendance: (playerId: string, status: AttendanceStatus) => Promise<void>;
}) {
  const attendanceByPlayerId = new Map(attendance.map((row) => [row.player_id, row]));
  const [filter, setFilter] = useState<"all" | "CONFIRMED" | "DECLINED" | "PENDING">("all");
  const [localOpen, setLocalOpen] = useState(false);

  const filteredPlayers =
    filter === "all"
      ? players
      : players.filter((p) => {
          const status = attendanceByPlayerId.get(p.id)?.status ?? "PENDING";
          return status === filter;
        });

  return (
    <div className="space-y-5">
      {/* Botões Vou/Não vou do próprio jogador */}
      {ownPlayer && selectedEvent.status === "scheduled" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">
            Sua presença: {ownPlayer.name}
          </p>
          {attendanceLoading ? (
            <p className="text-sm text-muted-foreground">Carregando confirmação...</p>
          ) : ownAttendance ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={ownAttendance.status === "CONFIRMED" ? "default" : "outline"}
                disabled={busy}
                onClick={() => void onUpdateAttendance(ownPlayer.id, "CONFIRMED")}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" /> Vou
              </Button>
              <Button
                size="sm"
                variant={ownAttendance.status === "DECLINED" ? "destructive" : "outline"}
                disabled={busy}
                onClick={() => void onUpdateAttendance(ownPlayer.id, "DECLINED")}
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Não vou
              </Button>
            </div>
          ) : (
            <p className="text-sm text-destructive">
              Sua confirmação não foi criada para este jogo. Peça ao administrador para atualizar a
              lista.
            </p>
          )}
        </div>
      )}

      {!ownPlayer && !isAdmin && (
        <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
          Cadastre seu jogador na seção para confirmar presença.
        </p>
      )}

      {/* Contadores como filtros */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrar por status de presença"
      >
        {(
          [
            { key: "all", label: `Todos (${players.length})` },
            { key: "CONFIRMED", label: `Vão (${confirmedCount})` },
            { key: "DECLINED", label: `Não vão (${declinedCount})` },
            { key: "PENDING", label: `Pendentes (${pendingCount})` },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? "min-h-11 rounded-full border border-primary bg-primary px-3 py-1 text-xs font-bold text-primary-foreground md:min-h-0"
                : "min-h-11 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-foreground md:min-h-0"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista de presença */}
      {attendanceLoading ? (
        <p className="text-sm text-muted-foreground">Carregando lista de presença...</p>
      ) : attendanceError ? (
        <p className="text-sm text-destructive">{attendanceErrorMessage}</p>
      ) : (
        <div className="space-y-2">
          {filteredPlayers.map((player) => {
            const row = attendanceByPlayerId.get(player.id);
            const status = row?.status ?? "PENDING";
            return (
              <div
                key={player.id}
                data-testid="attendance-row"
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div data-testid="attendance-player" className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <PlayerPhoto
                      photoUrl={player.photo_url}
                      alt=""
                      ariaHidden
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                      fallback={
                        <UserRound className="h-8 w-8 shrink-0 rounded-full bg-muted p-1.5 text-muted-foreground" />
                      }
                    />
                    <span className="block truncate text-sm font-medium">{player.name}</span>
                  </span>
                  {player.user_id === currentUserId && (
                    <span className="ml-10 text-xs text-muted-foreground">Você</span>
                  )}
                </div>
                {isAdmin && selectedEvent.status === "scheduled" ? (
                  <NativeSelect
                    data-testid="attendance-status"
                    value={status}
                    disabled={busy || !row}
                    onChange={(e) =>
                      void onUpdateAttendance(player.id, e.target.value as AttendanceStatus)
                    }
                    aria-label={`Presença de ${player.name}`}
                    className="h-10 w-auto min-w-[7.5rem] max-w-[45%] shrink-0 px-2"
                  >
                    <option value="PENDING">{statusLabel("PENDING")}</option>
                    <option value="CONFIRMED">{statusLabel("CONFIRMED")}</option>
                    <option value="DECLINED">{statusLabel("DECLINED")}</option>
                  </NativeSelect>
                ) : (
                  <span
                    data-testid="attendance-status"
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      status === "CONFIRMED"
                        ? "bg-primary/15 text-primary"
                        : status === "DECLINED"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {statusLabel(status)}
                  </span>
                )}
              </div>
            );
          })}
          {filteredPlayers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {players.length === 0
                ? "Cadastre jogadores para montar a lista de presença."
                : "Nenhum jogador neste filtro."}
            </p>
          )}
        </div>
      )}

      {/* Local (Collapsible) */}
      {(selectedEvent.location_name ||
        selectedEvent.location_address ||
        selectedEvent.location_link ||
        selectedEvent.location_lat !== null) && (
        <Collapsible open={localOpen} onOpenChange={setLocalOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/50"
            >
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Local
              </span>
              {localOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              {selectedEvent.location_name && (
                <p className="font-medium">{selectedEvent.location_name}</p>
              )}
              {selectedEvent.location_address && (
                <p className="text-sm text-muted-foreground">{selectedEvent.location_address}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {googleMapsSearchUrl(selectedEvent) && (
                  <a
                    className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm font-semibold hover:border-primary"
                    href={googleMapsSearchUrl(selectedEvent)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Google Maps
                  </a>
                )}
                {googleMapsDirectionsUrl(selectedEvent) && (
                  <a
                    className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    href={googleMapsDirectionsUrl(selectedEvent)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="mr-2 h-4 w-4" /> Como chegar
                  </a>
                )}
              </div>
              {hasOnlyShortMapLink(selectedEvent) ? (
                <p className="text-sm text-muted-foreground">
                  Adicione o endereço ou use a localização para ver o mapa aqui.
                </p>
              ) : googleMapsEmbedUrl(
                  selectedEvent,
                  import.meta.env["VITE_GOOGLE_MAPS_EMBED_KEY"],
                ) ? (
                <iframe
                  className="h-64 w-full rounded-lg border border-border"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title={`Mapa do local de ${selectedEvent.title}`}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  src={googleMapsEmbedUrl(
                    selectedEvent,
                    import.meta.env["VITE_GOOGLE_MAPS_EMBED_KEY"],
                  )!}
                />
              ) : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ─── Formulário de jogo (pop-up) ──────────────────────────────────────────────

type EventFormState = {
  title: string;
  startsAt: string;
  endsAt: string;
  modality: GameModality;
  gameStyleId: string | null;
  locationName: string;
  locationAddress: string;
  locationLink: string;
  locationLat: number | null;
  locationLng: number | null;
};

function EventFormDialog({
  open,
  onOpenChange,
  title: dialogTitle,
  isEditing,
  dirty,
  busy,
  form,
  gameStyles,
  formatChanged,
  locationOpen,
  titleInputRef,
  onChangeTitle,
  onChangeStartsAt,
  onChangeEndsAt,
  onChangeModality,
  onChangeLocationName,
  onChangeLocationAddress,
  onChangeLocationLink,
  onToggleLocation,
  onUseMyLocation,
  onClearLocation,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  isEditing: boolean;
  dirty: boolean;
  busy: boolean;
  form: EventFormState;
  gameStyles: GameStyle[];
  formatChanged: boolean;
  locationOpen: boolean;
  titleInputRef: React.RefObject<HTMLInputElement | null>;
  onChangeTitle: (v: string) => void;
  onChangeStartsAt: (v: string) => void;
  onChangeEndsAt: (v: string) => void;
  onChangeModality: (mod: GameModality, styleId: string | null) => void;
  onChangeLocationName: (v: string) => void;
  onChangeLocationAddress: (v: string) => void;
  onChangeLocationLink: (v: string) => void;
  onToggleLocation: (open: boolean) => void;
  onUseMyLocation: () => void;
  onClearLocation: () => void;
  onSave: () => void;
}) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      description={
        isEditing ? "Edite as informações do jogo." : "Preencha os dados do novo jogo da seção."
      }
      dirty={dirty}
      footer={({ requestClose }) => (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={requestClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="button" className="flex-1" onClick={onSave} disabled={busy}>
            {busy ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar jogo"}
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {/* Seção Básico */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Nome do jogo</Label>
            <Input
              id="event-title"
              ref={titleInputRef}
              value={form.title}
              onChange={(e) => onChangeTitle(e.target.value)}
              maxLength={80}
              placeholder="Pelada de sábado"
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-start">Início</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => onChangeStartsAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end">Término</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => onChangeEndsAt(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-modality">Modalidade</Label>
            <NativeSelect
              id="event-modality"
              value={form.modality === "custom" ? (form.gameStyleId ?? "custom") : form.modality}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "futsal" || v === "fut7" || v === "campo11") {
                  onChangeModality(v, null);
                } else {
                  onChangeModality("custom", v === "custom" ? null : v);
                }
              }}
            >
              {MODALITIES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {gameStyles.length > 0 && (
                <optgroup label="Estilos da seção">
                  {gameStyles.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name} ({style.players_per_team}x{style.players_per_team})
                    </option>
                  ))}
                </optgroup>
              )}
            </NativeSelect>
          </div>
          {formatChanged && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              Este jogo já tem presenças. Ao trocar o formato, será necessário gerar o sorteio
              novamente.
            </p>
          )}
        </div>

        {/* Seção Local (opcional) */}
        <Collapsible open={locationOpen} onOpenChange={onToggleLocation}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/50"
            >
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Local (opcional)
              </span>
              {locationOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4">
              <div className="space-y-2">
                <Label htmlFor="event-location-name">Nome do local</Label>
                <Input
                  id="event-location-name"
                  value={form.locationName}
                  maxLength={80}
                  onChange={(e) => onChangeLocationName(e.target.value)}
                  placeholder="Quadra do bairro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-location-address">Endereço</Label>
                <Input
                  id="event-location-address"
                  value={form.locationAddress}
                  maxLength={200}
                  onChange={(e) => onChangeLocationAddress(e.target.value)}
                  placeholder="Rua, número, cidade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-location-link">Link do Google Maps</Label>
                <Input
                  id="event-location-link"
                  type="url"
                  value={form.locationLink}
                  maxLength={500}
                  onChange={(e) => onChangeLocationLink(e.target.value)}
                  placeholder="https://maps.google.com/..."
                />
                {isGenericGoogleMapsLink(form.locationLink) && (
                  <p className="text-xs text-amber-700">
                    Esse link não aponta para um local específico. Adicione o endereço ou use sua
                    localização.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onUseMyLocation}>
                  <LocateFixed className="mr-2 h-4 w-4" /> Usar minha localização
                </Button>
                {(form.locationLat !== null || form.locationLng !== null) && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {form.locationLat ?? "—"}, {form.locationLng ?? "—"}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={onClearLocation}>
                      Limpar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </ResponsiveDialog>
  );
}
