'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { filterCards, groupCards, type IndexCard } from './configIndex';

export interface IndexLabels {
  search: string;
  placeholder: string;
  noMatch: string;
  upcoming: string;
  /** contains {n} */
  pending: string;
  groups: Record<string, string>;
  /** group ids in display order */
  order: readonly string[];
}

/** FR-SYS-004: configuration types by business group; client-side search over the cards already loaded. */
export function ConfigIndexList({ cards, labels }: { cards: IndexCard[]; labels: IndexLabels }) {
  const [q, setQ] = useState('');
  const id = useId();
  const groups = groupCards(filterCards(cards, q), labels.order);
  return (
    <div className="stack-6" data-testid="config-types">
      <div className="field">
        <label className="field__label" htmlFor={id}>
          {labels.search}
        </label>
        <input
          id={id}
          className="input"
          type="search"
          autoComplete="off"
          placeholder={labels.placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {groups.length === 0 ? (
        <p role="status" className="text-secondary">
          {labels.noMatch}
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.group} aria-labelledby={`${id}-${g.group}`} className="stack">
            <h2 id={`${id}-${g.group}`}>{labels.groups[g.group]}</h2>
            <ul
              className="stack-2"
              style={{ listStyle: 'none', padding: 0, margin: 0 }}
              data-testid={`config-group-${g.group}`}
            >
              {g.cards.map((c) => (
                <li key={c.type} className="card" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <Link href={c.href}>
                      <strong>{c.title}</strong>
                    </Link>
                    {c.pending > 0 && (
                      <StatusBadge tone="warning">
                        {labels.pending.replace('{n}', String(c.pending))}
                      </StatusBadge>
                    )}
                    {c.upcoming && <StatusBadge tone="info">{labels.upcoming}</StatusBadge>}
                  </div>
                  <div className="text-secondary">{c.lead}</div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
