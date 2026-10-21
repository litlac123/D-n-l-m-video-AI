import { NextRequest, NextResponse } from "next/server";
import { generateScript, generateImageFromPrompt } from "@/lib/gemini";
import {
  saveBase64Image,
  createVideoFromScenes,
  cleanupTempFiles,
  SceneAsset,
} from "@/lib/video-processor";
import { generateSpeech, VoiceGender } from "@/lib/tts";
import { setJobProgress } from "@/lib/job-store";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  const {
    idea,
    voice = "female",
    durationMode = "1m",
  } = await request.json();

  if (!idea || typeof idea !== "string") {
    return NextResponse.json(
      { error: "Vui lòng nhập ý tưởng phim / video" },
      { status: 400 }
    );
  }

  const jobId = uuidv4();

  // Start async processing
  processVideo(jobId, idea, voice as VoiceGender, durationMode).catch(
    (error) => {
      setJobProgress(jobId, {
        status: "error",
        progress: 0,
        currentStep: "Lỗi",
        error: error.message,
      });
    }
  );

  return NextResponse.json({ jobId });
}

async function processVideo(
  jobId: string,
  idea: string,
  voice: VoiceGender,
  durationMode: "1m" | "3m" | "5m"
) {
  try {
    // Step 1: Generate script
    setJobProgress(jobId, {
      status: "processing",
      progress: 5,
      currentStep: "🎬 Đang lên kịch bản điện ảnh từ ý tưởng...",
    });

    const script = await generateScript(idea, durationMode);

    setJobProgress(jobId, {
      status: "processing",
      progress: 15,
      currentStep: `📝 Kịch bản "${script.title}" (${script.scenes.length} cảnh) đã sẵn sàng!`,
      script,
    });

    // Step 2: Generate Voiceover audio for all scenes
    setJobProgress(jobId, {
      status: "processing",
      progress: 25,
      currentStep: "🎙️ Đang thu âm lồng tiếng AI tiếng Việt cho từng cảnh...",
      script,
    });

    const audioAssets: { audioPath: string; duration: number }[] = [];
    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      const audioResult = await generateSpeech(
        scene.narration || scene.description,
        `${jobId}_audio_${i + 1}.mp3`,
        voice
      );
      audioAssets.push(audioResult);
    }

    // Step 3: Generate images in parallel (turbo speed)
    setJobProgress(jobId, {
      status: "processing",
      progress: 45,
      currentStep: `🎨 Đang tạo hình ảnh AI chuẩn 8K cho ${script.scenes.length} cảnh...`,
      script,
    });

    const imagePaths: string[] = new Array(script.scenes.length);
    let completedImages = 0;

    await Promise.all(
      script.scenes.map(async (scene, i) => {
        await new Promise((r) => setTimeout(r, i * 350));

        const imageData = await generateImageFromPrompt(
          scene.visualPrompt,
          (msg) => {
            setJobProgress(jobId, {
              status: "processing",
              progress: Math.round(45 + (completedImages / script.scenes.length) * 35),
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
        completedImages++;

        setJobProgress(jobId, {
          status: "processing",
          progress: Math.round(45 + (completedImages / script.scenes.length) * 35),
          currentStep: `🎨 Đã tạo xong hình ảnh ${completedImages}/${script.scenes.length} cảnh...`,
          script,
        });
      })
    );

    // Step 4: Assemble video + audio with FFmpeg
    setJobProgress(jobId, {
      status: "processing",
      progress: 85,
      currentStep: "🎥 Đang lồng tiếng và ghép phim với hiệu ứng Ken Burns...",
      script,
    });

    const sceneAssets: SceneAsset[] = script.scenes.map((_scene, i) => {
      const audioDuration = audioAssets[i]?.duration || 10;
      // Add slight pause after narration for cinematic pacing
      const sceneDuration = Math.max(audioDuration + 1, 6);
      return {
        imagePath: imagePaths[i],
        audioPath: audioAssets[i]?.audioPath,
        duration: sceneDuration,
      };
    });

    const videoUrl = await createVideoFromScenes(sceneAssets, jobId);

    // Step 5: Completed!
    setJobProgress(jobId, {
      status: "completed",
      progress: 100,
      currentStep: "🎉 Bộ phim có lồng tiếng đã hoàn thành!",
      script,
      videoUrl,
    });

    // Cleanup temp files after 5 minutes
    setTimeout(() => cleanupTempFiles(jobId), 300000);
  } catch (error: any) {
    setJobProgress(jobId, {
      status: "error",
      progress: 0,
      currentStep: "❌ Lỗi",
      error: error.message,
    });
  }
}
