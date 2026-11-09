import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, Download, Shuffle, Users } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FootballPitch } from "@/components/FootballPitch";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import type { FootballEvent } from "@/lib/events";
import type { Player } from "@/lib/players";
import { buildFormation } from "@/lib/team-formations";
import { missingConfirmedPlayers } from "@/lib/game-style-utils";
import {
  DEFAULT_COLOR,
  TEAM_COLORS,
  balanceScore,
  generateTeams,
  teamAvg,
  teamSum,
  type DrawResult,
} from "@/lib/team-balancer";
import { createInitialLineup, movePlayerToReserves, movePlayerToSlot } from "@/lib/team-formations";
import { confirmedSignature, drawStorageKey, loadDraw, saveDraw } from "@/lib/draw-storage";

type SelectedLocation =
  | { type: "field"; teamIndex: number; slotIndex: number }
  | { type: "reserve"; reserveIndex: number };

type TeamLayout = {
  teams: Array<Array<Player | null>>;
  reserves: Player[];
};

type Props = {
  event: FootballEvent | null;
  confirmedPlayers: Player[];
  attendanceLoading: boolean;
  attendanceError: boolean;
};

export function TeamsStep({ event, confirmedPlayers, attendanceLoading, attendanceError }: Props) {
  const [result, setResult] = useState<DrawResult | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [layout, setLayout] = useState<TeamLayout | null>(null);
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [downloading, setDownloading] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const formation = event
    ? {
        slots: buildFormation({
          hasGoalkeeper: event.formation.has_goalkeeper,
          defenders: event.formation.defenders,
          midfielders: event.formation.midfielders,
          attackers: event.formation.attackers,
        }),
        teamSize: event.formation.players_per_team,
        label: event.modality === "custom" ? "Estilo personalizado" : event.modality,
        format: `${event.formation.defenders}-${event.formation.midfielders}-${event.formation.attackers}`,
      }
    : null;
  const signature = confirmedSignature(confirmedPlayers);
  const drawKey = `${event?.id ?? ""}:${signature}`;

  useEffect(() => {
    setResult(null);
    setNames([]);
    setLayout(null);
    setSelected(null);
  }, [drawKey]);

  useEffect(() => {
    if (!event || typeof window === "undefined") return;
    const restored = loadDraw<TeamLayout>(event.id, signature);
    if (restored) {
      setResult(restored.result);
      setNames(restored.names);
      setLayout(restored.layout);
      return;
    }
    try {
      const raw = window.localStorage.getItem(drawStorageKey(event.id));
      if (raw && JSON.parse(raw).signature !== signature) {
        toast.info("A lista de confirmados mudou; gere o sorteio de novo.");
      }
    } catch {
      // Best-effort notification only.
    }
  }, [event, signature]);

  useEffect(() => {
    if (event && result && layout) saveDraw(event.id, { signature, result, names, layout });
  }, [event, layout, names, result, signature]);

  const balance = useMemo(() => {
    if (!result || !layout) return 0;
    const teams = result.teams.map((team, index) => ({
      ...team,
      players: layout.teams[index]?.filter((player): player is Player => player !== null) ?? [],
    }));
    return balanceScore(teams);
  }, [layout, result]);

  function draw(withCurrent = false) {
    if (!event || !formation) {
      toast.error("Selecione um jogo na etapa Presença antes de gerar os times.");
      return;
    }
    if (event.status === "canceled") {
      toast.error("Reative o jogo antes de sortear os times.");
      return;
    }
    if (attendanceLoading) {
      toast.error("Aguarde a lista de presença carregar.");
      return;
    }
    if (attendanceError) {
      toast.error("Não foi possível carregar as presenças. Atualize a etapa Presença.");
      return;
    }
    const effectiveTeamSize = withCurrent
      ? Math.floor(confirmedPlayers.length / 2)
      : formation.teamSize;
    if (
      effectiveTeamSize < 2 ||
      (!withCurrent && confirmedPlayers.length < formation.teamSize * 2)
    ) {
      toast.error(
        `São necessários ${formation.teamSize * 2} jogadores confirmados para formar dois times de ${formation.teamSize}.`,
      );
      return;
    }

    const nextResult = generateTeams(confirmedPlayers, effectiveTeamSize, {
      teamCount: 2,
      hasGoalkeeper: event.formation.has_goalkeeper,
    });
    if (nextResult.teams.length !== 2) {
      toast.error("Não foi possível formar dois times completos com os confirmados.");
      return;
    }

    setResult(nextResult);
    setNames(nextResult.teams.map((team) => team.name));
    setLayout({
      teams: nextResult.teams.map((team) =>
        createInitialLineup(team.players, {
          hasGoalkeeper: event.formation.has_goalkeeper,
          defenders: event.formation.defenders,
          midfielders: event.formation.midfielders,
          attackers: event.formation.attackers,
        }),
      ),
      reserves: nextResult.reserves,
    });
    setSelected(null);
    if (nextResult.reserves.length > 0) {
      toast.info(`${nextResult.reserves.length} confirmado(s) ficaram como reservas.`);
    }
  }

  function moveSelectedToSlot(teamIndex: number, slotIndex: number) {
    if (!selected) return;
    if (
      selected.type === "field" &&
      selected.teamIndex === teamIndex &&
      selected.slotIndex === slotIndex
    ) {
      setSelected(null);
      return;
    }
    setLayout((current) =>
      current
        ? movePlayerToSlot(current.teams, current.reserves, selected, { teamIndex, slotIndex })
        : current,
    );
    setSelected(null);
  }

  function handleSlotClick(teamIndex: number, slotIndex: number) {
    if (!layout) return;
    if (!selected) {
      if (layout.teams[teamIndex]?.[slotIndex]) {
        setSelected({ type: "field", teamIndex, slotIndex });
      }
      return;
    }
    moveSelectedToSlot(teamIndex, slotIndex);
  }

  function handleReserveClick(reserveIndex: number) {
    if (!layout) return;
    if (selected?.type === "field") {
      setLayout((current) =>
        current
          ? movePlayerToSlot(
              current.teams,
              current.reserves,
              {
                type: "reserve",
                reserveIndex,
              },
              {
                teamIndex: selected.teamIndex,
                slotIndex: selected.slotIndex,
              },
            )
          : current,
      );
      setSelected(null);
      return;
    }
    setSelected({ type: "reserve", reserveIndex });
  }

  function sendSelectedToReserves() {
    if (!layout || selected?.type !== "field") return;
    setLayout((current) =>
      current
        ? movePlayerToReserves(current.teams, current.reserves, {
            teamIndex: selected.teamIndex,
            slotIndex: selected.slotIndex,
          })
        : current,
    );
    setSelected(null);
  }

  async function download() {
    if (!boardRef.current) return;
    setDownloading(true);
    try {
      const url = await toPng(boardRef.current, { pixelRatio: 2, backgroundColor: "#141414" });
      const link = document.createElement("a");
      link.download = "elenco-da-galera-times.png";
      link.href = url;
      link.click();
      toast.success("Imagem dos times baixada!");
    } catch (error) {
      console.error("Team image export failed:", error);
      toast.error("Não foi possível gerar a imagem.");
    } finally {
      setDownloading(false);
    }
  }

  const currentTeams =
    result && layout
      ? result.teams.map((team, index) => ({
          ...team,
          name: names[index] ?? team.name,
          players: layout.teams[index]?.filter((player): player is Player => player !== null) ?? [],
        }))
      : [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-foreground">Etapa 4 — Gerar times</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O sorteio usa apenas quem confirmou presença. Selecione cards e posições para ajustar a
          escalação; também é possível arrastar e soltar.
        </p>
      </div>
      {event?.status === "canceled" && (
        <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Este jogo está cancelado e não pode receber sorteio.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-5">
        <div className="min-w-[12rem]">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            {event ? event.title : "Nenhum jogo selecionado"}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {attendanceLoading
              ? "Carregando confirmações..."
              : attendanceError
                ? "Erro ao carregar as confirmações. Atualize a etapa Presença."
                : event && formation
                  ? `${formation.label} · ${formation.format} · ${formation.teamSize} por time · ${confirmedPlayers.length} confirmados`
                  : "Crie ou selecione um jogo na etapa Presença."}
          </p>
          {event && formation && confirmedPlayers.length < formation.teamSize * 2 && (
            <p className="mt-2 text-sm font-semibold text-primary">
              Faltam {missingConfirmedPlayers(formation.teamSize, confirmedPlayers.length)}{" "}
              confirmados para sortear (precisa de {formation.teamSize * 2}).
            </p>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            onClick={() => draw()}
            size="lg"
            disabled={!event || attendanceLoading || attendanceError || !formation}
          >
            <Dices className="mr-2 h-4 w-4" />
            Gerar dois times
          </Button>
          {event && formation && confirmedPlayers.length < formation.teamSize * 2 && (
            <Button
              onClick={() => draw(true)}
              size="lg"
              variant="secondary"
              disabled={confirmedPlayers.length < 4}
            >
              <Dices className="mr-2 h-4 w-4" />
              Sortear com os confirmados atuais
            </Button>
          )}
          {result && (
            <Button onClick={() => draw()} size="lg" variant="secondary">
              <Shuffle className="mr-2 h-4 w-4" />
              Sortear novamente
            </Button>
          )}
        </div>
      </div>

      {result && layout && formation && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-xl border border-primary/40 bg-card px-5 py-3 shadow-glow-gold">
              <div className="font-display text-3xl font-bold text-primary">
                Equilíbrio: {balance}%
              </div>
              <div className="text-xs tracking-widest text-muted-foreground uppercase">
                Diferença entre os times em campo
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Formação {formation.format} · {formation.label}
            </p>
            <Button onClick={download} variant="outline" disabled={downloading} className="ml-auto">
              <Download className="mr-2 h-4 w-4" />
              Baixar imagem
            </Button>
          </div>

          <div ref={boardRef} className="space-y-5 rounded-2xl bg-background p-4">
            <div className="grid gap-8 xl:grid-cols-2">
              {currentTeams.map((team, teamIndex) => {
                const color = TEAM_COLORS[team.name] ?? DEFAULT_COLOR;
                return (
                  <section
                    key={teamIndex}
                    className="space-y-4 rounded-2xl border border-border p-4"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${color.from}, ${color.to})`,
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-3" style={{ color: color.ink }}>
                      <Input
                        value={names[teamIndex] ?? team.name}
                        onChange={(event) =>
                          setNames((previous) =>
                            previous.map((name, index) =>
                              index === teamIndex ? event.target.value : name,
                            ),
                          )
                        }
                        className="h-auto w-auto max-w-[18rem] min-w-[10rem] border-0 bg-transparent px-0 font-display text-2xl font-bold tracking-wide uppercase shadow-none focus-visible:ring-0"
                        style={{ color: color.ink }}
                        aria-label={`Nome do time ${teamIndex + 1}`}
                      />
                      <div className="ml-auto flex gap-4 font-display text-xs tracking-widest uppercase">
                        <span>
                          Média <strong className="text-base">{teamAvg(team)}</strong>
                        </span>
                        <span>
                          Total <strong className="text-base">{teamSum(team)}</strong>
                        </span>
                      </div>
                    </div>
                    <FootballPitch
                      teamIndex={teamIndex}
                      teamName={names[teamIndex] ?? team.name}
                      slots={formation.slots}
                      lineup={layout.teams[teamIndex] ?? []}
                      selectedSlot={
                        selected?.type === "field" && selected.teamIndex === teamIndex
                          ? selected.slotIndex
                          : null
                      }
                      onSlotClick={handleSlotClick}
                      onSlotDragStart={(sourceTeam, slotIndex) =>
                        setSelected({ type: "field", teamIndex: sourceTeam, slotIndex })
                      }
                      onSlotDrop={moveSelectedToSlot}
                    />
                  </section>
                );
              })}
            </div>

            <section
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                sendSelectedToReserves();
              }}
              className="rounded-2xl border border-dashed border-border px-5 py-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl text-muted-foreground">Reservas</h3>
                  <p className="text-xs text-muted-foreground">
                    Selecione uma reserva e depois uma posição vazia ou ocupada.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={selected?.type !== "field"}
                  onClick={sendSelectedToReserves}
                >
                  Mandar selecionado para reservas
                </Button>
              </div>
              {layout.reserves.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {layout.reserves.map((player, reserveIndex) => (
                    <button
                      key={player.id}
                      type="button"
                      draggable
                      onClick={() => handleReserveClick(reserveIndex)}
                      onDragStart={() => setSelected({ type: "reserve", reserveIndex })}
                      aria-pressed={
                        selected?.type === "reserve" && selected.reserveIndex === reserveIndex
                      }
                      className={`flex w-full max-w-48 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm text-foreground ${
                        selected?.type === "reserve" && selected.reserveIndex === reserveIndex
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <PlayerPhoto
                        photoUrl={player.photo_url}
                        alt=""
                        ariaHidden
                        className="h-8 w-8 rounded-full object-cover"
                        fallback={
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-muted font-bold">
                            {player.overall}
                          </span>
                        }
                      />
                      <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
                      <span className="text-xs text-primary">{player.position}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Não há reservas. Você também pode enviar um jogador do campo para abrir uma
                  posição.
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
