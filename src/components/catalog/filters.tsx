'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, X } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface ActiveFilters {
  q: string;
  category: string;
  level: string;
  price: string;
  duration: string;
  sort: string;
}

/**
 * Catalogue filters. A plain GET form (works without JS) that auto-submits on
 * change for a snappier feel; the server reads everything from searchParams.
 */
export function CatalogFilters({
  categories,
  levels,
  prices,
  durations,
  sortOptions,
  active,
  total,
}: {
  categories: FilterOption[];
  levels: FilterOption[];
  prices: FilterOption[];
  durations: FilterOption[];
  sortOptions: FilterOption[];
  active: ActiveFilters;
  total: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const submit = () => formRef.current?.requestSubmit();
  const hasFilters = Boolean(
    active.q || active.category || active.level || active.price || active.duration,
  );

  return (
    <form
      ref={formRef}
      method="get"
      action="/courses"
      className="space-y-5"
      role="search"
      aria-label="Filter courses"
    >
      <div>
        <label className="label" htmlFor="q">
          Search
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={active.q}
            placeholder="Title, description or tag"
            className="input"
          />
          <button type="submit" className="btn-primary px-3" aria-label="Search">
            <SlidersHorizontal className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <Select id="category" name="category" label="Category" value={active.category} options={categories} onChange={submit} />
      <Select id="level" name="level" label="Level" value={active.level} options={levels} onChange={submit} />
      <Select id="price" name="price" label="Price" value={active.price} options={prices} onChange={submit} />
      <Select id="duration" name="duration" label="Duration" value={active.duration} options={durations} onChange={submit} />

      {/* keep sorting when filters change */}
      <input type="hidden" name="sort" value={active.sort} />

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <p className="mr-auto text-sm text-ink-500">
          {total} course{total === 1 ? '' : 's'}
        </p>
        {hasFilters ? (
          <Link href="/courses" className="btn-ghost btn-sm">
            <X className="size-3.5" aria-hidden />
            Clear
          </Link>
        ) : null}
        <noscript>
          <button type="submit" className="btn-secondary btn-sm">
            Apply
          </button>
        </noscript>
      </div>

      <div className="hidden">
        {sortOptions.map((option) => (
          <span key={option.value} />
        ))}
      </div>
    </form>
  );
}

function Select({
  id,
  name,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: () => void;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select id={id} name={name} defaultValue={value} onChange={onChange} className="input">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.count !== undefined ? ` (${option.count})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Sort control, rendered above the results. */
export function CatalogSort({
  options,
  active,
}: {
  options: FilterOption[];
  active: ActiveFilters;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(active)) {
    if (key !== 'sort' && value) query.set(key, value);
  }

  return (
    <form method="get" action="/courses" className="flex items-center gap-2">
      {[...query.entries()].map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <label className="text-sm whitespace-nowrap text-ink-500" htmlFor="sort">
        Sort by
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={active.sort}
        className="input w-auto py-1.5 text-sm"
        // form submits on change via the tiny inline handler below
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="btn-secondary btn-sm">
          Go
        </button>
      </noscript>
    </form>
  );
}
