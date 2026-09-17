import { createContext, useContext } from "react";

export type ToastType = "success" | "error" | "warning";

export type ToastContextValue = {
  showToast: (message: string, sticky?: boolean, type?: ToastType) => void;
  dismissAll: () => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
