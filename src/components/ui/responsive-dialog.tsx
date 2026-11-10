import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode | ((actions: { requestClose: () => void }) => React.ReactNode);
  /** Se true, exibe AlertDialog de descarte ao tentar fechar */
  dirty?: boolean;
};

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dirty = false,
}: ResponsiveDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  function handleClose() {
    if (dirty) {
      setConfirmDiscard(true);
    } else {
      onOpenChange(false);
    }
  }

  // Descarte confirmado
  function discard() {
    setConfirmDiscard(false);
    onOpenChange(false);
  }

  const footerContent =
    typeof footer === "function" ? footer({ requestClose: handleClose }) : footer;

  if (isDesktop) {
    return (
      <>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!next) handleClose();
          }}
        >
          <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
              <DialogTitle className="font-display text-xl font-bold uppercase">
                {title}
              </DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              {children}
            </div>
            {footerContent && (
              <div className="shrink-0 border-t border-border bg-background px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
                {footerContent}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <DiscardAlert
          open={confirmDiscard}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={discard}
        />
      </>
    );
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
      >
        <DrawerContent className="flex max-h-[90dvh] flex-col">
          <DrawerHeader className="shrink-0 border-b border-border px-4 pb-3 pt-5 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DrawerTitle className="font-display text-xl font-bold uppercase">
                  {title}
                </DrawerTitle>
                <DrawerDescription className="mt-1">{description}</DrawerDescription>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="-mr-2 -mt-2 flex min-h-11 min-w-11 items-center justify-center rounded-sm p-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </button>
            </div>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {children}
          </div>
          {footerContent && (
            <div
              className={cn(
                "shrink-0 border-t border-border bg-background px-4 pt-3",
                "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
              )}
            >
              {footerContent}
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <DiscardAlert
        open={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={discard}
      />
    </>
  );
}

function DiscardAlert({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
          <AlertDialogDescription>
            As alterações feitas ainda não foram salvas e serão perdidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Continuar editando</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Descartar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
