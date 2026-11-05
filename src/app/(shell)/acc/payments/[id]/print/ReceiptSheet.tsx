import { Fragment } from 'react';
import type { ReceiptPrintModel } from '@/platform/print/types';

/**
 * G4-ACC-03 receipt (A5): paper layout of a `ReceiptPrintModel`. It renders the model and nothing else; the PDF reads
 * the same model (FR-REC-008, DS-04).
 */
export function ReceiptSheet({ model: m }: { model: ReceiptPrintModel }) {
  return (
    <article className="acc-sheet" aria-label={m.title} data-testid="receipt-sheet">
      <header className="acc-sheet__head">
        <div>{m.branchName}</div>
        {m.reprintLabel ? (
          <div className="acc-sheet__reprint" data-testid="reprint-label">
            {m.reprintLabel}
          </div>
        ) : null}
      </header>
      <div className="acc-sheet__title">
        <h2>{m.title}</h2>
        <p>{m.subtitle}</p>
      </div>
      <dl className="acc-sheet__info">
        {m.info.map((r) => (
          <Fragment key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.strong ? <b>{r.value}</b> : r.value}</dd>
          </Fragment>
        ))}
      </dl>
      <b>{m.linesHeading}</b>
      <ul className="acc-sheet__lines">
        {m.lines.map((l, i) => (
          <li key={i}>
            <span>
              {l.method}
              {l.reference ? ` · ${l.reference}` : ''}
            </span>
            <span>{l.amountText}</span>
          </li>
        ))}
      </ul>
      <div className="acc-sheet__tot">
        {m.totals.map((r) => (
          <div key={r.label} className={r.emphasis ? 'acc-sheet__final' : undefined}>
            <span>{r.label}</span>
            <span className="num">{r.text}</span>
          </div>
        ))}
      </div>
      <p className="acc-sheet__note">{m.note}</p>
      <div className="acc-sheet__sign">
        {m.signatures.map((g) => (
          <div key={g.label}>
            {g.label}
            {g.hint ? (
              <>
                <br />
                <small>{g.hint}</small>
              </>
            ) : null}
            <i>&nbsp;</i>
          </div>
        ))}
      </div>
      <footer className="acc-sheet__foot">
        <span>{m.footer.printedAt}</span>
        <span>{m.footer.printedBy}</span>
      </footer>
    </article>
  );
}
