import { useEffect, useRef, useState } from "react";
import { Check, Move, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type CropSource = {
  file: File;
  url: string;
};

type Point = { x: number; y: number };

type Props = {
  source: CropSource | null;
  onCancel: () => void;
  onConfirm: (photo: string) => void;
};

const OUTPUT_SIZE = 512;

export function PhotoCropper({ source, onCancel, onConfirm }: Props) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<Point>({ x: 0, y: 0 });
  const offsetStart = useRef<Point>({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!source) return;
    const next = new Image();
    next.onload = () => {
      setImage(next);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    next.src = source.url;
  }, [source]);

  const frameSize = frameRef.current?.clientWidth ?? 320;
  const naturalScale = image ? Math.max(frameSize / image.width, frameSize / image.height) : 1;
  const renderedWidth = image ? image.width * naturalScale * zoom : frameSize;
  const renderedHeight = image ? image.height * naturalScale * zoom : frameSize;
  const maxX = Math.max(0, (renderedWidth - frameSize) / 2);
  const maxY = Math.max(0, (renderedHeight - frameSize) / 2);
  const clampedOffset = {
    x: Math.max(-maxX, Math.min(maxX, offset.x)),
    y: Math.max(-maxY, Math.min(maxY, offset.y)),
  };

  function moveTo(clientX: number, clientY: number) {
    const next = {
      x: offsetStart.current.x + clientX - dragStart.current.x,
      y: offsetStart.current.y + clientY - dragStart.current.y,
    };
    setOffset({
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    });
  }

  function confirmCrop() {
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const outputScale = OUTPUT_SIZE / frameSize;
    const drawWidth = renderedWidth * outputScale;
    const drawHeight = renderedHeight * outputScale;
    const drawX = (frameSize / 2 + clampedOffset.x) * outputScale - drawWidth / 2;
    const drawY = (frameSize / 2 + clampedOffset.y) * outputScale - drawHeight / 2;
    const isPng = source?.file.type === "image/png";
    if (!isPng) {
      ctx.fillStyle = "#13251c";
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    }
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    onConfirm(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", isPng ? undefined : 0.86));
  }

  return (
    <Dialog open={Boolean(source)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[96vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Ajustar foto</DialogTitle>
          <DialogDescription>Arraste para posicionar o rosto dentro da carta.</DialogDescription>
        </DialogHeader>

        <div
          ref={frameRef}
          className="relative mx-auto aspect-square w-full max-w-80 touch-none cursor-grab overflow-hidden rounded-lg border-2 border-primary bg-surface active:cursor-grabbing"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
            dragStart.current = { x: event.clientX, y: event.clientY };
            offsetStart.current = clampedOffset;
          }}
          onPointerMove={(event) => dragging && moveTo(event.clientX, event.clientY)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          {image && (
            <img
              src={source?.url}
              alt="Foto sendo ajustada"
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: renderedWidth,
                height: renderedHeight,
                transform: `translate(calc(-50% + ${clampedOffset.x}px), calc(-50% + ${clampedOffset.y}px))`,
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 border-[3px] border-primary/70 shadow-[inset_0_0_0_999px_color-mix(in_oklab,var(--background)_20%,transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-primary/35" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-primary/35" />
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur">
            <Move className="h-3.5 w-3.5" /> Arraste a foto
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="foto-zoom" className="flex items-center gap-2">
              <ZoomIn className="h-4 w-4" /> Zoom
            </Label>
            <span className="text-sm tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
          </div>
          <Slider
            id="foto-zoom"
            value={[zoom]}
            min={1}
            max={3}
            step={0.01}
            onValueChange={([value]) => {
              setZoom(value ?? 1);
              setOffset((current) => current);
            }}
          />
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="button" onClick={confirmCrop} disabled={!image}>
            <Check className="mr-2 h-4 w-4" /> Usar esta foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { CropSource };