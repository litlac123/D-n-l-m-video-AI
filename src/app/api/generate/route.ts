import { NextRequest, NextResponse } from "next/server";
import { generateScript, generateImageFromPrompt } from "@/lib/gemini";
import {
  saveBase64Image,
  createVideoFromImages,
  cleanupTempFiles,
} from "@/lib/video-processor";
import { setJobProgress } from "@/lib/job-store";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  const { idea } = await request.json();

  if (!idea || typeof idea !== "string") {
    return NextResponse.json(
      { error: "Vui lòng nhập ý tưởng video" },
      { status: 400 }
    );
  }

  const jobId = uuidv4();

  // Start async processing
  processVideo(jobId, idea).catch((error) => {
    setJobProgress(jobId, {
      status: "error",
      progress: 0,
      currentStep: "Lỗi",
      error: error.message,
    });
  });

  return NextResponse.json({ jobId });
}

async function processVideo(jobId: string, idea: string) {
  try {
    // Step 1: Generate script
    setJobProgress(jobId, {
      status: "processing",
      progress: 5,
      currentStep: "🎬 Đang tạo kịch bản từ ý tưởng...",
    });

    const script = await generateScript(idea);

    setJobProgress(jobId, {
      status: "processing",
      progress: 15,
      currentStep: `📝 Kịch bản "${script.title}" đã sẵn sàng! Đang tạo hình ảnh...`,
      script,
    });

    // Step 2: Generate images for each scene
    const imagePaths: string[] = [];

    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      const progressPercent = 15 + ((i + 1) / script.scenes.length) * 60;

      setJobProgress(jobId, {
        status: "processing",
        progress: Math.round(progressPercent),
        currentStep: `🎨 Đang tạo hình ảnh cảnh ${i + 1}/${script.scenes.length}: ${scene.description}`,
        script,
      });

      const imageData = await generateImageFromPrompt(scene.visualPrompt);
      const imagePath = await saveBase64Image(
        imageData,
        `${jobId}_scene_${i + 1}.png`
      );
      imagePaths.push(imagePath);

      // Small delay to avoid rate limiting
      if (i < script.scenes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Step 3: Create video with FFmpeg
    setJobProgress(jobId, {
      status: "processing",
      progress: 80,
      currentStep: "🎥 Đang ghép video với hiệu ứng Ken Burns...",
      script,
    });

    const videoUrl = await createVideoFromImages(
      imagePaths,
      10, // 10 seconds per scene
      jobId
    );

    // Step 4: Done!
    setJobProgress(jobId, {
      status: "completed",
      progress: 100,
      currentStep: "✅ Video đã hoàn thành!",
      script,
      videoUrl,
    });

    // Cleanup temp files after a delay
    setTimeout(() => cleanupTempFiles(jobId), 60000);
  } catch (error: any) {
    setJobProgress(jobId, {
      status: "error",
      progress: 0,
      currentStep: "❌ Lỗi",
      error: error.message,
    });
  }
}
