import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Compass, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExperienceMode = "guided" | "pro";

interface ExperienceModeContextType {
  mode: ExperienceMode;
  setMode: (mode: ExperienceMode) => void;
  isGuided: boolean;
  isPro: boolean;
  toggleMode: () => void;
}

const STORAGE_KEY = "sh_aperture_experience_mode";

const ExperienceModeContext = createContext<ExperienceModeContextType | null>(null);

export function ExperienceModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ExperienceMode>(() => {
    if (typeof window === "undefined") return "guided";
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "pro" || saved === "guided") return saved;
    } catch {
      // Local storage unavailable
    }
    return "guided";
  });

  const setMode = (newMode: ExperienceMode) => {
    setModeState(newMode);
    try {
      window.localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // Storage access blocked
    }
  };

  const toggleMode = () => {
    setMode(mode === "guided" ? "pro" : "guided");
  };

  return (
    <ExperienceModeContext.Provider
      value={{
        mode,
        setMode,
        isGuided: mode === "guided",
        isPro: mode === "pro",
        toggleMode,
      }}
    >
      {children}
    </ExperienceModeContext.Provider>
  );
}

export function useExperienceMode(): ExperienceModeContextType {
  const context = useContext(ExperienceModeContext);
  if (!context) {
    // Graceful fallback if rendered outside provider
    return {
      mode: "guided",
      setMode: () => {},
      isGuided: true,
      isPro: false,
      toggleMode: () => {},
    };
  }
  return context;
}

export function ExperienceModeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useExperienceMode();

  return (
    <div
      role="group"
      aria-label="Experience Mode Switch"
      className={cn(
        "inline-flex items-center rounded-md border border-rule bg-surface p-0.5 text-xs shadow-sm",
        className
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === "guided"}
        onClick={() => setMode("guided")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-all",
          mode === "guided"
            ? "bg-amber/15 text-amber-900 dark:text-amber-300 font-semibold shadow-xs"
            : "text-muted-foreground hover:text-ink"
        )}
      >
        <Sparkles className="h-3 w-3 text-amber" />
        <span>Guided (On-Rails)</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={mode === "pro"}
        onClick={() => setMode("pro")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-all",
          mode === "pro"
            ? "bg-ink text-bone font-semibold shadow-xs"
            : "text-muted-foreground hover:text-ink"
        )}
      >
        <SlidersHorizontal className="h-3 w-3" />
        <span>Pro Cockpit</span>
      </button>
    </div>
  );
}
