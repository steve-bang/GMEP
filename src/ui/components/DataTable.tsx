import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** right-aligned tabular numbers (money, quantities) */
  numeric?: boolean;
  /** sortable header: current direction (null = not sorted by this column) and the link that toggles it */
  sort?: { dir: 'asc' | 'desc' | null; href: string; label?: string };
}

export interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  busy?: boolean;
  /** optional full-width line under a row (e.g. an expandable detail); return null for none */
  detail?: (row: T) => ReactNode;
  /** content of `.table-toolbar` above the table (counts, sort note) */
  toolbar?: ReactNode;
  /** content of `.table-footer` below the table */
  footer?: ReactNode;
}

/** `.table-wrap > .table-scroll > .table`; horizontal scroll instead of overflow on narrow screens. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  busy,
  toolbar,
  footer,
  detail,
}: DataTableProps<T>) {
  return (
    <div className="table-wrap" aria-busy={busy || undefined}>
      {toolbar ? <div className="table-toolbar">{toolbar}</div> : null}
      {/* keyboard-focusable scroll region (WCAG 2.1.1): the table scrolls sideways on narrow screens */}
      <div className="table-scroll" tabIndex={0} role="region" aria-label={caption}>
        <table className="table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={c.numeric ? 'col-num' : undefined}
                  aria-sort={
                    c.sort?.dir === 'asc'
                      ? 'ascending'
                      : c.sort?.dir === 'desc'
                        ? 'descending'
                        : undefined
                  }
                >
                  {c.sort ? (
                    <Link className="th-sort" href={c.sort.href}>
                      {c.header}
                      <Icon name={c.sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} />
                    </Link>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const extra = detail?.(row);
              return (
                <Fragment key={rowKey(row)}>
                  <tr>
                    {columns.map((c) => (
                      <td key={c.key} className={c.numeric ? 'col-num' : undefined}>
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                  {extra ? (
                    <tr>
                      <td colSpan={columns.length} style={{ paddingTop: 0 }}>
                        {extra}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer ? <div className="table-footer">{footer}</div> : null}
    </div>
  );
}
