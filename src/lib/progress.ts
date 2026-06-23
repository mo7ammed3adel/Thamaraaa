/**
 * Department progress roll-up.
 *
 * The Project model exposes three department progress fields — seoProgress,
 * socialMediaProgress, mediaBuyerProgress (see spec §10/§11). A task's progress
 * must roll up into the correct department even when the task is a cross-team
 * creative sub-task (graphic / motion / UI) or a content-SEO task:
 *
 *   - content_seo            → SEO bucket (Content SEO is part of the SEO package)
 *   - graphic/motion/ui      → the bucket of the parent task that requested it
 *                              (a design request raised from a Social task counts
 *                               toward Social progress); falls back to Social when
 *                               no base-bucket ancestor can be resolved.
 *
 * This file is intentionally pure (no Prisma / IO) so it can be unit-tested and
 * reused by any caller.
 */

export interface ProgressTaskInput {
  id: string;
  taskType: string;
  parentTaskId: string | null;
  progressPct: number;
}

export type DepartmentBucket = "seo" | "social" | "media";

const SEO_TYPES = new Set(["SEO", "seo"]);
const CONTENT_SEO_TYPES = new Set(["content_seo"]);
const SOCIAL_TYPES = new Set(["Social_Media", "social_media"]);
const MEDIA_TYPES = new Set(["Media_Buyer", "media_buyer", "media_buying"]);
const CREATIVE_TYPES = new Set(["graphic_design", "motion_graphic", "ui_design"]);

/** Direct bucket for a "base" (package-level) task type, or null for creative sub-tasks. */
function baseBucket(taskType: string): DepartmentBucket | null {
  if (SEO_TYPES.has(taskType) || CONTENT_SEO_TYPES.has(taskType)) return "seo";
  if (SOCIAL_TYPES.has(taskType)) return "social";
  if (MEDIA_TYPES.has(taskType)) return "media";
  return null;
}

/**
 * Resolves which department bucket a task contributes to.
 * Creative sub-tasks (graphic/motion/ui) inherit the bucket of the nearest
 * ancestor that maps to a base bucket; if none is found they default to Social.
 * Tasks that map to no bucket (and are not creative) return null and are ignored.
 */
export function resolveTaskBucket(
  task: ProgressTaskInput,
  byId: Map<string, ProgressTaskInput>
): DepartmentBucket | null {
  const direct = baseBucket(task.taskType);
  if (direct) return direct;

  if (CREATIVE_TYPES.has(task.taskType)) {
    let current: ProgressTaskInput | undefined = task;
    const seen = new Set<string>();
    while (current?.parentTaskId && !seen.has(current.parentTaskId)) {
      seen.add(current.parentTaskId);
      const parent = byId.get(current.parentTaskId);
      if (!parent) break;
      const parentBucket = baseBucket(parent.taskType);
      if (parentBucket) return parentBucket;
      current = parent;
    }
    return "social"; // creative work with no resolvable parent defaults to Social
  }

  return null;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Computes per-department progress plus an overall figure (average across the
 * departments that actually have tasks).
 */
export function computeDepartmentProgress(tasks: ProgressTaskInput[]): {
  seo: number;
  social: number;
  media: number;
  overall: number;
} {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const buckets: Record<DepartmentBucket, number[]> = { seo: [], social: [], media: [] };

  for (const task of tasks) {
    const bucket = resolveTaskBucket(task, byId);
    if (bucket) buckets[bucket].push(task.progressPct);
  }

  const seo = average(buckets.seo);
  const social = average(buckets.social);
  const media = average(buckets.media);

  const activeAverages: number[] = [];
  if (buckets.seo.length) activeAverages.push(seo);
  if (buckets.social.length) activeAverages.push(social);
  if (buckets.media.length) activeAverages.push(media);

  const overall = average(activeAverages);

  return { seo, social, media, overall };
}
