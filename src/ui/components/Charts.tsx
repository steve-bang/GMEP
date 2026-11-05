import type { ReactNode } from 'react';
import { compactVnd, niceScale, pctOfAxis } from '../charts/scale';

/**
 * Dashboard charts (G1-DSH, design `g1-charts.js`) as server-rendered HTML/CSS: no chart library, no client JS,
 * responsive by layout. Every chart has a title, a unit, a text legend and an alternative data table
 * (WCAG 1.1.1, 1.4.1: colour is never the only carrier). Colours come from the `--chart-series-N` tokens.
 */

export interface ChartPoint {
  label: string;
  /** integer value; null = no data for that slot (shown as a gap, never as 0) */
  value: number | null;
  /** provisional (day not closed): hatched outline */
  provisional?: boolean;
  /** full name of the point for the tooltip and the data table when `label` is short (e.g. a week "30/10–05/11") */
  fullLabel?: string;
  /** extra words for the tooltip and the table (e.g. "2 ngày chưa có số liệu") */
  note?: string;
}

function ChartFrame(props: {
  id: string;
  title: string;
  unit: string;
  sub?: string;
  tableLabel: string;
  table: ReactNode;
  legend?: { name: string; series: number; prov?: boolean }[];
  foot?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <figure className="card dsh-chart" aria-labelledby={`${props.id}-t`} data-testid={props.testId}>
      <figcaption className="dsh-chart__head">
        <h2 className="dsh-chart__title" id={`${props.id}-t`}>
          {props.title}
        </h2>
        <p className="dsh-chart__unit">
          {props.unit}
          {props.sub ? ` · ${props.sub}` : ''}
        </p>
      </figcaption>
      {props.children}
      {props.legend && props.legend.length > 0 ? (
        <ul className="dsh-chart__legend">
          {props.legend.map((l) => (
            <li key={l.name}>
              <span
                className={`dsh-sw ${l.prov ? 'dsh-sw--prov' : `dsh-s${l.series}`}`}
                aria-hidden="true"
              />
              {l.name}
            </li>
          ))}
        </ul>
      ) : null}
      <details className="dsh-chart__details">
        <summary>{props.tableLabel}</summary>
        {props.table}
      </details>
      {props.foot ? <p className="dsh-chart__foot">{props.foot}</p> : null}
    </figure>
  );
}

