"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REQUIRED_PHRASE = "Delete";

interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel = "Remove",
  onClose,
  onConfirm,
  isConfirming = false,
}: ConfirmDeleteDialogProps) {
  const titleId = useId();
  const descId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) {
      setValue("");
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canConfirm = value === REQUIRED_PHRASE && !isConfirming;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        <p id={descId} className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
        <div className="mt-4 space-y-2">
          <Label htmlFor="confirm-delete-input">
            Type <span className="font-mono font-semibold text-foreground">{REQUIRED_PHRASE}</span> to confirm
          </Label>
          <Input
            ref={inputRef}
            id="confirm-delete-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            disabled={isConfirming}
            className="font-mono"
            placeholder={REQUIRED_PHRASE}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isConfirming}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => void onConfirm()}
          >
            {isConfirming ? "Removing…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
