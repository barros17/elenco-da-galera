import { useState } from "react";
import {
  CalendarDays,
  Check,
  CircleHelp,
  Plus,
  RefreshCw,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import type { Player } from "@/lib/players";
import {
  type AttendanceStatus,
  type EventAttendance,
  type FootballEvent,
  type GameModality,
  type NewFootballEvent,
} from "@/lib/events";

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
  onSetAttendance: (eventId: string, playerId: string, status: AttendanceStatus) => Promise<void>;
  onRefreshEvents: () => void;
  onRefreshAttendance: () => void;
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
  onSetAttendance,
  onRefreshEvents,
  onRefreshAttendance,
}: Props) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState(() =>
    localDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  );
  const [endsAt, setEndsAt] = useState(() =>
    localDateTimeValue(new Date(Date.now() + 26 * 60 * 60 * 1000)),
  );
  const [modality, setModality] = useState<GameModality>("futsal");
  const [busy, setBusy] = useState(false);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const attendanceByPlayerId = new Map(attendance.map((row) => [row.player_id, row]));
  const ownPlayer = players.find((player) => player.user_id === currentUserId) ?? null;
  const ownAttendance = ownPlayer ? attendanceByPlayerId.get(ownPlayer.id) : null;
  const confirmedCount = attendance.filter((row) => row.status === "CONFIRMED").length;
  const pendingCount = attendance.filter((row) => row.status === "PENDING").length;

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

    setBusy(true);
    try {
      await onCreateEvent({
        section_id: sectionId,
        title: title.trim(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        modality,
      });
      setTitle("");
      toast.success("Jogo criado. A galera já pode confirmar presença.");
    } catch (error) {
      console.error("Event creation failed:", error);
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
          onSubmit={(event) => void createEvent(event)}
          className="space-y-4 rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h3 className="font-display text-xl font-bold">Criar jogo</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="event-title">Nome</Label>
              <Input
                id="event-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                required
                placeholder="Pelada de sábado"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-modality">Modalidade</Label>
              <select
                id="event-modality"
                value={modality}
                onChange={(event) => setModality(event.target.value as GameModality)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {MODALITIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
            <div className="flex items-end">
              <Button className="w-full" disabled={busy}>
                Criar jogo
              </Button>
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
                      {MODALITIES.find((item) => item.value === event.modality)?.label}
                    </span>
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

              {ownPlayer && (
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
                        {isAdmin ? (
                          <select
                            value={status}
                            disabled={busy || !row}
                            onChange={(event) =>
                              void updateAttendance(
                                player.id,
                                event.target.value as AttendanceStatus,
                              )
                            }
                            aria-label={`Presença de ${player.name}`}
                            className="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value="PENDING">{statusLabel("PENDING")}</option>
                            <option value="CONFIRMED">{statusLabel("CONFIRMED")}</option>
                            <option value="DECLINED">{statusLabel("DECLINED")}</option>
                          </select>
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
    </section>
  );
}
