import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listAppointmentReasons } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-045, 046: the active reasons for cancelling (`kind=cancel`) or rescheduling (`kind=reschedule`) an appointment. */
export const GET = authed(async ({ rec, session, query }) => {
  const kind = query().kind === 'reschedule' ? 'reschedule' : 'cancel';
  return json(await listAppointmentReasons(rec, session.actor, kind));
});
