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

/**
 * User-facing mode names (POC v3). The stored values and identifiers stay
 * "guided" / "pro" so saved preferences keep working: "guided" is shown as
 * Quick Play and "pro" as Strategist.
 */
export const EXPERIENCE_MODE_LABELS: Record<ExperienceMode, string> = {
  guided: "Quick Play",
  pro: "Strategist",
};

export const EXPERIENCE_MODE_DESCRIPTIONS: Record<ExperienceMode, string> = {
  guided: "Plain steps, one decision at a time",
  pro: "Full research, limits and order detail",
};

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
      aria-label="Experience mode"
      className={cn(
        "inline-flex items-center rounded-md border border-rule bg-[var(--sh-surface-1)] p-0.5 text-xs shadow-sm",
        className
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === "guided"}
        onClick={() => setMode("guided")}
        title={EXPERIENCE_MODE_DESCRIPTIONS.guided}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-all",
          mode === "guided"
            ? "bg-amber/15 text-amber-900 dark:text-amber-300 font-semibold shadow-xs"
            : "text-muted-foreground hover:text-ink"
        )}
      >
        <Sparkles className="h-3 w-3 text-amber" />
        <span>{EXPERIENCE_MODE_LABELS.guided}</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={mode === "pro"}
        onClick={() => setMode("pro")}
        title={EXPERIENCE_MODE_DESCRIPTIONS.pro}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-all",
          mode === "pro"
            ? "bg-ink text-bone font-semibold shadow-xs"
            : "text-muted-foreground hover:text-ink"
        )}
      >
        <SlidersHorizontal className="h-3 w-3" />
        <span>{EXPERIENCE_MODE_LABELS.pro}</span>
      </button>
    </div>
  );
}
