import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listProjectFiles, uploadProjectFile } from "@/server/services/projectLifecycleService";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; role?: string } | undefined;
    if (!user?.id || !user.role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await listProjectFiles({ userId: user.id, userRole: user.role, projectId: params.id });
    if (result.status === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json(result.files);
  } catch (error) {
    console.error("Failed to fetch project files:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; role?: string; name?: string } | undefined;
    const userName = sessionUser?.name;
    const userId = sessionUser?.id;
    const userRole = sessionUser?.role;
    if (!userId || !userRole || !userName) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await uploadProjectFile({
      userId,
      userRole,
      userName,
      projectId: params.id,
      body: await request.json(),
    });

    if (result.status === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (result.status === "missing_file_info") {
      return NextResponse.json({ error: "Missing file information" }, { status: 400 });
    }

    return NextResponse.json(result.file);
  } catch (error) {
    console.error("Failed to upload file:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
