'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

/**
 * Theme choice: light / dark / system, remembered in localStorage and applied
 * before first paint by the inline script in the root layout.
 *
 * The stored choice is external state, so it is read through
 * useSyncExternalStore rather than copied into component state in an effect.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'demolms-theme';
const EVENT = 'demolms-theme-change';

function readChoice(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
    media.removeEventListener('change', onChange);
  };
}

/** Applies a choice to <html> and remembers it. */
export function applyThemeChoice(choice: ThemeChoice): void {
  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  if (dark) root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  root.dataset.themeChoice = choice;
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    /* private mode: the choice simply will not be remembered */
  }
  window.dispatchEvent(new Event(EVENT));
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Compact three-state control. Neutral until mounted, so SSR matches. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const choice = useSyncExternalStore<ThemeChoice>(
    subscribe,
    readChoice,
    () => 'system' as ThemeChoice,
  );

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5 ${className}`}
      role="group"
      aria-label="Colour theme"
    >
      {OPTIONS.map((option) => {
        const active = choice === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => applyThemeChoice(option.value)}
            aria-pressed={active}
            title={`${option.label} theme`}
            className={`rounded-full p-1.5 transition-colors duration-[130ms] ${
              active ? 'bg-ink-100 text-ink-900' : 'text-ink-400 hover:text-ink-700'
            }`}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Wider control for menus and settings pages, with labels. */
export function ThemeSegmented({ className = '' }: { className?: string }) {
  const choice = useSyncExternalStore<ThemeChoice>(
    subscribe,
    readChoice,
    () => 'system' as ThemeChoice,
  );

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={`flex items-center gap-1 rounded-control border border-line p-0.5 ${className}`}
    >
      {OPTIONS.map((option) => {
        const active = choice === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => applyThemeChoice(option.value)}
            aria-pressed={active}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[0.375rem] px-2 py-1.5 text-xs font-medium transition-colors duration-[130ms] ${
              active ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            <Icon className="size-3.5" aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
