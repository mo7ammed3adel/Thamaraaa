"use client";

import { Fragment, type ReactNode } from "react";
import { normalizeWebUrl } from "@/lib/safe-url";

/**
 * Slack-style message formatting, rendered as React elements (never HTML, so
 * nothing a user types can inject markup):
 *   *bold*  _italic_  ~strike~  `code`  ```code block```  and http(s) links.
 */

const URL_PATTERN = /(https?:\/\/[^\s<>"]+)/g;

function linkify(text: string, keyBase: string): ReactNode[] {
  return text.split(URL_PATTERN).map((part, i) => {
    if (i % 2 === 1) {
      const trimmed = part.replace(/[.,!?؟،)\]]+$/, "");
      const rest = part.slice(trimmed.length);
      const safe = normalizeWebUrl(trimmed);
      if (safe) {
        return (
          <Fragment key={`${keyBase}-l${i}`}>
            <a
              href={safe}
              target="_blank"
              rel="noopener noreferrer nofollow"
              dir="ltr"
              className="text-emerald-700 [overflow-wrap:anywhere] [unicode-bidi:isolate] hover:underline"
            >
              {trimmed}
            </a>
            {inline(rest, `${keyBase}-r${i}`)}
          </Fragment>
        );
      }
    }
    // Formatting applies only outside links, so "a_b_c" in a URL stays intact.
    return <Fragment key={`${keyBase}-t${i}`}>{inline(part, `${keyBase}-t${i}`)}</Fragment>;
  });
}

// A marker only counts when it hugs a word, like Slack: "a * b" stays literal.
const INLINE = /(\*[^\s*](?:[^*\n]*[^\s*])?\*|_[^\s_](?:[^_\n]*[^\s_])?_|~[^\s~](?:[^~\n]*[^\s~])?~)/g;

function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(INLINE).flatMap<ReactNode>((part, i) => {
    const key = `${keyBase}-${i}`;
    if (i % 2 === 1) {
      const inner = part.slice(1, -1);
      if (part[0] === "*") return [<strong key={key} className="font-bold">{inline(inner, key)}</strong>];
      if (part[0] === "_") return [<em key={key}>{inline(inner, key)}</em>];
      if (part[0] === "~") return [<s key={key}>{inline(inner, key)}</s>];
    }
    return [part];
  });
}

/** Mentions are stored as <@userId>; shown as a highlighted @Name. */
function withMentions(text: string, keyBase: string, names: Map<string, string>, meId?: string): ReactNode[] {
  return text.split(/(<@[0-9a-f-]{36}>)/g).flatMap<ReactNode>((part, i) => {
    const key = `${keyBase}-m${i}`;
    if (i % 2 === 1) {
      const id = part.slice(2, -1);
      const mine = id === meId;
      return [
        <span
          key={key}
          className={`rounded px-0.5 font-semibold ${mine ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}
        >
          @{names.get(id) ?? "…"}
        </span>,
      ];
    }
    return linkify(part, key);
  });
}

function withCode(text: string, keyBase: string, names: Map<string, string>, meId?: string): ReactNode[] {
  return text.split(/(`[^`\n]+`)/g).flatMap<ReactNode>((part, i) => {
    const key = `${keyBase}-c${i}`;
    if (i % 2 === 1) {
      return [
        <code key={key} dir="ltr" className="rounded border border-[#e8e8e8] bg-[#f8f8f8] px-1 py-px font-mono text-[12px] text-[#e01e5a]">
          {part.slice(1, -1)}
        </code>,
      ];
    }
    return withMentions(part, key, names, meId);
  });
}

const NO_NAMES = new Map<string, string>();

export function Mrkdwn({ text, names = NO_NAMES, meId }: { text: string; names?: Map<string, string>; meId?: string }) {
  const blocks = text.split(/```([\s\S]*?)```/g);
  return (
    <>
      {blocks.map((block, i) =>
        i % 2 === 1 ? (
          <pre key={i} dir="ltr" className="my-1 overflow-x-auto whitespace-pre-wrap rounded border border-[#e8e8e8] bg-[#f8f8f8] p-2 font-mono text-[12px] text-[#1d1c1d]">
            {block.replace(/^\n/, "")}
          </pre>
        ) : (
          <Fragment key={i}>{withCode(block, `b${i}`, names, meId)}</Fragment>
        )
      )}
    </>
  );
}
