import { json } from '@/platform/http/route';
import { cron } from '@/composition/api';
import { runScheduledJobs } from '@/composition/cron';

export const runtime = 'nodejs';

/** Cloud Scheduler target: POST with header `x-cron-secret` (README "Scheduler"). Runs the RPT and EIN due jobs per branch. */
export const POST = cron(async (c) => json(await runScheduledJobs(c)));
