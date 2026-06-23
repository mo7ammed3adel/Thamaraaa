import { describe, it, expect } from "vitest";
import {
  computeDepartmentProgress,
  resolveTaskBucket,
  type ProgressTaskInput,
} from "../progress";

function task(partial: Partial<ProgressTaskInput> & { id: string }): ProgressTaskInput {
  return { taskType: "SEO", parentTaskId: null, progressPct: 0, ...partial };
}

describe("resolveTaskBucket", () => {
  it("buckets base package task types directly", () => {
    const byId = new Map<string, ProgressTaskInput>();
    expect(resolveTaskBucket(task({ id: "a", taskType: "SEO" }), byId)).toBe("seo");
    expect(resolveTaskBucket(task({ id: "b", taskType: "Social_Media" }), byId)).toBe("social");
    expect(resolveTaskBucket(task({ id: "c", taskType: "Media_Buyer" }), byId)).toBe("media");
  });

  it("buckets content_seo into the SEO department", () => {
    const byId = new Map<string, ProgressTaskInput>();
    expect(resolveTaskBucket(task({ id: "a", taskType: "content_seo" }), byId)).toBe("seo");
  });

  it("inherits the parent's bucket for a creative sub-task", () => {
    const parent = task({ id: "p", taskType: "Media_Buyer" });
    const child = task({ id: "c", taskType: "graphic_design", parentTaskId: "p" });
    const byId = new Map([[parent.id, parent]]);
    expect(resolveTaskBucket(child, byId)).toBe("media");
  });

  it("walks up multiple levels to find a base bucket", () => {
    const root = task({ id: "root", taskType: "Social_Media" });
    const mid = task({ id: "mid", taskType: "ui_design", parentTaskId: "root" });
    const leaf = task({ id: "leaf", taskType: "graphic_design", parentTaskId: "mid" });
    const byId = new Map([
      [root.id, root],
      [mid.id, mid],
    ]);
    expect(resolveTaskBucket(leaf, byId)).toBe("social");
  });

  it("defaults a parent-less creative task to the Social bucket", () => {
    const byId = new Map<string, ProgressTaskInput>();
    expect(resolveTaskBucket(task({ id: "x", taskType: "motion_graphic" }), byId)).toBe("social");
  });
});

describe("computeDepartmentProgress", () => {
  it("averages per department and overall across active departments only", () => {
    const tasks = [
      task({ id: "s1", taskType: "SEO", progressPct: 40 }),
      task({ id: "s2", taskType: "SEO", progressPct: 60 }),
      task({ id: "sm1", taskType: "Social_Media", progressPct: 100 }),
    ];
    const result = computeDepartmentProgress(tasks);
    expect(result.seo).toBe(50);
    expect(result.social).toBe(100);
    expect(result.media).toBe(0); // no media tasks
    // overall = average of active buckets (seo 50, social 100) = 75
    expect(result.overall).toBe(75);
  });

  it("includes content_seo and creative sub-tasks in their department averages", () => {
    const tasks = [
      task({ id: "seo1", taskType: "SEO", progressPct: 100 }),
      task({ id: "cseo", taskType: "content_seo", progressPct: 0 }), // → SEO bucket
      task({ id: "sm", taskType: "Social_Media", progressPct: 50 }),
      task({ id: "gfx", taskType: "graphic_design", parentTaskId: "sm", progressPct: 50 }), // → social
    ];
    const result = computeDepartmentProgress(tasks);
    expect(result.seo).toBe(50); // (100 + 0) / 2
    expect(result.social).toBe(50); // (50 + 50) / 2
  });

  it("returns zeros for an empty task list", () => {
    const result = computeDepartmentProgress([]);
    expect(result).toEqual({ seo: 0, social: 0, media: 0, overall: 0 });
  });
});
