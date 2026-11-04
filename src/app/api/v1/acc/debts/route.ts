import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listDebts } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-006: approved debts of the working branch with their age. */
export const GET = authed(async ({ acc, session }) => json(await listDebts(acc, session.actor)));
