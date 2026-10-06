import { useRef, useState } from "react";
import { Dices, Download, Shuffle } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerCard } from "@/components/PlayerCard";
import type { Player } from "@/lib/players";
import {
  DEFAULT_COLOR,
  TEAM_COLORS,
  balanceScore,
  generateTeams,
  teamAvg,
  teamSum,
  type DrawResult,
} from "@/lib/team-balancer";

export function TeamsStep({ players }: { players: Player[] }) {
  const [size, setSize] = useState(5);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const teamCount = Math.floor(players.length / Math.max(1, size));
  const leftovers = players.length - teamCount * size;

  function draw() {
    if (teamCount < 2) {
      toast.error(`Você precisa de pelo menos ${size * 2} jogadores para formar 2 times de ${size}.`);
      return;
    }
    const r = generateTeams(players, size);
    setResult(r);
    setNames(r.teams.map((t) => t.name));
    if (r.reserves.length > 0) {
      toast.info(
        `${r.reserves.length} jogador(es) sobraram e ficaram como reservas.`,
      );
    }
  }

  async function download() {
    if (!boardRef.current) return;
    setDownloading(true);
    try {
      const url = await toPng(boardRef.current, { pixelRatio: 2, backgroundColor: "#141414" });
      const link = document.createElement("a");
       link.download = "uefa-c6-league-times.png";
      link.href = url;
      link.click();
      toast.success("Imagem dos times baixada!");
    } catch {
      toast.error("Não foi possível gerar a imagem.");
    } finally {
      setDownloading(false);
    }
  }

  const balance = result ? balanceScore(result.teams) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="tamanho">Jogadores por time</Label>
          <Input
            id="tamanho"
            type="number"
            min={2}
            max={11}
            value={size}
            onChange={(e) => setSize(Math.max(2, Math.min(11, Number(e.target.value) || 2)))}
            className="w-28"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          <p>
            Com {players.length} jogadores dá para montar{" "}
            <strong className="text-foreground">{teamCount} time(s)</strong> de {size}.
          </p>
          {leftovers > 0 && <p>{leftovers} jogador(es) ficarão como reservas.</p>}
        </div>
        <div className="ml-auto flex gap-2">
          <Button onClick={draw} size="lg">
            <Dices className="mr-2 h-4 w-4" />
            Gerar times
          </Button>
          {result && result.teams.length > 0 && (
            <Button onClick={draw} size="lg" variant="secondary">
              <Shuffle className="mr-2 h-4 w-4" />
              Sortear novamente
            </Button>
          )}
        </div>
      </div>

      {result && result.teams.length > 0 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-xl border border-primary/40 bg-card px-5 py-3 shadow-glow-gold">
              <div className="font-display text-3xl font-bold text-primary">Equilíbrio: {balance}%</div>
              <div className="text-xs tracking-widest text-muted-foreground uppercase">
                Diferença entre o melhor e o pior time
              </div>
            </div>
            <Button onClick={download} variant="outline" disabled={downloading} className="ml-auto">
              <Download className="mr-2 h-4 w-4" />
              Baixar imagem
            </Button>
          </div>

          <div ref={boardRef} className="space-y-5 rounded-2xl bg-background p-4">
            {result.teams.map((team, i) => {
              const color = TEAM_COLORS[team.name] ?? DEFAULT_COLOR;
              return (
                <div
                  key={team.name + i}
                  className="animate-rise overflow-hidden rounded-2xl border border-border shadow-card-deep"
                  style={{ backgroundImage: `linear-gradient(135deg, ${color.from}, ${color.to})` }}
                >
                  <div className="flex flex-wrap items-center gap-3 px-5 py-4" style={{ color: color.ink }}>
                    <Input
                      value={names[i] ?? team.name}
                      onChange={(e) =>
                        setNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))
                      }
                      className="h-auto w-auto max-w-[18rem] min-w-[10rem] border-0 bg-transparent px-0 font-display text-2xl font-bold tracking-wide uppercase shadow-none focus-visible:ring-0"
                      style={{ color: color.ink }}
                      aria-label={`Nome do time ${i + 1}`}
                    />
                    <div className="ml-auto flex gap-5 font-display text-sm tracking-widest uppercase">
                      <span>
                        Média <strong className="text-lg">{teamAvg(team)}</strong>
                      </span>
                      <span>
                        Total <strong className="text-lg">{teamSum(team)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 bg-black/35 px-5 py-4">
                    {team.players.map((p) => (
                      <PlayerCard
                        key={p.id}
                        name={p.name}
                        position={p.position}
                        skills={p.skills}
                        weakFoot={p.weak_foot}
                        photoUrl={p.photo_url}
                        overall={p.overall}
                        size="sm"
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {result.reserves.length > 0 && (
              <div className="rounded-2xl border border-dashed border-border px-5 py-4">
                <h3 className="mb-3 font-display text-xl text-muted-foreground">Reservas</h3>
                <div className="flex flex-wrap gap-3">
                  {result.reserves.map((p) => (
                    <PlayerCard
                      key={p.id}
                      name={p.name}
                      position={p.position}
                      skills={p.skills}
                      weakFoot={p.weak_foot}
                      photoUrl={p.photo_url}
                      overall={p.overall}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