const DataTable_ = (props: {
  caption: string;
  head: [string, string];
  rows: { label: string; text: string }[];
}) => (
  <div className="table-scroll">
    <table className="table table--compact">
      <caption className="sr-only">{props.caption}</caption>
      <thead>
        <tr>
          <th scope="col">{props.head[0]}</th>
          <th scope="col" className="col-num">
            {props.head[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            <td className="col-num">{r.text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** Vertical columns over time (revenue of the last days). `format` turns a value into its label. */
export function ColumnChart(props: {
  id: string;
  title: string;
  unit: string;
  sub?: string;
  points: ChartPoint[];
  format: (v: number) => string;
  axisFormat?: (v: number) => string;
  provisionalNote?: string;
  noDataLabel: string;
  tableLabel: string;
  catName: string;
  valueName: string;
  /** axis top when every value is 0 (a unit that makes sense, e.g. 4 million VND) */
  emptyTop?: number;
  foot?: string;
  testId?: string;
}) {
  const max = Math.max(0, ...props.points.map((p) => p.value ?? 0));
  const top = max > 0 || !props.emptyTop ? niceScale(max).top : props.emptyTop;
  const axis = props.axisFormat ?? props.format;
  const hasProv = props.points.some((p) => p.provisional);
  // many points: thin bars without value labels, and only every `step`-th axis label (the tooltip and the table keep all)
  const n = props.points.length;
  const dense = n > 14;
  const step = n <= 7 ? 1 : n <= 14 ? 2 : Math.ceil(n / 6);
  const ticks = [0, 1, 2, 3, 4].map((i) => i * (top / 4));
  return (
    <ChartFrame
      id={props.id}
      title={props.title}
      unit={props.unit}
      {...(props.sub ? { sub: props.sub } : {})}
      tableLabel={props.tableLabel}
      legend={[
        { name: props.valueName, series: 1 },
        ...(hasProv && props.provisionalNote
          ? [{ name: props.provisionalNote, series: 1, prov: true }]
          : []),
      ]}
      {...(props.foot ? { foot: props.foot } : {})}
      {...(props.testId ? { testId: props.testId } : {})}
      table={
        <DataTable_
          caption={props.title}
          head={[props.catName, props.valueName]}
          rows={props.points.map((p) => ({
            label: p.fullLabel ?? p.label,
            text:
              (p.value === null
                ? props.noDataLabel
                : `${props.format(p.value)}${p.provisional && props.provisionalNote ? ` (${props.provisionalNote})` : ''}`) +
              (p.note ? ` · ${p.note}` : ''),
          }))}
        />
      }
    >
      <div
        className={`dsh-cols-chart${dense ? ' dsh-cols-chart--dense' : ''}${n <= 7 ? ' dsh-cols-chart--short' : ''}`}
      >
        <div className="dsh-cols-chart__axis" aria-hidden="true">
          {[...ticks].reverse().map((t) => (
            <span key={t}>{axis(t)}</span>
          ))}
        </div>
        <div className="dsh-cols-chart__plot">
          <div className="dsh-cols-chart__grid" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} />
            ))}
          </div>
          <ul className="dsh-cols-chart__bars">
            {props.points.map((p, i) => (
              <li
                key={p.fullLabel ?? p.label}
                title={`${p.fullLabel ?? p.label}: ${p.value === null ? props.noDataLabel : props.format(p.value)}${p.note ? ` · ${p.note}` : ''}`}
              >
                <span className="dsh-cols-chart__col">
                  {p.value === null ? (
                    <span className="dsh-cols-chart__none">{props.noDataLabel}</span>
                  ) : (
                    <>
                      <span className="dsh-cols-chart__val">{props.format(p.value)}</span>
                      <span
                        className={`dsh-cols-chart__bar${p.provisional ? ' is-prov' : ''}${p.value === 0 ? ' is-zero' : ''}`}
                        style={{ height: `${pctOfAxis(p.value, top)}%` }}
                      />
                    </>
                  )}
                </span>
                <span className={`dsh-cols-chart__lbl${i % step === 0 ? '' : ' is-skip'}`}>
                  {p.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ChartFrame>
  );
}

/** Horizontal bars to compare a few items (design: horizontal bars, no pie charts). */
export function BarList(props: {
  id: string;
  title: string;
  unit: string;
  sub?: string;
  items: { label: string; value: number; href?: string }[];
  format: (v: number) => string;
  tableLabel: string;
  catName: string;
  valueName: string;
  series?: number;
  foot?: string;
  testId?: string;
}) {
  const max = Math.max(0, ...props.items.map((i) => i.value));
  const series = props.series ?? 1;
  return (
    <ChartFrame
      id={props.id}
      title={props.title}
      unit={props.unit}
      {...(props.sub ? { sub: props.sub } : {})}
      tableLabel={props.tableLabel}
      {...(props.foot ? { foot: props.foot } : {})}
      {...(props.testId ? { testId: props.testId } : {})}
      table={
        <DataTable_
          caption={props.title}
          head={[props.catName, props.valueName]}
          rows={props.items.map((i) => ({ label: i.label, text: props.format(i.value) }))}
        />
      }
    >
      <ul className="dsh-bars">
        {props.items.map((i) => (
          <li key={i.label} className="dsh-bars__row">
            <span className="dsh-bars__label">{i.label}</span>
            <span className="dsh-bars__track" aria-hidden="true">
              <span
                className={`dsh-bars__bar dsh-s${series}`}
                style={{ width: `${pctOfAxis(i.value, max)}%`, minWidth: i.value > 0 ? 2 : 0 }}
              />
            </span>
            <span className="dsh-bars__value">{props.format(i.value)}</span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}

export { compactVnd };
