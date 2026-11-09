import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, LogOut, Plus, Trash2, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GameStylesPanel } from "@/components/GameStylesPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSection,
  deleteSection,
  getSectionMembers,
  joinSection,
  leaveSection,
  removeSectionMember,
  type Section,
} from "@/lib/sections";

type Props = {
  section: Section | null;
  onChanged: () => Promise<void>;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}

export function SectionHub({ section, onChanged }: Props) {
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!section) {
      setInviteCode(new URLSearchParams(window.location.search).get("invite")?.toUpperCase() ?? "");
    }
  }, [section]);

  const membersQuery = useQuery({
    queryKey: ["section-members", section?.section_id],
    queryFn: () => getSectionMembers(section!.section_id),
    enabled: !!section,
    staleTime: 5 * 60_000,
  });

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    try {
      await action();
      await onChanged();
      toast.success(successMessage);
    } catch (error) {
      console.error("Section action failed:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteLink() {
    if (!section) return;
    const link = `${window.location.origin}/?invite=${encodeURIComponent(section.invite_code)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link de convite copiado.");
    } catch (error) {
      console.error("Unable to copy section invite link:", error);
      toast.error("Não foi possível copiar o link. Use o código de convite exibido.");
    }
  }

  if (!section) {
    return (
      <section className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
        <form
          className="space-y-4 rounded-2xl border border-border bg-card p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(() => createSection(name), "Seção criada!");
          }}
        >
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Criar seção</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Você será o administrador. A seção pode ter até 24 participantes, incluindo você.
          </p>
          <div className="space-y-2">
            <Label htmlFor="section-name">Nome da seção</Label>
            <Input
              id="section-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={50}
              required
              placeholder="Ex.: Pelada de quarta"
            />
          </div>
          <Button className="w-full" disabled={busy}>
            Criar minha seção
          </Button>
        </form>

        <form
          className="space-y-4 rounded-2xl border border-border bg-card p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(async () => {
              await joinSection(inviteCode);
              window.history.replaceState({}, "", window.location.pathname);
            }, "Você entrou na seção!");
          }}
        >
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Entrar em uma seção</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Use o link ou o código que o administrador compartilhou com você.
          </p>
          <div className="space-y-2">
            <Label htmlFor="section-invite">Código de convite</Label>
            <Input
              id="section-invite"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              maxLength={32}
              required
              placeholder="Ex.: A1B2C3D4"
            />
          </div>
          <Button className="w-full" disabled={busy}>
            Entrar na seção
          </Button>
        </form>
      </section>
    );
  }

  const members = membersQuery.data ?? [];

  return (
    <section className="mx-auto mb-6 max-w-6xl rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold text-foreground">{section.name}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {section.is_admin ? "Administrador" : "Participante"} · {section.member_count}/24
            participantes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-border px-3 py-2 font-mono text-sm tracking-widest">
            {section.invite_code}
          </div>
          <Button type="button" variant="secondary" onClick={() => void copyInviteLink()}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar convite
          </Button>
          {section.is_admin ? (
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Excluir esta seção removerá todos os participantes dela. Seus jogadores continuarão salvos sem uma seção. Deseja continuar?",
                  )
                ) {
                  void runAction(() => deleteSection(section.section_id), "Seção excluída.");
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir seção
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm("Deseja sair desta seção? Você poderá entrar em outra depois.")
                ) {
                  void runAction(() => leaveSection(section.section_id), "Você saiu da seção.");
                }
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair da seção
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Participantes</h3>
        {membersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando participantes...</p>
        ) : membersQuery.error ? (
          <div>
            <p className="text-sm text-destructive">Não foi possível carregar os participantes.</p>
            <Button
              type="button"
              variant="link"
              className="px-0"
              onClick={() => void membersQuery.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <li
                key={member.user_id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {member.player_name ?? `Participante ${member.user_id.slice(0, 8)}`}
                  {member.is_admin && <span className="ml-2 text-xs text-primary">Admin</span>}
                </span>
                {section.is_admin && !member.is_admin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={`Remover ${member.player_name ?? "participante"} da seção`}
                    onClick={() => {
                      const label = member.player_name ?? "este participante";
                      if (window.confirm(`Remover ${label} da seção?`)) {
                        void runAction(
                          () => removeSectionMember(section.section_id, member.user_id),
                          `${label} foi removido da seção.`,
                        );
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <GameStylesPanel sectionId={section.section_id} isAdmin={section.is_admin} />
    </section>
  );
}
