'use client';

/**
 * Auto-submitting select. Needs to be a client component, and it is deliberately
 * tiny so pages can stay server-rendered. The surrounding form should be a GET
 * form whose action is the current path.
 */
export function SortSelect({
  name,
  defaultValue,
  options,
  label,
  id = 'sort',
  className = 'input w-auto',
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  label: string;
  id?: string;
  className?: string;
}) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className={className}
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
          Apply
        </button>
      </noscript>
    </>
  );
}
