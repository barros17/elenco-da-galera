import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  CircleHelp,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { PlayerPhoto } from "@/components/PlayerPhoto";
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
import type { Player } from "@/lib/players";
import type { GameStyle } from "@/lib/game-style-queries";
import { eventActions } from "@/lib/event-management";
import {
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
  hasOnlyShortMapLink,
  INVALID_GOOGLE_MAPS_LINK_MESSAGE,
  isGenericGoogleMapsLink,
  isAllowedGoogleMapsLink,
} from "@/lib/event-location";
import {
  type AttendanceStatus,
  type EventAttendance,
  type FootballEvent,
  type GameModality,
  type NewFootballEvent,
} from "@/lib/events";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft-storage";

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
  onSelectEvent: (eventId: string) => void;
  onCreateEvent: (event: NewFootballEvent) => Promise<void>;
  onUpdateEvent: (event: NewFootballEvent & { id: string }) => Promise<void>;
  onCancelEvent: (eventId: string) => Promise<void>;
  onReactivateEvent: (eventId: string) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onSetAttendance: (eventId: string, playerId: string, status: AttendanceStatus) => Promise<void>;
  onRefreshEvents: () => void;
  onRefreshAttendance: () => void;
  gameStyles: GameStyle[];
  draftKey?: string | undefined;
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

