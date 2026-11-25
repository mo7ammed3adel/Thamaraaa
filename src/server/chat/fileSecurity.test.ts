import { describe, expect, it } from "vitest";
import { inspectUploadedFile, sanitizeFileName } from "./fileSecurity";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (s: string) => new TextEncoder().encode(s);

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const PDF = text("%PDF-1.7\n...");
const WINDOWS_EXE = bytes(0x4d, 0x5a, 0x90, 0x00);

describe("inspectUploadedFile", () => {
  it("accepts a real image and marks it safe to show inline", () => {
    const result = inspectUploadedFile({ name: "photo.png", bytes: PNG });
    expect(result).toMatchObject({ ok: true, mimeType: "image/png", category: "image", inline: true });
  });

  it("uses the detected type, not the name, for an unnamed PDF", () => {
    const result = inspectUploadedFile({ name: "scan", bytes: PDF });
    expect(result).toMatchObject({ ok: true, mimeType: "application/pdf", inline: true });
  });

  it("rejects a program renamed to look like a document", () => {
    expect(inspectUploadedFile({ name: "invoice.pdf", bytes: WINDOWS_EXE })).toEqual({ ok: false, reason: "executable" });
    expect(inspectUploadedFile({ name: "photo.jpg", bytes: PDF })).toEqual({ ok: false, reason: "type_mismatch" });
    expect(inspectUploadedFile({ name: "notes.txt", bytes: WINDOWS_EXE })).toEqual({ ok: false, reason: "executable" });
  });

  it("rejects a blocked extension hidden in the middle of the name", () => {
    expect(inspectUploadedFile({ name: "report.exe.pdf", bytes: PDF })).toEqual({ ok: false, reason: "blocked_type" });
  });

  it("rejects scripts by extension", () => {
    expect(inspectUploadedFile({ name: "run.ps1", bytes: text("Write-Host hi") })).toEqual({ ok: false, reason: "blocked_type" });
  });

  it("serves an HTML upload only as a download", () => {
    const result = inspectUploadedFile({ name: "page.html", bytes: text("<html><script>alert(1)</script></html>") });
    expect(result).toMatchObject({ ok: true, mimeType: "text/plain", inline: false });
  });

  it("treats an iPhone HEIC photo as a download, not a video", () => {
    const heic = new Uint8Array([0, 0, 0, 0x18, ...Array.from(text("ftypheic")), 0, 0, 0, 0]);
    expect(inspectUploadedFile({ name: "IMG_0001.HEIC", bytes: heic })).toMatchObject({ ok: true, mimeType: "image/heic", category: "other", inline: false });
  });

  it("rejects macro-enabled binary workbooks", () => {
    expect(inspectUploadedFile({ name: "budget.xlsb", bytes: text("PK\u0003\u0004") })).toEqual({ ok: false, reason: "blocked_type" });
  });

  it("rejects empty files", () => {
    expect(inspectUploadedFile({ name: "a.txt", bytes: new Uint8Array() })).toEqual({ ok: false, reason: "empty" });
  });
});

describe("sanitizeFileName", () => {
  it("strips directories and bidi overrides that disguise extensions", () => {
    expect(sanitizeFileName("..\\..\\evil‮fdp.exe")).toBe("evilfdp.exe");
  });

  it("falls back to a generic name when nothing usable is left", () => {
    expect(sanitizeFileName("\u0000‮")).toBe("file");
  });
});
