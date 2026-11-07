import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listAppointmentReasons } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-045, 046: the active reasons for cancelling (`kind=cancel`) or rescheduling (`kind=reschedule`) an appointment; `branchId` = the branch of the appointment (its note length applies). */
export const GET = authed(async ({ rec, session, query }) => {
  const q = query();
  const kind = q.kind === 'reschedule' ? 'reschedule' : 'cancel';
  const branchId = typeof q.branchId === 'string' && q.branchId ? q.branchId : undefined;
  return json(await listAppointmentReasons(rec, session.actor, kind, branchId ? { branchId } : {}));
});
