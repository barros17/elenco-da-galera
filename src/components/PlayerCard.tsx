import { Star, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { calcOverall, skillSetFor, tierFor, type Position, type Skills } from "@/lib/players";
import { PlayerPhoto } from "@/components/PlayerPhoto";

const TIER_CLASS: Record<string, string> = {
  bronze: "player-card-bronze",
  prata: "player-card-silver",
  ouro: "player-card-gold",
  diamante: "player-card-diamond shine-sweep",
};

type Props = {
  name: string;
  position: Position;
  skills: Skills;
  weakFoot?: number;
  photoUrl?: string | null;
  overall?: number;
  size?: "sm" | "md" | "lg";
  revealing?: boolean;
  className?: string;
};

export function PlayerCard({
  name,
  position,
  skills,
  weakFoot = 0,
  photoUrl,
  overall,
  size = "md",
  revealing = false,
  className,
}: Props) {
  const ov = overall ?? calcOverall(position, skills);
  const tier = tierFor(ov);
  const set = skillSetFor(position);

  const scale = size === "sm" ? "w-40" : size === "lg" ? "w-72" : "w-56";
  const ovText =
    size === "sm" ? "text-[2rem]" : size === "lg" ? "text-[3.65rem]" : "text-[2.85rem]";
  const nameText = size === "sm" ? "text-[0.78rem]" : size === "lg" ? "text-xl" : "text-base";
  const skillText =
    size === "sm" ? "text-[0.58rem]" : size === "lg" ? "text-[0.72rem]" : "text-[0.65rem]";
  const sideInset = size === "sm" ? "inset-x-[11%]" : "inset-x-[12%]";

  return (
    <div
      className={cn(
        "football-card relative aspect-[5/7] shrink-0 p-[3px] shadow-card-deep",
        TIER_CLASS[tier],
        revealing && "animate-reveal",
        className,
        scale,
      )}
    >
      <div className="football-card-inner relative h-full overflow-hidden">
        <div className="player-card-facets pointer-events-none absolute inset-0" />

        <div className="absolute inset-x-0 top-0 h-[62%] overflow-hidden bg-muted/25">
          <PlayerPhoto
            photoUrl={photoUrl ?? null}
            alt={name}
            className="h-full w-full object-cover object-center drop-shadow-xl"
            fallback={<UserRound className="mx-auto h-full w-[72%] opacity-25" strokeWidth={1.1} />}
          />
          <div className="player-card-photo-fade absolute inset-0" />
        </div>

        <div
          className={cn(
            "absolute top-[10%] z-10 text-center leading-none drop-shadow-sm",
            size === "sm" ? "left-[10%]" : "left-[11%]",
          )}
        >
          <div className={cn("font-display font-extrabold tabular-nums", ovText)}>{ov}</div>
          <div
            className={cn("mt-0.5 font-display font-bold", size === "sm" ? "text-xs" : "text-sm")}
          >
            {position}
          </div>
        </div>

        <div className={cn("absolute top-[57%] bottom-[8%] z-10 flex flex-col", sideInset)}>
          <div className="player-card-nameplate flex min-h-[17%] items-center justify-center border-y px-1 text-center">
            <div className={cn("w-full truncate font-display font-extrabold uppercase", nameText)}>
              {name || "Sem nome"}
            </div>
          </div>

          <div
            className={cn(
              "grid flex-1 grid-cols-2 content-center gap-x-[16%] gap-y-0 font-bold",
              skillText,
            )}
          >
            {set.map((skill) => (
              <div key={skill.key} className="flex items-baseline justify-between tabular-nums">
                <span className="font-display text-[1.35em] font-extrabold">
                  {skills[skill.key] ?? 1}
                </span>
                <span className="opacity-70">{skill.key}</span>
              </div>
            ))}
          </div>

          <div
            className={cn(
              "flex items-center justify-center gap-1 font-bold uppercase opacity-80",
              size === "sm" ? "text-[0.48rem]" : "text-[0.58rem]",
            )}
          >
            <span>Perna ruim</span>
            <span className="flex" aria-label={`${weakFoot} de 5`}>
              {Array.from({ length: 5 }, (_, index) => (
                <Star
                  key={index}
                  className={cn(
                    size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
                    index < weakFoot && "fill-current",
                  )}
                />
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
