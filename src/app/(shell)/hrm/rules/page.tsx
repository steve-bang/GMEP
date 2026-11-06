import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { isoToVi } from '@/platform/format/date';
import { getLaborRules } from '@/modules/hrm';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { money } from '../../rec/format';
import { HrmPage, hrmLabels } from '../hrmUi';

export const dynamic = 'force-dynamic';

function describeMethod(l: Record<string, string>, p: Record<string, unknown>): string {
  const n = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : 0);
  const pct = (bp: number) => `${(bp / 100).toLocaleString('vi-VN')}%`;
  switch (p.method) {
    case 'standard_hours':
      return l.desc_standard_hours!.replace('{rate}', money(n('hourlyRateVnd')));
    case 'approved_actual':
      return (p.capBp !== undefined ? l.desc_approved_actual_cap! : l.desc_approved_actual!)
        .replace('{rate}', money(n('hourlyRateVnd')))
        .replace('{cap}', pct(n('capBp')));
    case 'flat':
      return l.desc_flat!.replace('{amount}', money(n('amountVnd')));
    case 'percent':
      return l.desc_percent!.replace('{rate}', pct(n('rateBp')));
    case 'fixed_bonus':
      return l
        .desc_fixed_bonus!.replace('{fixed}', money(n('fixedVnd')))
        .replace('{bonus}', money(n('bonusVnd')))
        .replace('{within}', pct(n('bonusMaxActualBp')));
    default:
      return '';
  }
}

/** Reads `svc:<type>[:pos:<code>]` with an optional `branch:<id>:` prefix into words. */
function scopeText(l: Record<string, string>, key: string): string {
  const b = /^branch:([^:]+):(.*)$/.exec(key);
  const rest = b ? b[2]! : key;
  const m = /^svc:([^:]+)(?::pos:(.+))?$/.exec(rest);
  const base = m ? `${m[1]}${m[2] ? ` · ${m[2]}` : ''}` : rest;
  return b ? `${l.branchOverride}: ${b[1]} · ${base}` : base;
}

/**
 * G3-HRM-06 / FR-HRM-006, 015, 020: the labor rules in force today, read only. A rule is changed by proposing a new
 * version with an effective date in the configuration screens (approval by the owner); nothing here edits one.
 * The accountant has not signed any example yet, so the screen says "minh họa" (Q73).
 */
export default async function LaborRulesPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const l = hrmLabels('rules');
  const res = await load(() => getLaborRules(getContainer().hrm, actor, {}));
  const head = { title: l.title!, desc: l.lead! };
  if (res.error)
    return (
      <HrmPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </HrmPage>
    );
  const r = res.data;
  return (
    <HrmPage
      {...head}
      actions={
        <Link className="btn btn--secondary" href="/sys/config/labor-method">
          {l.edit}
        </Link>
      }
    >
      <div className="alert alert--warning" role="note">
        <div className="alert__body">
          <strong>{l.sampleTitle}</strong> {l.sampleText}
        </div>
      </div>
      {r.methods.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText} />
      ) : (
        <DataTable
          caption={l.methods!}
          rows={r.methods}
          rowKey={(m) => m.scopeKey}
          toolbar={<strong>{l.methods}</strong>}
          footer={<span className="table-meta">{l.priority}</span>}
          columns={[
            { key: 's', header: l.colScope!, render: (m) => scopeText(l, m.scopeKey) },
            {
              key: 'm',
              header: l.colMethod!,
              render: (m) => l[`method_${String(m.payload.method)}`] ?? String(m.payload.method),
            },
            { key: 'p', header: l.colParams!, render: (m) => describeMethod(l, m.payload) },
          ]}
        />
      )}
      <DataTable
        caption={l.positions!}
        rows={r.positions}
        rowKey={(p) => p.code}
        toolbar={<strong>{l.positions}</strong>}
        footer={
          <span className="table-meta">
            {l
              .policySummary!.replace('{rounding}', l[`rounding_${r.policy.roundingMode}`] ?? '')
              .replace('{step}', money(r.policy.moneyStepVnd))
              .replace('{minutes}', String(r.policy.adjustThresholdMinutes))
              .replace('{vnd}', money(r.policy.adjustThresholdVnd))
              .replace('{rework}', l[`rework_${r.policy.reworkMode}`] ?? '')}
            {r.policyVersionId ? '' : ` ${l.policyDefault}`} · {isoToVi(r.date)}
          </span>
        }
        columns={[
          { key: 'c', header: l.colPosition!, render: (p) => `${p.name} (${p.code})` },
          {
            key: 'f',
            header: l.colCoefficient!,
            numeric: true,
            render: (p) => (p.coefficientBp / 10_000).toLocaleString('vi-VN'),
          },
          { key: 's', header: l.colStatus!, render: (p) => l[`status_${p.status}`] ?? p.status },
        ]}
      />
    </HrmPage>
  );
}
