import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { PlayerForm } from "@/components/PlayerForm";
import type { Player } from "@/lib/players";
import type { PlayerInput } from "@/lib/player-queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Player | null;
  isNew: boolean;
  isAdmin: boolean;
  sectionId: string;
  onSubmit: (input: PlayerInput) => Promise<Player>;
  onDone: (saved: Player) => void;
  draftKey?: string;
};

export function PlayerFormDialog({
  open,
  onOpenChange,
  editing,
  isNew,
  isAdmin,
  sectionId: _sectionId,
  onSubmit,
  onDone,
  draftKey,
}: Props) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Ref para disparar o save do PlayerForm sem prop-drilling complexo
  const submitRef = useRef<(() => Promise<void>) | null>(null);

  const title = isNew ? "Novo jogador" : editing ? `Editar ${editing.name}` : "Meu jogador";

  const description = isNew
    ? isAdmin
      ? "Preencha os dados do novo jogador da seção."
      : "Preencha seus dados para criar seu card."
    : "Atualize as informações do jogador.";

  async function handleSave() {
    if (!submitRef.current) return;
    setSaving(true);
    try {
      await submitRef.current();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      dirty={dirty}
      footer={
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Salvando..." : editing || !isNew ? "Salvar alterações" : "Salvar jogador"}
          </Button>
        </div>
      }
    >
      <PlayerForm
        editing={editing}
        canCancel={false}
        onSubmit={onSubmit}
        onDone={(saved) => {
          setDirty(false);
          onDone(saved);
        }}
        draftKey={draftKey}
        onDirtyChange={setDirty}
        onRegisterSubmit={(fn) => {
          submitRef.current = fn;
        }}
      />
    </ResponsiveDialog>
  );
}
