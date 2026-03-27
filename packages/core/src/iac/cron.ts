import { z } from "zod";
import type { MutationRegistration } from "./functions";

export interface CronJob {
  name:     string;
  schedule: string;   // cron expression: "0 * * * *", "*/5 * * * *", etc.
  fn:       MutationRegistration<any, any>;
  args:     Record<string, unknown>;
}

const _jobs: CronJob[] = [];

/** Register a cron job. Called in bbf/cron.ts. */
export function cron(
  name:     string,
  schedule: string,
  fn:       MutationRegistration<any, any>,
  args:     Record<string, unknown> = {}
): void {
  _jobs.push({ name, schedule, fn, args });
}

export function getCronJobs(): CronJob[] {
  return _jobs;
}
