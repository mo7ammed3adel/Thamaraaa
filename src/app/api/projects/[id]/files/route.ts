import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const files = await prisma.projectFile.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(files);
  } catch (error) {
    console.error("Failed to fetch project files:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userName = (session?.user as any)?.name;
    const userId = (session?.user as any)?.id;
    if (!userName) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { fileUrl, fileType } = await request.json();
    if (!fileUrl || !fileType) {
      return NextResponse.json({ error: "Missing file information" }, { status: 400 });
    }

    const newFile = await prisma.projectFile.create({
      data: {
        projectId: params.id,
        fileUrl,
        fileType,
        uploadedBy: userName
      }
    });

    await prisma.projectLog.create({
      data: {
        projectId: params.id,
        action: "file_uploaded",
        details: `Uploaded ${fileType} document.`,
        userId: userId
      }
    });

    return NextResponse.json(newFile);
  } catch (error) {
    console.error("Failed to upload file:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
