import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendUserNotification } from "@/server/services/notificationService";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sender = session.user as { id: string; role: string };
    const result = await sendUserNotification({ sender, body: await req.json() });

    if (result.status === "missing_fields") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (result.status === "invalid_link") {
      return NextResponse.json({ error: "Invalid notification link" }, { status: 400 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden: your role cannot send notifications" }, { status: 403 });
    }
    if (result.status === "target_not_found") {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, notification: result.notification });
  } catch (error) {
    console.error("Failed to send notification:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
