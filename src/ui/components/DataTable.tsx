import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** right-aligned tabular numbers (money, quantities) */
  numeric?: boolean;
}

export interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  busy?: boolean;
}

/** `.table-wrap > .table-scroll > .table`; horizontal scroll instead of overflow on narrow screens. */
export function DataTable<T>({ caption, columns, rows, rowKey, busy }: DataTableProps<T>) {
  return (
    <div className="table-wrap" aria-busy={busy || undefined}>
      {/* keyboard-focusable scroll region (WCAG 2.1.1): the table scrolls sideways on narrow screens */}
      <div className="table-scroll" tabIndex={0} role="region" aria-label={caption}>
        <table className="table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={c.numeric ? 'col-num' : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.numeric ? 'col-num' : undefined}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
