"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";

type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export interface ToastInput {
  title: string;
  detail?: string;
  variant?: ToastVariant;
  /** 自动关闭毫秒数，0 表示不自动关闭；默认 5000。 */
  duration?: number;
}

interface ToastItem {
  id: number;
  title: string;
  detail?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  warning: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast 必须在 <ToastProvider> 内使用");
  return ctx;
}

const VARIANT_ICONS: Record<ToastVariant, typeof InfoIcon> = {
  default: InfoIcon,
  info: InfoIcon,
  success: CheckCircle2Icon,
  error: AlertCircleIcon,
  warning: TriangleAlertIcon,
};

const VARIANT_CLASS: Record<ToastVariant, string> = {
  default: "text-foreground",
  info: "text-blue-600 dark:text-blue-400",
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-destructive",
  warning: "text-amber-600 dark:text-amber-400",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current;
      setToasts((prev) => [
        ...prev,
        { id, title: input.title, detail: input.detail, variant: input.variant ?? "default" },
      ]);
      const duration = input.duration ?? DEFAULT_DURATION;
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, detail) => toast({ title, detail, variant: "success" }),
      error: (title, detail) => toast({ title, detail, variant: "error" }),
      warning: (title, detail) => toast({ title, detail, variant: "warning" }),
      info: (title, detail) => toast({ title, detail, variant: "info" }),
      dismiss,
    }),
    [toast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = VARIANT_ICONS[toast.variant];
  return (
    <div
      role="status"
      className={cn(
        "animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", VARIANT_CLASS[toast.variant])} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{toast.title}</div>
        {toast.detail && (
          <div className="mt-0.5 text-xs break-words text-muted-foreground">{toast.detail}</div>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="关闭"
        aria-label="关闭"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}