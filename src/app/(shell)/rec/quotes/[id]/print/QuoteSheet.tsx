import type { QuotePrintModel } from '@/platform/print/types';

/**
 * G2-PRT-01 (quote, A4): paper layout of a `QuotePrintModel`. It renders the model and nothing else, so the PDF
 * (same model) cannot show different numbers (FR-REC-008, DS-04).
 */
export function QuoteSheet({ model: m }: { model: QuotePrintModel }) {
  return (
    <article className="g2q-sheet g2q-sheet--a4" aria-label={m.title} data-testid="quote-sheet">
      <header className="g2q-d-head">
        <div>
          <div className="g2q-d-brand">{m.branchName}</div>
        </div>
        {m.reprintLabel ? (
          <div className="g2q-d-reprint" data-testid="reprint-label">
            {m.reprintLabel}
          </div>
        ) : null}
      </header>
      <div className="g2q-d-title">
        <h2>{m.title}</h2>
        <p>{m.subtitle}</p>
      </div>
      <div className="g2q-d-grid">
        {m.info.map((r) => (
          <div key={r.label}>
            <b>{r.label}</b>
            <span className={r.strong ? 'plate' : undefined}>{r.value}</span>
          </div>
        ))}
      </div>
      <div className="g2q-dl g2q-dl--h">
        <span>{m.columns.item}</span>
        <span>{m.columns.qty}</span>
        <span>{m.columns.unit}</span>
        <span>{m.columns.amount}</span>
      </div>
      {m.items.map((it) => (
        <div key={it.no} data-testid="sheet-item">
          <div className="g2q-dl g2q-dl--g">
            <span>
              {it.heading} ·{' '}
              {it.decision === 'pending' ? (
                <>
                  <i className="g2q-d-check" />
                  {m.agreeLabel} <i className="g2q-d-check" />
                  {m.disagreeLabel}
                </>
              ) : (
                it.decisionLabel
              )}
            </span>
            <span>{it.grossText}</span>
          </div>
          {it.lines.map((l, i) => (
            <div key={i} className="g2q-dl">
              <span>{l.name}</span>
              <span>{l.qtyText}</span>
              <span>{l.unitText}</span>
              <span>{l.amountText}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="g2q-d-tot">
        {m.totals.map((r) => (
          <div key={r.label} className={r.emphasis ? 'g2q-d-final' : undefined}>
            <span>{r.label}</span>
            <span className="num">{r.text}</span>
          </div>
        ))}
      </div>
      <p className="g2q-d-note">
        {m.note}
        {m.evidence ? ` ${m.evidence}` : ''}
      </p>
      <div className="g2q-d-sign">
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
      <footer className="g2q-d-foot">
        <span>{m.footer.printedAt}</span>
        <span>{m.footer.printedBy}</span>
      </footer>
    </article>
  );
}
