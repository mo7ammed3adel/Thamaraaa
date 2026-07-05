import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { editProjectDetails, getProjectDetail } from "@/server/services/projectLifecycleService";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: string };

  try {
    const result = await getProjectDetail({ userId: user.id, userRole: user.role, projectId: params.id });

    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (result.status === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ project: result.project });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: string };

  try {
    const result = await editProjectDetails({
      userId: user.id,
      userRole: user.role,
      projectId: params.id,
      body: await req.json(),
    });

    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (result.status === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (result.status === "edit_forbidden") {
      return NextResponse.json({ error: "Forbidden: project details can only be edited by the assigned Account Manager or Head Account Manager" }, { status: 403 });
    }
    if (result.status === "invalid_url") {
      return NextResponse.json({ error: `${result.field} must be a valid http(s) URL` }, { status: 400 });
    }
    if (result.status === "no_fields") {
      return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
    }

    return NextResponse.json({ success: true, project: result.project });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
