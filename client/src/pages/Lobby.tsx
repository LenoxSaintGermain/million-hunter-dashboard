/**
 * Lobby — First-login cinematic onboarding experience.
 * Shown once to new users before they enter the dashboard.
 * Two chapters from NotebookLM walkthroughs.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Play, Pause, Volume2, VolumeX,
  ChevronRight, SkipForward, ArrowRight,
  CheckCircle2,
} from "lucide-react";

// ─── Chapter definitions ───────────────────────────────────────────────────────
const CHAPTERS = [
  {
    id: 1,
    title: "The Math of Zero-Tax Arbitrage",
    subtitle: "Chapter I",
    description:
      "How Signal Hunter turns Opportunity Zones and Tax Allocation Districts into a structural edge — not a loophole, but a lever.",
    duration: "~8 min",
    videoUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/87291783/GeCPeFFiEBRZFpk6xckkAz/Signal_Hunter_OS__The_Math_of_Zero-Tax_Arbitrage_642c7fa9.mp4",
    tag: "Tax Architecture",
    tagColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  },
  {
    id: 2,
    title: "Architecting the Mainstreet Investor OS",
    subtitle: "Chapter II",
    description:
      "From pipeline to swarm — how the agentic acquisition engine finds, scores, and closes deals while you sleep.",
    duration: "~12 min",
    videoUrl:
      "https://d2xsxph8kpxj0f.cloudfront.net/87291783/GeCPeFFiEBRZFpk6xckkAz/Architecting_the_Mainstreet_Investor_OS__From_Pipeline_to_Swarm_337bc30f.mp4",
    tag: "Agentic Architecture",
    tagColor: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  },
];

// ─── Progress bar ──────────────────────────────────────────────────────────────
function VideoProgress({
  current,
  total,
  onSeek,
}: {
  current: number;
  total: number;
  onSeek: (pct: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const pct = total > 0 ? (current / total) * 100 : 0;

  const handleClick = (e: React.MouseEvent) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    onSeek((e.clientX - rect.left) / rect.width);
  };

  return (
    <div
      ref={barRef}
      className="w-full h-1 bg-white/10 rounded-full cursor-pointer group"
      onClick={handleClick}
    >
      <div
        className="h-full bg-white/80 rounded-full transition-all duration-100 group-hover:bg-white relative"
        style={{ width: `${pct}%` }}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
      </div>
    </div>
  );
}

// ─── Format seconds → m:ss ────────────────────────────────────────────────────
function fmtTime(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Main Lobby component ─────────────────────────────────────────────────────
export default function Lobby() {
  const [, navigate] = useLocation();
  const [chapterIdx, setChapterIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [showChapterSelect, setShowChapterSelect] = useState(false);
  const [entered, setEntered] = useState(false); // fade-in gate

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chapter = CHAPTERS[chapterIdx];
  const isLastChapter = chapterIdx === CHAPTERS.length - 1;
  const allCompleted = completed.size === CHAPTERS.length;

  const markOnboarding = trpc.user.markOnboardingComplete.useMutation();

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Auto-hide controls after 3s of inactivity
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (playing) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    resetControlsTimer();
  }, [playing, resetControlsTimer]);

  // Video event handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };
  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };
  const handleEnded = () => {
    setPlaying(false);
    setCompleted((prev) => new Set([...prev, chapter.id]));
    setShowControls(true);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const handleSeek = (pct: number) => {
    if (!videoRef.current || !duration) return;
    videoRef.current.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const goToChapter = (idx: number) => {
    setChapterIdx(idx);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setShowChapterSelect(false);
    setShowControls(true);
  };

  const handleEnterDashboard = async () => {
    await markOnboarding.mutateAsync();
    navigate("/");
  };

  const handleSkip = async () => {
    await markOnboarding.mutateAsync();
    navigate("/");
  };

  return (
    <div
      className={cn(
        "fixed inset-0 bg-black flex flex-col transition-opacity duration-700",
        entered ? "opacity-100" : "opacity-0"
      )}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* ── Video layer ── */}
      <video
        ref={videoRef}
        key={chapter.videoUrl}
        src={chapter.videoUrl}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* ── Gradient overlays ── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/60 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-transparent pointer-events-none" />

      {/* ── Top bar ── */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 pt-6 pb-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Logo / brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground">SH</span>
          </div>
          <span className="text-sm font-semibold text-white/90 tracking-wide">Signal Hunter</span>
        </div>

        {/* Chapter selector pill */}
        <button
          onClick={() => setShowChapterSelect(!showChapterSelect)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 transition-colors backdrop-blur-sm"
        >
          <span className="text-xs text-white/80 font-medium">
            {chapter.subtitle} of {CHAPTERS.length}
          </span>
          <ChevronRight className="w-3 h-3 text-white/60" />
        </button>

        {/* Skip */}
        <button
          onClick={handleSkip}
          className="text-xs text-white/50 hover:text-white/80 transition-colors flex items-center gap-1"
        >
          Skip intro
          <SkipForward className="w-3 h-3" />
        </button>
      </div>

      {/* ── Chapter selector dropdown ── */}
      {showChapterSelect && (
        <div className="absolute top-16 right-6 z-30 w-72 rounded-xl bg-black/90 border border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl">
          {CHAPTERS.map((ch, idx) => (
            <button
              key={ch.id}
              onClick={() => goToChapter(idx)}
              className={cn(
                "w-full flex items-start gap-3 p-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0",
                idx === chapterIdx && "bg-white/8"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                completed.has(ch.id)
                  ? "bg-emerald-500 border-emerald-500"
                  : idx === chapterIdx
                  ? "border-white/60"
                  : "border-white/20"
              )}>
                {completed.has(ch.id) ? (
                  <CheckCircle2 className="w-3 h-3 text-white" />
                ) : (
                  <span className="text-[9px] text-white/60 font-bold">{idx + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/90 leading-snug">{ch.title}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{ch.duration}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Center play button (shown when paused) ── */}
      {!playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center group"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 group-hover:scale-105 transition-all duration-200 shadow-2xl">
            <Play className="w-7 h-7 md:w-8 md:h-8 text-white fill-white ml-1" />
          </div>
        </button>
      )}

      {/* ── Bottom info + controls ── */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-20 px-5 pb-6 pt-8 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Chapter info */}
        <div className="mb-4 max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-widest">
              {chapter.subtitle}
            </span>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", chapter.tagColor)}>
              {chapter.tag}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-tight mb-1.5">
            {chapter.title}
          </h2>
          <p className="text-sm text-white/55 leading-relaxed max-w-lg hidden md:block">
            {chapter.description}
          </p>
        </div>

        {/* Progress bar */}
        <VideoProgress current={currentTime} total={duration} onSeek={handleSeek} />

        {/* Controls row */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              {playing ? (
                <Pause className="w-3.5 h-3.5 text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
              )}
            </button>

            {/* Mute */}
            <button
              onClick={toggleMute}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 text-white/60" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-white" />
              )}
            </button>

            {/* Time */}
            <span className="text-[11px] text-white/40 font-mono tabular-nums">
              {fmtTime(currentTime)} / {fmtTime(duration)}
            </span>
          </div>

          {/* Right side: next chapter or enter dashboard */}
          <div className="flex items-center gap-2">
            {/* Chapter dots */}
            <div className="flex items-center gap-1.5 mr-2">
              {CHAPTERS.map((ch, idx) => (
                <button
                  key={ch.id}
                  onClick={() => goToChapter(idx)}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    idx === chapterIdx
                      ? "w-4 h-1.5 bg-white"
                      : completed.has(ch.id)
                      ? "w-1.5 h-1.5 bg-emerald-400"
                      : "w-1.5 h-1.5 bg-white/25 hover:bg-white/50"
                  )}
                />
              ))}
            </div>

            {isLastChapter ? (
              <Button
                size="sm"
                onClick={handleEnterDashboard}
                className="h-8 px-4 text-xs font-semibold bg-white text-black hover:bg-white/90 gap-1.5"
                disabled={markOnboarding.isPending}
              >
                Enter Dashboard
                <ArrowRight className="w-3 h-3" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => goToChapter(chapterIdx + 1)}
                className="h-8 px-3 text-xs border-white/20 text-white/80 hover:bg-white/10 hover:text-white gap-1.5 bg-transparent"
              >
                Next Chapter
                <ChevronRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── All-watched CTA overlay ── */}
      {allCompleted && !playing && (
        <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto text-center px-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">You're briefed.</h3>
            <p className="text-sm text-white/50 mb-6 max-w-xs mx-auto">
              The paradigm is clear. The edge is structural. Time to hunt.
            </p>
            <Button
              onClick={handleEnterDashboard}
              className="bg-white text-black hover:bg-white/90 font-semibold px-6 gap-2"
              disabled={markOnboarding.isPending}
            >
              Enter Signal Hunter
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
