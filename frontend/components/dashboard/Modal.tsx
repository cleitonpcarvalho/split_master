"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg";
}

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  size = "md",
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-navy/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
    >
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white p-5 shadow-2xl sm:rounded-[1.75rem] sm:p-7 ${
          size === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-xl font-extrabold text-navy">{title}</h2>
            {description && (
              <p className="mt-1 text-sm leading-6 text-navy/55">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-lg p-2 text-navy/45 transition hover:bg-navy/5 hover:text-navy"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
