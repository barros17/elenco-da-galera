import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  LogOut,
  MoreHorizontal,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GameStylesPanel } from "@/components/GameStylesPanel";
import {
  deleteSection,
  getSectionMembers,
  leaveSection,
  removeSectionMember,
  type Section,
} from "@/lib/sections";
import type { AppSearch } from "@/routes/index";

type Props = {
  section: Section;
  search: AppSearch;
  onChanged: () => Promise<void>;
  onNavigate: (params: Partial<AppSearch>) => void;
  onCloseDialog: () => void;
};

type PendingAction =
  "excluir-secao" | "sair-secao" | { type: "remover-membro"; userId: string; name: string } | null;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}

export function AbaSecao({ section, search, onChanged, onNavigate, onCloseDialog }: Props) {
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmName, setConfirmName] = useState("");
  const [dangerOpen, setDangerOpen] = useState(false);

  const membersQuery = useQuery({
    queryKey: ["section-members", section.section_id],
    queryFn: () => getSectionMembers(section.section_id),
    staleTime: 5 * 60_000,
  });

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    try {
      await action();
      await onChanged();
      toast.success(successMessage);
      setPendingAction(null);
      setConfirmName("");
    } catch (error) {
      console.error("Section action failed:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteLink() {
    const link = `${window.location.origin}/?invite=${encodeURIComponent(section.invite_code)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link de convite copiado.");
    } catch {
      toast.error("Não foi possível copiar o link. Use o código de convite exibido.");
    }
  }

  async function shareInviteLink() {
    const link = `${window.location.origin}/?invite=${encodeURIComponent(section.invite_code)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Entre na seção ${section.name}`, url: link });
      } catch {
        // ignorado (usuário cancelou o compartilhamento)
      }
    } else {
      await copyInviteLink();
    }
  }

  const members = membersQuery.data ?? [];
  const canDeleteSection = confirmName === section.name;

  // ─── AlertDialog para ações confirmadas ──────────────────────────────────────

  function alertTitle() {
    if (pendingAction === "excluir-secao") return "Excluir seção?";
    if (pendingAction === "sair-secao") return "Sair da seção?";
    if (typeof pendingAction === "object" && pendingAction?.type === "remover-membro")
      return `Remover ${pendingAction.name}?`;
    return "";
  }

  function alertDescription() {
    if (pendingAction === "excluir-secao")
      return "Esta ação é irreversível. Todos os membros serão removidos da seção. Seus jogadores continuarão salvos, mas sem seção.";
    if (pendingAction === "sair-secao")
      return "Você sairá desta seção. Seus jogadores continuarão salvos. Você poderá entrar em outra seção depois.";
    if (typeof pendingAction === "object" && pendingAction?.type === "remover-membro")
      return `${pendingAction.name} será removido da seção e perderá acesso aos jogos. Os dados do jogador continuarão salvos.`;
    return "";
  }

  async function executeAction() {
    if (pendingAction === "excluir-secao") {
      await runAction(() => deleteSection(section.section_id), "Seção excluída.");
    } else if (pendingAction === "sair-secao") {
      await runAction(() => leaveSection(section.section_id), "Você saiu da seção.");
    } else if (typeof pendingAction === "object" && pendingAction?.type === "remover-membro") {
      await runAction(
        () => removeSectionMember(section.section_id, pendingAction.userId),
        `${pendingAction.name} foi removido da seção.`,
      );
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6 animate-rise">
      {/* ── Resumo ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold text-foreground">{section.name}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {section.is_admin ? "Administrador" : "Participante"} · {section.member_count}/24
          participantes
        </p>
      </div>

      {/* ── Convite ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
          Convite
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="rounded-lg border border-border px-3 py-2 font-mono text-sm tracking-widest">
            {section.invite_code}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void copyInviteLink()}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar convite
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void shareInviteLink()}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Compartilhar
            </Button>
          )}
        </div>
      </div>

      {/* ── Participantes ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
          Participantes
        </h3>
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
          <ul className="space-y-1">
            {members.map((member) => {
              const name = member.player_name ?? `Participante ${member.user_id.slice(0, 8)}`;
              return (
                <li
                  key={member.user_id}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <span className="min-w-0 truncate">
                    {name}
                    {member.is_admin && (
                      <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        Admin
                      </span>
                    )}
                  </span>
                  {section.is_admin && !member.is_admin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Opções para ${name}`}
                          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() =>
                            setPendingAction({
                              type: "remover-membro",
                              userId: member.user_id,
                              name,
                            })
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover da seção
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Estilos de jogo (só admin) ────────────────────────────────────── */}
      {section.is_admin && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <GameStylesPanel
            sectionId={section.section_id}
            isAdmin={section.is_admin}
            search={search}
            onNavigate={onNavigate}
            onCloseDialog={onCloseDialog}
          />
        </div>
      )}

      {/* ── Conta ─────────────────────────────────────────────────────────── */}
      {/* Gerenciada via menu da conta no header */}

      {/* ── Zona de perigo ───────────────────────────────────────────────── */}
      <Collapsible open={dangerOpen} onOpenChange={setDangerOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-destructive/40 bg-destructive/5 px-5 py-4 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <span>Zona de perigo</span>
            {dangerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-2xl border border-destructive/30 bg-card p-5 space-y-4">
            {section.is_admin ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Excluir a seção removerá todos os participantes dela. Os dados dos jogadores são
                  mantidos.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={busy}
                  onClick={() => {
                    setPendingAction("excluir-secao");
                    setConfirmName("");
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir seção
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Ao sair da seção, você poderá entrar em outra depois. Seus dados de jogador são
                  mantidos.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={busy}
                  onClick={() => setPendingAction("sair-secao")}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair da seção
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── AlertDialog de confirmação ────────────────────────────────────── */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setConfirmName("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertTitle()}</AlertDialogTitle>
            <AlertDialogDescription>{alertDescription()}</AlertDialogDescription>
          </AlertDialogHeader>

          {/* Para excluir seção: exige digitar o nome */}
          {pendingAction === "excluir-secao" && (
            <div className="space-y-2">
              <Label htmlFor="confirm-section-name" className="text-sm">
                Para confirmar, digite o nome da seção:{" "}
                <strong className="text-foreground">{section.name}</strong>
              </Label>
              <Input
                id="confirm-section-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={section.name}
                autoFocus
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingAction(null);
                setConfirmName("");
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || (pendingAction === "excluir-secao" && !canDeleteSection)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void executeAction();
              }}
            >
              {pendingAction === "excluir-secao"
                ? "Excluir definitivamente"
                : pendingAction === "sair-secao"
                  ? "Sair da seção"
                  : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
