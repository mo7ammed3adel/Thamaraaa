import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HiringClient from "./HiringClient";
import { Users } from "lucide-react";

export default async function HRHiringPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!["super_admin", "hr_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const applicants = await prisma.jobApplicant.findMany({
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Users className="me-3 text-blue-600 w-6 h-6" /> 
          Hiring Pipeline
        </h1>
      </div>
      <p className="text-gray-600 mb-6">Manage incoming job applicants and track their interview progress across departments.</p>
      
      <HiringClient initialApplicants={applicants} />
    </div>
  );
}
