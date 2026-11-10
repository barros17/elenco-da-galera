import { useEffect, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { createSection, joinSection } from "@/lib/sections";

type Dialogo = "criar-secao" | "entrar-secao" | undefined;

type Props = {
  onChanged: () => Promise<void>;
  initialDialogo?: Dialogo;
  onCloseDialogo?: () => void;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}

export function SectionHubSemSecao({ onChanged, initialDialogo, onCloseDialogo }: Props) {
  const [dialogo, setDialogo] = useState<Dialogo>(initialDialogo);
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Pré-preenche o código de convite vindo da URL (?invite=...)
  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (invite) {
      setInviteCode(invite.toUpperCase());
      setDialogo("entrar-secao");
    }
  }, []);

  function openDialogo(d: Dialogo) {
    setDialogo(d);
  }

  function closeDialogo() {
    setDialogo(undefined);
    onCloseDialogo?.();
  }

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    try {
      await action();
      await onChanged();
      toast.success(successMessage);
      closeDialogo();
    } catch (error) {
      console.error("Section action failed:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md py-12">
      <div className="mb-8 text-center">
        <img
          src="/elenco-da-galera.jpg"
          alt=""
          aria-hidden="true"
          className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover shadow-glow-gold"
        />
        <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight text-foreground">
          ELENCO
          <span className="block text-primary">DA GALERA</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Crie uma seção para a sua turma ou entre em uma existente.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          className="h-14 w-full font-display text-base uppercase tracking-wide"
          onClick={() => openDialogo("criar-secao")}
        >
          <Plus className="mr-2 h-5 w-5" />
          Criar minha seção
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 w-full font-display text-base uppercase tracking-wide"
          onClick={() => openDialogo("entrar-secao")}
        >
          <UserPlus className="mr-2 h-5 w-5" />
          Entrar com código
        </Button>
      </div>

      {/* Pop-up: Criar seção */}
      <ResponsiveDialog
        open={dialogo === "criar-secao"}
        onOpenChange={(open) => !open && closeDialogo()}
        title="Criar seção"
        description="Você será o administrador. A seção pode ter até 24 participantes, incluindo você."
        dirty={name.length > 0}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={closeDialogo} disabled={busy}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={busy || name.trim().length < 2}
              onClick={() => void runAction(() => createSection(name), "Seção criada!")}
            >
              Criar seção
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="section-name">Nome da seção</Label>
          <Input
            id="section-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={50}
            autoFocus
            placeholder="Ex.: Pelada de quarta"
          />
        </div>
      </ResponsiveDialog>

      {/* Pop-up: Entrar com código */}
      <ResponsiveDialog
        open={dialogo === "entrar-secao"}
        onOpenChange={(open) => !open && closeDialogo()}
        title="Entrar em uma seção"
        description="Use o link ou o código que o administrador compartilhou com você."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={closeDialogo} disabled={busy}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={busy || inviteCode.trim().length < 4}
              onClick={() =>
                void runAction(async () => {
                  await joinSection(inviteCode);
                  window.history.replaceState({}, "", window.location.pathname);
                }, "Você entrou na seção!")
              }
            >
              Entrar
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="section-invite">Código de convite</Label>
          <Input
            id="section-invite"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            maxLength={32}
            autoFocus
            placeholder="Ex.: A1B2C3D4"
          />
        </div>
      </ResponsiveDialog>
    </section>
  );
}
