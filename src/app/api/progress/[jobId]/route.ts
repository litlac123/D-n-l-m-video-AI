import { NextRequest, NextResponse } from "next/server";
import { getJobProgress } from "@/lib/job-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;
  const progress = getJobProgress(jobId);

  if (!progress) {
    return NextResponse.json(
      { error: "Job không tồn tại" },
      { status: 404 }
    );
  }

  return NextResponse.json(progress);
}
