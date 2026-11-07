import { UserRound } from "lucide-react";
import type { Player } from "@/lib/players";
import type { FormationSlot } from "@/lib/team-formations";

type Props = {
  teamIndex: number;
  teamName: string;
  slots: FormationSlot[];
  lineup: Array<Player | null>;
  selectedSlot: number | null;
  onSlotClick: (teamIndex: number, slotIndex: number) => void;
  onSlotDragStart: (teamIndex: number, slotIndex: number) => void;
  onSlotDrop: (teamIndex: number, slotIndex: number) => void;
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
}: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-center font-display text-xl font-bold uppercase text-foreground">
        {teamName}
      </h3>
      <div className="relative mx-auto aspect-[0.72] w-full max-w-[25rem] overflow-hidden rounded-xl border-4 border-white/65 bg-[linear-gradient(180deg,#237343_0%,#1d683a_50%,#237343_100%)] shadow-card-deep">
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
            <button
              key={slot.id}
              type="button"
              draggable={Boolean(player)}
              onClick={() => onSlotClick(teamIndex, slotIndex)}
              onDragStart={() => onSlotDragStart(teamIndex, slotIndex)}
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
              aria-pressed={selected}
              className={`absolute z-10 flex min-h-12 w-[5.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-lg border px-1 py-1 text-center text-white shadow-lg transition ${
                selected
                  ? "border-primary bg-black/90 ring-2 ring-primary"
                  : player
                    ? "border-white/60 bg-black/80 hover:border-primary"
                    : "border-dashed border-white/75 bg-black/35 hover:bg-black/60"
              }`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              {player ? (
                <>
                  <span className="flex w-full items-center gap-1">
                    {player.photo_url ? (
                      <img
                        src={player.photo_url}
                        alt=""
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <UserRound className="h-5 w-5 shrink-0 rounded-full bg-white/15 p-0.5" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[9px] font-bold">
                      {player.name}
                    </span>
                  </span>
                  <span className="mt-0.5 flex w-full justify-between text-[8px] leading-none text-white/75">
                    <span>{slot.label}</span>
                    <span className="font-bold text-primary">{player.overall}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[9px] font-bold">+ Vazio</span>
                  <span className="text-[8px] text-white/75">{slot.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