export function EventsStep({
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
  onSelectEvent,
  onCreateEvent,
  onUpdateEvent,
  onCancelEvent,
  onReactivateEvent,
  onDeleteEvent,
  onSetAttendance,
  onRefreshEvents,
  onRefreshAttendance,
  gameStyles,
  draftKey,
}: Props) {
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
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingOriginalFormat, setEditingOriginalFormat] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"cancel" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const editFormRef = useRef<HTMLFormElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!draftKey) return;
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
  }, [draftKey]);

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

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const attendanceByPlayerId = new Map(attendance.map((row) => [row.player_id, row]));
  const ownPlayer = players.find((player) => player.user_id === currentUserId) ?? null;
  const ownAttendance = ownPlayer ? attendanceByPlayerId.get(ownPlayer.id) : null;
  const confirmedCount = attendance.filter((row) => row.status === "CONFIRMED").length;
  const pendingCount = attendance.filter((row) => row.status === "PENDING").length;
  const formatChanged =
    editingEventId !== null &&
    editingOriginalFormat !== `${modality}:${gameStyleId ?? ""}` &&
    attendance.length > 0;

  useEffect(() => {
    if (!editingEventId) return;

    editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    titleInputRef.current?.focus();
  }, [editingEventId]);

  function startEditing(event: FootballEvent) {
    setEditingEventId(event.id);
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
  }

  function resetForm() {
    if (draftKey) clearDraft(draftKey);
    setEditingEventId(null);
    setTitle("");
    setModality("futsal");
    setGameStyleId(null);
    setLocationName("");
    setLocationAddress("");
    setLocationLink("");
    setLocationLat(null);
    setLocationLng(null);
    setEditingOriginalFormat(null);
  }

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      const input = {
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
      } satisfies NewFootballEvent;
      if (editingEventId) {
        await onUpdateEvent({ ...input, id: editingEventId });
        toast.success("Jogo atualizado.");
      } else {
        await onCreateEvent(input);
        toast.success("Jogo criado. A galera já pode confirmar presença.");
      }
      resetForm();
    } catch (error) {
      console.error("Event creation failed:", error);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

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
      (position) => {
        setLocationLat(Number(position.coords.latitude.toFixed(7)));
        setLocationLng(Number(position.coords.longitude.toFixed(7)));
        toast.success("Localização preenchida. Confirme as coordenadas antes de salvar.");
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) toast.error("Permissão de localização negada.");
        else if (error.code === error.TIMEOUT)
          toast.error("Tempo esgotado ao obter sua localização.");
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
      toast.success("Presença atualizada.");
    } catch (error) {
      console.error("Attendance update failed:", error);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="font-display text-2xl text-foreground">Etapa 3 — Presença</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada jogador confirma se vai. Só quem confirmar entra no sorteio dos times.
        </p>
      </div>

      {isAdmin && (
        <form
          ref={editFormRef}
          onSubmit={(event) => void createEvent(event)}
          className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h3 className="font-display text-xl font-bold">
              {editingEventId ? "Editar jogo" : "Criar jogo"}
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="event-title">Nome</Label>
              <Input
                id="event-title"
                ref={titleInputRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                required
                placeholder="Pelada de sábado"
              />
              {isGenericGoogleMapsLink(locationLink) && (
                <p className="text-xs text-amber-700">
                  Esse link não aponta para um local específico. Adicione o endereço ou use sua
                  localização para ver o mapa no jogo.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-modality">Modalidade</Label>
              <NativeSelect
                id="event-modality"
                value={modality === "custom" ? (gameStyleId ?? "custom") : modality}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "futsal" || value === "fut7" || value === "campo11") {
                    setModality(value);
                    setGameStyleId(null);
                  } else {
                    setModality("custom");
                    setGameStyleId(value === "custom" ? null : value);
                  }
                }}
                className="min-w-0 max-w-full"
              >
                {MODALITIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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
            <div className="space-y-2">
              <Label htmlFor="event-start">Início</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end">Término</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col items-stretch gap-2">
              <Button className="w-full" disabled={busy}>
                {editingEventId ? "Salvar alterações" : "Criar jogo"}
              </Button>
              {editingEventId && (
                <Button className="w-full" type="button" variant="outline" onClick={resetForm}>
                  Cancelar edição
                </Button>
              )}
              {formatChanged && (
                <p className="text-sm text-amber-600 sm:col-span-2">
                  Este jogo já tem presenças. Ao trocar o formato, será necessário gerar o sorteio
                  novamente.
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-location-name">Nome do local</Label>
              <Input
                id="event-location-name"
                value={locationName}
                maxLength={80}
                onChange={(event) => setLocationName(event.target.value)}
                placeholder="Quadra do bairro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-location-address">Endereço</Label>
              <Input
                id="event-location-address"
                value={locationAddress}
                maxLength={200}
                onChange={(event) => setLocationAddress(event.target.value)}
                placeholder="Rua, número, cidade"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="event-location-link">Link do Google Maps</Label>
              <Input
                id="event-location-link"
                type="url"
                value={locationLink}
                maxLength={500}
                onChange={(event) => setLocationLink(event.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={useMyLocation} disabled={busy}>
                <LocateFixed className="mr-2 h-4 w-4" /> Usar minha localização
              </Button>
              {(locationLat !== null || locationLng !== null) && (
                <>
                  <span className="text-sm text-muted-foreground">
                    Coordenadas: {locationLat ?? "—"}, {locationLng ?? "—"}
                  </span>
                  <Button type="button" variant="ghost" onClick={clearLocation}>
                    Limpar localização
                  </Button>
                </>
              )}
            </div>
          </div>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h3 className="font-display text-xl font-bold">Jogos da seção</h3>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onRefreshEvents}
              aria-label="Atualizar jogos"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {eventsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando jogos...</p>
          ) : eventsError ? (
            <div>
              <p className="text-sm text-destructive">{eventsErrorMessage}</p>
              <Button type="button" variant="link" className="px-0" onClick={onRefreshEvents}>
                Tentar novamente
              </Button>
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Crie um jogo acima para abrir a confirmação de presença."
                : "O administrador ainda não criou um jogo para esta seção."}
            </p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const active = event.id === selectedEventId;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelectEvent(event.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      event.status === "canceled" ? "opacity-60" : ""
                    } ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="block font-semibold text-foreground">{event.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(event.starts_at))}
                      {" · "}
                      {event.modality === "custom"
                        ? (gameStyles.find((style) => style.id === event.game_style_id)?.name ??
                          "Estilo personalizado")
                        : MODALITIES.find((item) => item.value === event.modality)?.label}
                    </span>
                    {event.status === "canceled" && (
                      <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Cancelado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          {!selectedEvent ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleHelp className="h-4 w-4" />
              Selecione um jogo para responder ou gerenciar as presenças.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-bold">{selectedEvent.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {confirmedCount} vão · {pendingCount} aguardando resposta
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    {eventActions(true, selectedEvent.status).includes("edit") ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(selectedEvent)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setPendingAction("cancel")}
                        >
                          Cancelar jogo
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void reactivate()}
                        disabled={busy}
                      >
                        Reativar
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setPendingAction("delete")}
                    >
                      Excluir
                    </Button>
                  </div>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onRefreshAttendance}
                  aria-label="Atualizar presenças"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {selectedEvent.status === "canceled" && (
                <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Este jogo está cancelado. A confirmação de presença e o sorteio estão
                  indisponíveis.
                </p>
              )}
              {(selectedEvent.location_name ||
                selectedEvent.location_address ||
                selectedEvent.location_link ||
                selectedEvent.location_lat !== null) && (
                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Local</h4>
                  </div>
                  {selectedEvent.location_name && (
                    <p className="font-medium">{selectedEvent.location_name}</p>
                  )}
                  {selectedEvent.location_address && (
                    <p className="text-sm text-muted-foreground">
                      {selectedEvent.location_address}
                    </p>
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
                      referrerPolicy="no-referrer-when-downgrade"
                      title={`Mapa do local de ${selectedEvent.title}`}
                      sandbox="allow-scripts allow-same-origin allow-popups"
                      src={googleMapsEmbedUrl(
                        selectedEvent,
                        import.meta.env["VITE_GOOGLE_MAPS_EMBED_KEY"],
                      )!}
                    />
                  ) : null}
                </div>
              )}
              {ownPlayer && selectedEvent.status === "scheduled" && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Sua presença: {ownPlayer.name}</p>
                  </div>
                  {attendanceLoading ? (
                    <p className="mt-3 text-sm text-muted-foreground">Carregando confirmação...</p>
                  ) : ownAttendance ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={ownAttendance.status === "CONFIRMED" ? "default" : "outline"}
                        disabled={busy}
                        onClick={() => void updateAttendance(ownPlayer.id, "CONFIRMED")}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Vou
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={ownAttendance.status === "DECLINED" ? "destructive" : "outline"}
                        disabled={busy}
                        onClick={() => void updateAttendance(ownPlayer.id, "DECLINED")}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Não vou
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-destructive">
                      Sua confirmação não foi criada para este jogo. Peça ao administrador para
                      atualizar a lista.
                    </p>
                  )}
                </div>
              )}
              {!ownPlayer && !isAdmin && (
                <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
                  Cadastre seu jogador na seção para confirmar presença.
                </p>
              )}

              {attendanceLoading ? (
                <p className="text-sm text-muted-foreground">Carregando lista de presença...</p>
              ) : attendanceError ? (
                <div>
                  <p className="text-sm text-destructive">{attendanceErrorMessage}</p>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0"
                    onClick={onRefreshAttendance}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Lista de presença</h4>
                  {players.map((player) => {
                    const row = attendanceByPlayerId.get(player.id);
                    const status = row?.status ?? "PENDING";
                    return (
                      <div
                        key={player.id}
                        className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <div className="min-w-0">
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
                            <span className="block truncate text-sm font-medium">
                              {player.name}
                            </span>
                          </span>
                          {player.user_id === currentUserId && (
                            <span className="text-xs text-muted-foreground">Você</span>
                          )}
                        </div>
                        {isAdmin && selectedEvent.status === "scheduled" ? (
                          <NativeSelect
                            value={status}
                            disabled={busy || !row}
                            onChange={(event) =>
                              void updateAttendance(
                                player.id,
                                event.target.value as AttendanceStatus,
                              )
                            }
                            aria-label={`Presença de ${player.name}`}
                            className="h-10 min-w-0 max-w-full shrink-0 px-2"
                          >
                            <option value="PENDING">{statusLabel("PENDING")}</option>
                            <option value="CONFIRMED">{statusLabel("CONFIRMED")}</option>
                            <option value="DECLINED">{statusLabel("DECLINED")}</option>
                          </NativeSelect>
                        ) : (
                          <span
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
                  {players.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Cadastre jogadores para montar a lista de presença.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
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
            <AlertDialogAction onClick={() => void runPendingAction()}>
              {pendingAction === "delete" ? "Excluir definitivamente" : "Cancelar jogo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
