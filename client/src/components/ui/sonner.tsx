import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--sh-surface-2,#1e2a34)] group-[.toaster]:text-[var(--sh-text-primary,#dae3ee)] group-[.toaster]:border-[var(--sh-border-1,#2d363e)] group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl group-[.toaster]:p-4 group-[.toaster]:max-w-md group-[.toaster]:backdrop-blur-none",
          description: "group-[.toast]:text-[var(--sh-fg-muted,#9ca3af)] group-[.toast]:text-xs leading-relaxed mt-1",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toaster]:border-[var(--sh-red,#ef4444)]/50 group-[.toaster]:bg-[var(--sh-surface-2,#1e2a34)]",
        },
        style: {
          background: "var(--sh-surface-2, #1e2a34)",
          color: "var(--sh-text-primary, #dae3ee)",
          border: "1px solid var(--sh-border-1, #2d363e)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
        },
      }}
      style={
        {
          "--normal-bg": "var(--sh-surface-2, #1e2a34)",
          "--normal-text": "var(--sh-text-primary, #dae3ee)",
          "--normal-border": "var(--sh-border-1, #2d363e)",
          "--error-bg": "var(--sh-surface-2, #1e2a34)",
          "--error-text": "var(--sh-text-primary, #dae3ee)",
          "--error-border": "var(--sh-red, #ef4444)",
          "--success-bg": "var(--sh-surface-2, #1e2a34)",
          "--success-text": "var(--sh-text-primary, #dae3ee)",
          "--success-border": "var(--sh-emerald, #10b981)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
