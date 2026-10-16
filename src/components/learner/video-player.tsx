'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Captions,
  CaptionsOff,
  CheckCircle2,
  Keyboard,
  RotateCcw,
  SkipForward,
  Volume2,
} from 'lucide-react';

const SAVE_EVERY_SECONDS = 5;
const AUTOPLAY_KEY = 'demolms-autoplay-next';
const COUNTDOWN_SECONDS = 5;

export interface UpNextLesson {
  id: number;
  title: string;
  href: string;
  durationMinutes: number;
}

/**
 * Video lesson player.
 *
 * - resumes from the saved position, with a visible "start over" escape hatch
 * - saves the position every few seconds, on pause and on unload
 * - captions toggle for the attached WebVTT track
 * - end-of-lesson overlay that can roll straight into the next lesson
 *   (preference remembered in localStorage), with a cancelable countdown
 * - keyboard shortcuts: space, ←/→, j/k/l, c, m, f
 *
 * Native browser controls are kept deliberately: they are keyboard accessible,
 * work with captions and fullscreen, and do not need to be reinvented.
 */
export function VideoPlayer({
  lessonId,
  src,
  captionsSrc,
  posterSrc,
  initialPosition,
  title,
  upNext,
}: {
  lessonId: number;
  src: string;
  captionsSrc: string | null;
  posterSrc: string | null;
  initialPosition: number;
  title: string;
  upNext: UpNextLesson | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedRef = useRef(0);
  const resumedRef = useRef(false);
  const router = useRouter();

  const [captionsOn, setCaptionsOn] = useState(true);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  /* ------------------------------------------------------------ position saving */

  const savePosition = useCallback(
    async (seconds: number, keepalive = false) => {
      try {
        setSaveState('saving');
        const response = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lessonId, positionSeconds: seconds }),
          keepalive,
        });
        setSaveState(response.ok ? 'saved' : 'error');
      } catch {
        setSaveState('error');
      }
    },
    [lessonId],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      const now = video.currentTime;
      if (Math.floor(now) - lastSavedRef.current >= SAVE_EVERY_SECONDS) {
        lastSavedRef.current = Math.floor(now);
        void savePosition(now);
      }
    };
    const onPause = () => void savePosition(video.currentTime);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('pause', onPause);
    };
  }, [savePosition]);

  useEffect(() => {
    const onBeforeUnload = () => {
      const video = videoRef.current;
      if (video && video.currentTime > 0) void savePosition(video.currentTime, true);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [savePosition]);

  /* ------------------------------------------------------------------ resume */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const applyResume = () => {
      if (resumedRef.current) return;
      resumedRef.current = true;
      const duration = video.duration || Infinity;
      if (initialPosition > 3 && initialPosition < duration - 5) {
        video.currentTime = initialPosition;
        setResumedFrom(initialPosition);
      }
    };
    if (video.readyState >= 1) {
      applyResume();
      return;
    }
    video.addEventListener('loadedmetadata', applyResume, { once: true });
    return () => video.removeEventListener('loadedmetadata', applyResume);
  }, [initialPosition]);

  /* --------------------------------------------------------------- captions */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (const track of Array.from(video.textTracks)) {
      track.mode = captionsOn && !failed ? 'showing' : 'hidden';
    }
  }, [captionsOn, failed]);

  /* -------------------------------------------------------------- autoplay */

  const readAutoplayPreference = (): boolean => {
    try {
      return window.localStorage.getItem(AUTOPLAY_KEY) === 'on';
    } catch {
      return false;
    }
  };

  const handleEnded = () => {
    setEnded(true);
    const preference = readAutoplayPreference();
    setAutoplay(preference);
    if (preference && upNext) setCountdown(COUNTDOWN_SECONDS);
  };

  const toggleAutoplay = () => {
    setAutoplay((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(AUTOPLAY_KEY, next ? 'on' : 'off');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const counting = countdown !== null;

  // tick the countdown while the end-of-lesson overlay is showing
  useEffect(() => {
    if (!counting) return;
    const tick = setInterval(() => {
      setCountdown((value) => (value === null || value <= 0 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [counting]);

  // roll into the next lesson once the countdown reaches zero
  useEffect(() => {
    if (countdown === 0 && upNext) router.push(upNext.href);
  }, [countdown, router, upNext]);

  /* -------------------------------------------------------------- shortcuts */

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video || failed || isTypingTarget(event.target)) return;

      switch (event.key.toLowerCase()) {
        case ' ':
        case 'k':
          event.preventDefault();
          if (video.paused) void video.play();
          else video.pause();
          break;
        case 'arrowleft':
        case 'j':
          event.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'arrowright':
        case 'l':
          event.preventDefault();
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
          break;
        case 'c':
          if (captionsSrc) setCaptionsOn((value) => !value);
          break;
        case 'm':
          video.muted = !video.muted;
          break;
        case 'f':
          if (document.fullscreenElement) void document.exitFullscreen();
          else void video.requestFullscreen?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [captionsSrc, failed]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-scrim">
        {failed ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm font-medium text-white">Media unavailable</p>
            <p className="max-w-md text-xs text-ink-300">
              The video file for this lesson is missing from public/uploads. An admin can upload it from
              the course builder, or run <code className="rounded bg-surface/10 px-1">npm run assets</code> to
              regenerate the sample clip.
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="aspect-video w-full"
            controls
            playsInline
            preload="metadata"
            poster={posterSrc ?? undefined}
            onError={() => setFailed(true)}
            onEnded={handleEnded}
            aria-label={title}
          >
            <source src={src} type="video/mp4" />
            {captionsSrc ? <track kind="captions" src={captionsSrc} srcLang="en" label="English" default /> : null}
          </video>
        )}

        {/* end-of-lesson overlay */}
        {ended && !failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-scrim/85 p-6 text-center backdrop-blur-sm">
            <CheckCircle2 className="size-10 text-success" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-white">Lesson finished</p>
              {upNext ? (
                <p className="mt-1 max-w-md text-xs text-white/70">
                  Up next: <span className="font-medium text-white">{upNext.title}</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-white/70">That was the last lesson in this course.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {upNext ? (
                <Link href={upNext.href} className="btn-primary btn-sm">
                  <SkipForward className="size-3.5" aria-hidden />
                  Play next lesson
                  {countdown !== null && countdown > 0 ? ` (${countdown})` : ''}
                </Link>
              ) : null}
              <button
                type="button"
                className="btn btn-sm border border-white/25 text-white hover:bg-white/10"
                onClick={() => {
                  const video = videoRef.current;
                  setEnded(false);
                  setCountdown(null);
                  if (video) {
                    video.currentTime = 0;
                    void video.play();
                    void savePosition(0);
                  }
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Watch again
              </button>
            </div>

            {upNext ? (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={autoplay}
                  onChange={toggleAutoplay}
                  className="size-3.5 rounded border-white/30"
                />
                Autoplay the next lesson
              </label>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* --------------------------------------------------------- control row */}
      <div className="flex flex-wrap items-center gap-2">
        {captionsSrc && !failed ? (
          <button
            type="button"
            onClick={() => setCaptionsOn((value) => !value)}
            className="btn-secondary btn-sm"
            aria-pressed={captionsOn}
          >
            {captionsOn ? <Captions className="size-4" aria-hidden /> : <CaptionsOff className="size-4" aria-hidden />}
            Captions {captionsOn ? 'on' : 'off'}
          </button>
        ) : null}

        {!failed ? (
          <button
            type="button"
            onClick={() => setShowShortcuts((value) => !value)}
            className="btn-ghost btn-sm"
            aria-expanded={showShortcuts}
          >
            <Keyboard className="size-4" aria-hidden />
            Shortcuts
          </button>
        ) : null}

        {resumedFrom !== null && !failed ? (
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (video) {
                video.currentTime = 0;
                setResumedFrom(null);
                setEnded(false);
                void savePosition(0);
              }
            }}
            className="btn-ghost btn-sm"
          >
            <RotateCcw className="size-4" aria-hidden />
            Start over (resumed at {formatClock(resumedFrom)})
          </button>
        ) : null}

        <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-500" aria-live="polite">
          {failed ? null : saveState === 'saving' ? (
            <>
              <span className="size-1.5 animate-pulse rounded-full bg-brand-500" aria-hidden />
              Saving position...
            </>
          ) : saveState === 'saved' ? (
            <>
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              Position saved
            </>
          ) : saveState === 'error' ? (
            <>
              <span className="size-1.5 rounded-full bg-danger" aria-hidden />
              Could not save position
            </>
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-ink-300" aria-hidden />
              Saves every {SAVE_EVERY_SECONDS}s
            </>
          )}
        </span>
      </div>

      {showShortcuts ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl border border-line bg-ink-50 px-4 py-3 text-xs text-ink-600">
          <Shortcut keys="Space / K" label="Play or pause" />
          <Shortcut keys="← / J" label="Back 5s" />
          <Shortcut keys="→ / L" label="Forward 5s" />
          {captionsSrc ? <Shortcut keys="C" label="Captions" /> : null}
          <Shortcut keys="M" label="Mute" />
          <Shortcut keys="F" label="Fullscreen" />
        </div>
      ) : null}

      {resumedFrom !== null && !failed && !ended ? (
        <p className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-950">
          <Volume2 className="size-4 shrink-0" aria-hidden />
          Resumed where you left off at {formatClock(resumedFrom)}.
        </p>
      ) : null}

      {ended && upNext ? (
        <Link
          href={upNext.href}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <SkipForward className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold tracking-wide text-brand-700 uppercase">Up next</span>
            <span className="block truncate text-sm font-medium text-ink-900">{upNext.title}</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-ink-400" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-700">
        {keys}
      </kbd>
      {label}
    </span>
  );
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
