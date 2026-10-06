import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { PlayerCard } from "@/components/PlayerCard";
import { PhotoCropper, type CropSource } from "@/components/PhotoCropper";
import {
  POSITIONS,
  POSITION_LABELS,
  calcOverall,
  defaultSkills,
  skillSetFor,
  type Player,
  type Position,
  type Skills,
} from "@/lib/players";
import { type PlayerInput } from "@/lib/player-queries";
import { cn } from "@/lib/utils";

type Props = {
  editing?: Player | null;
  /** Mostra o botão Cancelar mesmo sem edição (ex.: administrador adicionando jogador). */
  canCancel?: boolean;
  onSubmit: (input: PlayerInput) => Promise<Player>;
  onDone?: (player: Player) => void;
  onCancelEdit?: () => void;
};

export function PlayerForm({ editing, canCancel, onSubmit, onDone, onCancelEdit }: Props) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("MEI");
  const [skills, setSkills] = useState<Skills>(() => defaultSkills("MEI"));
  const [weakFoot, setWeakFoot] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Player | null>(null);
  const [cropSource, setCropSource] = useState<CropSource | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setPosition(editing.position);
      setSkills({ ...defaultSkills(editing.position), ...editing.skills });
      setWeakFoot(editing.weak_foot);
      setPhoto(editing.photo_url);
      setRevealed(null);
    }
  }, [editing]);

  function changePosition(next: Position) {
    const wasGk = position === "GOL";
    const isGk = next === "GOL";
    setPosition(next);
    if (wasGk !== isGk) setSkills(defaultSkills(next));
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    setCropSource({ file, url: URL.createObjectURL(file) });
  }

  function closeCropper() {
    if (cropSource) URL.revokeObjectURL(cropSource.url);
    setCropSource(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("O nome do jogador é obrigatório.");
      return;
    }
    const invalid = Object.values(skills).some((v) => v < 1 || v > 99);
    if (invalid) {
      toast.error("As habilidades devem ficar entre 1 e 99.");
      return;
    }
    setSaving(true);
    try {
      const saved = await onSubmit({ name, position, skills, weak_foot: weakFoot, photo_url: photo });
      setRevealed(saved);
      toast.success(editing ? "Jogador atualizado!" : `${saved.name} entrou na pelada!`);
      if (!editing) {
        setName("");
        setPhoto(null);
        setWeakFoot(0);
        setSkills(defaultSkills(position));
      }
      onDone?.(saved);
    } catch {
      toast.error("Não conseguimos salvar o jogador. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const set = skillSetFor(position);
  const overall = calcOverall(position, skills);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome do jogador</Label>
          <Input
            id="nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Zico da Vila"
            maxLength={40}
          />
        </div>

        <div className="space-y-2">
          <Label>Foto (opcional)</Label>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" />
              Escolher foto
            </Button>
            {photo && (
              <Button type="button" variant="ghost" onClick={() => setPhoto(null)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remover
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhoto(e.target.files?.[0])}
            />
          </div>
          {photo && <p className="text-xs text-muted-foreground">Toque em “Escolher foto” para ajustar novamente.</p>}
        </div>

        <div className="space-y-2">
          <Label>Posição</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => changePosition(p)}
                title={POSITION_LABELS[p]}
                className={cn(
                  "rounded-lg border px-2 py-2 font-display text-sm font-bold uppercase transition-all",
                  position === p
                    ? "border-primary bg-primary text-primary-foreground shadow-glow-gold"
                    : "border-border bg-secondary text-foreground hover:border-primary/60",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{POSITION_LABELS[position]}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Perna ruim</Label>
            <span className="font-display text-lg font-bold text-primary">{weakFoot}/5</span>
          </div>
          <div className="grid grid-cols-6 gap-2" role="group" aria-label="Nota da perna ruim">
            {[0, 1, 2, 3, 4, 5].map((value) => (
              <Button
                key={value}
                type="button"
                variant={weakFoot === value ? "default" : "secondary"}
                size="sm"
                onClick={() => setWeakFoot(value)}
                aria-pressed={weakFoot === value}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <Label>Habilidades (1 a 99)</Label>
            <span className="font-display text-lg font-bold text-primary">Overall {overall}</span>
          </div>
          {set.map((s) => (
            <div key={s.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {s.label} <span className="text-muted-foreground">({s.key})</span>
                </span>
                <span className="font-display text-base font-bold tabular-nums text-primary">
                  {skills[s.key] ?? 1}
                </span>
              </div>
              <Slider
                value={[skills[s.key] ?? 1]}
                min={1}
                max={99}
                step={1}
                onValueChange={([v]) => setSkills((prev) => ({ ...prev, [s.key]: v ?? 1 }))}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} size="lg" className="flex-1">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Salvar alterações" : "Salvar jogador"}
          </Button>
          {(editing || canCancel) && (
            <Button variant="outline" size="lg" onClick={onCancelEdit}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 lg:sticky lg:top-6 lg:self-start">
        <p className="font-display text-sm tracking-widest text-muted-foreground">
          {revealed ? "Carta revelada" : "Pré-visualização"}
        </p>
        {revealed ? (
          <PlayerCard
            key={revealed.id + revealed.overall}
            name={revealed.name}
            position={revealed.position}
            skills={revealed.skills}
            weakFoot={revealed.weak_foot}
            photoUrl={revealed.photo_url}
            overall={revealed.overall}
            size="lg"
            revealing
          />
        ) : (
          <PlayerCard name={name} position={position} skills={skills} weakFoot={weakFoot} photoUrl={photo} size="lg" />
        )}
      </div>

      <PhotoCropper
        source={cropSource}
        onCancel={closeCropper}
        onConfirm={(adjusted) => {
          setPhoto(adjusted);
          closeCropper();
        }}
      />
    </div>
  );
}
