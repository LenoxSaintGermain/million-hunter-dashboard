/**
 * Thin shim around sonner's `toast` so existing imports of
 * `useToast` from "@/hooks/use-toast" continue to work.
 */
import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  const toast = ({ title, description, variant }: ToastOptions) => {
    if (variant === "destructive") {
      sonnerToast.error(title ?? "Error", { description });
    } else {
      sonnerToast.success(title ?? "", { description });
    }
  };
  return { toast };
}
