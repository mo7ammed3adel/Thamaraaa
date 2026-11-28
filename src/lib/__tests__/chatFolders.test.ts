import { describe, expect, it } from "vitest";
import { applyMove, groupIntoFolders, placeBefore } from "@/lib/chat/folders";

const conv = (id: string) => ({ id });
const folder = (id: string, conversationIds: string[]) => ({ id, conversationIds });

describe("groupIntoFolders", () => {
  it("puts listed conversations in their folder, in the folder's order, and leaves the rest loose", () => {
    const { grouped, loose } = groupIntoFolders([conv("a"), conv("b"), conv("c")], [folder("f", ["c", "a"])]);
    expect(grouped[0].items.map((c) => c.id)).toEqual(["c", "a"]);
    expect(loose.map((c) => c.id)).toEqual(["b"]);
  });

  it("skips ids the list doesn't show (filtered out or left)", () => {
    const { grouped } = groupIntoFolders([conv("a")], [folder("f", ["gone", "a"])]);
    expect(grouped[0].items.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("applyMove", () => {
  it("moves a conversation from one folder into another, before the row it was dropped on", () => {
    const next = applyMove([folder("x", ["a", "b"]), folder("y", ["c"])], "a", { folderId: "y", beforeId: "c" });
    expect(next).toEqual([folder("x", ["b"]), folder("y", ["a", "c"])]);
  });

  it("appends when no row is given and takes it out entirely for a null folder", () => {
    expect(applyMove([folder("y", ["c"])], "a", { folderId: "y" })[0].conversationIds).toEqual(["c", "a"]);
    expect(applyMove([folder("y", ["c", "a"])], "a", { folderId: null })[0].conversationIds).toEqual(["c"]);
  });
});

describe("placeBefore", () => {
  it("lands just above the drop line whether the item moves up or down", () => {
    expect(placeBefore(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(placeBefore(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
  });

  it("goes to the end when the target is missing (hidden or gone)", () => {
    expect(placeBefore(["a", "b"], "a", "zzz")).toEqual(["b", "a"]);
    expect(placeBefore(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("keeps a hidden id's position when placing before a visible one", () => {
    // Folder saved as [hidden, a, b]; dropping c on b puts it right above b.
    expect(placeBefore(["hidden", "a", "b"], "c", "b")).toEqual(["hidden", "a", "c", "b"]);
  });
});
