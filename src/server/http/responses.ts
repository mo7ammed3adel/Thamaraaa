import { NextResponse } from "next/server";

export function errorJson(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function unauthorizedJson() {
  return errorJson("Unauthorized", 401);
}

export function successJson<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
