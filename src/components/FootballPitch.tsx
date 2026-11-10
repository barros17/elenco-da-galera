import { UserRound } from "lucide-react";
import type { Player } from "@/lib/players";
import type { FormationSlot } from "@/lib/team-formations";
import { PlayerPhoto } from "@/components/PlayerPhoto";

type Props = {
  teamIndex: number;
  teamName: string;
  slots: FormationSlot[];
  lineup: Array<Player | null>;
  selectedSlot: number | null;
  onSlotClick: (teamIndex: number, slotIndex: number) => void;
  onSlotDragStart: (teamIndex: number, slotIndex: number) => void;
  onSlotDrop: (teamIndex: number, slotIndex: number) => void;
  onDragEnd?: () => void;
  showTeamName?: boolean;
};

export function FootballPitch({
  teamIndex,
  teamName,
  slots,
  lineup,
  selectedSlot,
  onSlotClick,
  onSlotDragStart,
  onSlotDrop,
  onDragEnd,
  showTeamName = true,
}: Props) {
  const maxPlayersInRow = Math.max(
    1,
    ...Array.from(new Set(slots.map((slot) => slot.y))).map(
      (y) => slots.filter((slot) => slot.y === y).length,
    ),
  );
  return (
    <div className="space-y-3">
      {showTeamName && (
        <h3 className="text-center font-display text-xl font-bold uppercase text-foreground">
          {teamName}
        </h3>
      )}
      <div className="relative mx-auto aspect-[0.72] w-full max-w-[25rem] overflow-hidden rounded-xl border-4 border-white/65 bg-[linear-gradient(180deg,#237343_0%,#1d683a_50%,#237343_100%)] shadow-card-deep [container-type:inline-size]">
        <div className="pointer-events-none absolute inset-[4%] rounded-lg border border-white/50" />
        <div className="pointer-events-none absolute inset-x-[4%] top-1/2 border-t border-white/50" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[17%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50" />
        <div className="pointer-events-none absolute top-[4%] left-1/2 h-[17%] w-[56%] -translate-x-1/2 rounded-b-lg border border-t-0 border-white/50" />
        <div className="pointer-events-none absolute bottom-[4%] left-1/2 h-[17%] w-[56%] -translate-x-1/2 rounded-t-lg border border-b-0 border-white/50" />
        <div className="pointer-events-none absolute top-[4%] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white/70" />
        <div className="pointer-events-none absolute bottom-[4%] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white/70" />

        {slots.map((slot, slotIndex) => {
          const player = lineup[slotIndex] ?? null;
          const selected = selectedSlot === slotIndex;
          return (
            <div
              key={slot.id}
              draggable={Boolean(player)}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", `${teamIndex}:${slotIndex}`);
                event.dataTransfer.effectAllowed = "move";
                onSlotDragStart(teamIndex, slotIndex);
              }}
              onDragEnd={onDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onSlotDrop(teamIndex, slotIndex);
              }}
              aria-label={
                player
                  ? `${slot.label}: ${player.name}, ${player.overall}. Selecione para trocar de posição.`
                  : `Posição vazia: ${slot.label}. Selecione para preencher.`
              }
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${Math.min(88, Math.max(12, slot.x))}%`,
                top: `${Math.min(92, Math.max(8, slot.y))}%`,
                width: `min(21cqw, ${80 / maxPlayersInRow}cqw)`,
              }}
            >
              <button
                type="button"
                onClick={() => onSlotClick(teamIndex, slotIndex)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  onSlotDrop(teamIndex, slotIndex);
                }}
                aria-pressed={selected}
                className={`flex min-h-11 w-full flex-col items-center justify-center rounded-lg border px-1 py-1 text-center text-white shadow-lg transition ${
                  selected
                    ? "border-primary bg-black/90 ring-2 ring-primary"
                    : player
                      ? "border-white/60 bg-black/80 hover:border-primary"
                      : "border-dashed border-white/75 bg-black/35 hover:bg-black/60"
                }`}
              >
                {player ? (
                  <>
                    <span className="flex w-full items-center gap-1">
                      <PlayerPhoto
                        photoUrl={player.photo_url}
                        alt=""
                        ariaHidden
                        className="h-5 w-5 shrink-0 rounded-full object-cover"
                        fallback={
                          <UserRound className="h-5 w-5 shrink-0 rounded-full bg-white/15 p-0.5" />
                        }
                      />
                      <span className="slot-detail min-w-0 flex-1 truncate text-[clamp(10px,2.8cqw,0.7rem)] font-bold">
                        {player.name}
                      </span>
                      <span className="slot-compact hidden font-bold">{player.overall}</span>
                    </span>
                    <span className="mt-0.5 flex w-full justify-between text-[clamp(10px,2.4cqw,0.65rem)] leading-none text-white/75">
                      <span>{slot.label}</span>
                      <span className="font-bold text-primary">{player.overall}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[clamp(10px,2.8cqw,0.7rem)] font-bold">+ Vazio</span>
                    <span className="text-[clamp(10px,2.4cqw,0.65rem)] text-white/75">
                      {slot.label}
                    </span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
