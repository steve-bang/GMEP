import type { FormHTMLAttributes, ReactNode } from 'react';

/** `.filter-bar`: a plain GET form so filtering works server-side without client JS. */
export function FilterBar({
  children,
  actions,
  ...rest
}: FormHTMLAttributes<HTMLFormElement> & { actions: ReactNode }) {
  return (
    <form method="get" role="search" {...rest} className="filter-bar">
      {children}
      <div className="filter-bar__actions">{actions}</div>
    </form>
  );
}

export function SearchField({
  id,
  label,
  name,
  placeholder,
  defaultValue,
}: {
  id: string;
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div className="field filter-bar__search">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="input"
        type="search"
        placeholder={placeholder}
        defaultValue={defaultValue}
        autoComplete="off"
      />
    </div>
  );
}
