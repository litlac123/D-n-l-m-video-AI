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

    // Step 2: Generate images for all scenes in parallel (high speed)
    const imagePaths: string[] = new Array(script.scenes.length);
    let completedCount = 0;

    await Promise.all(
      script.scenes.map(async (scene, i) => {
        // Slight stagger to avoid burst lock
        await new Promise((r) => setTimeout(r, i * 400));

        const imageData = await generateImageFromPrompt(
          scene.visualPrompt,
          (msg) => {
            setJobProgress(jobId, {
              status: "processing",
              progress: Math.round(15 + (completedCount / script.scenes.length) * 60),
              currentStep: `${msg} [Cảnh ${i + 1}/${script.scenes.length}]`,
              script,
            });
          }
        );

        const imagePath = await saveBase64Image(
          imageData,
          `${jobId}_scene_${i + 1}.png`
        );
        imagePaths[i] = imagePath;
        completedCount++;

        setJobProgress(jobId, {
          status: "processing",
          progress: Math.round(15 + (completedCount / script.scenes.length) * 60),
          currentStep: `🎨 Đã tạo xong hình ảnh ${completedCount}/${script.scenes.length} cảnh...`,
          script,
        });
      })
    );

    // Step 3: Create video with FFmpeg
    setJobProgress(jobId, {
      status: "processing",
      progress: 80,
      currentStep: "🎥 Đang ghép video với hiệu ứng Ken Burns...",
      script,
    });

    const videoUrl = await createVideoFromImages(
      imagePaths,
      15, // 15 seconds per scene (4 scenes = 60s)
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
