export interface Scene {
  sceneNumber: number;
  description: string;
  visualPrompt: string;
  narration: string;
  durationSeconds: number;
}

export interface VideoScript {
  title: string;
  scenes: Scene[];
  totalDuration: number;
}

export async function generateScript(idea: string): Promise<VideoScript> {
  const prompt = `Bạn là một biên kịch video chuyên nghiệp. Dựa trên ý tưởng sau, hãy tạo kịch bản video dài đúng 1 phút (60 giây).

Ý tưởng: ${idea}

Hãy chia thành 4 cảnh (scene), mỗi cảnh đúng 15 giây. Trả về DUY NHẤT 1 object JSON theo đúng định dạng sau (KHÔNG giải thích, KHÔNG có markdown):
{
  "title": "Tiêu đề video",
  "scenes": [
    {
      "sceneNumber": 1,
      "description": "Mô tả ngắn gọn cảnh này",
      "visualPrompt": "A detailed cinematic photorealistic 8k wide shot in English describing lighting, colors, style, subject without text",
      "narration": "Lời thuyết minh bằng tiếng Việt cho cảnh này",
      "durationSeconds": 15
    }
  ],
  "totalDuration": 60
}`;

  try {
    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        jsonMode: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Lỗi kết nối AI (${res.status})`);
    }

    const text = await res.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Không thể parse kịch bản từ AI");
    }

    const script: VideoScript = JSON.parse(jsonMatch[0]);
    if (!script.scenes || script.scenes.length === 0) {
      throw new Error("Kịch bản tạo ra không hợp lệ");
    }

    return script;
  } catch (error: any) {
    console.error("Lỗi tạo kịch bản, dùng template dự phòng:", error.message);
    return {
      title: idea.slice(0, 30),
      scenes: [
        {
          sceneNumber: 1,
          description: "Mở đầu câu chuyện",
          visualPrompt: `Cinematic wide shot opening of ${idea}, 8k, photorealistic, dramatic lighting`,
          narration: `Chào mừng bạn đến với câu chuyện về ${idea}.`,
          durationSeconds: 15,
        },
        {
          sceneNumber: 2,
          description: "Phát triển bối cảnh",
          visualPrompt: `Detailed medium shot exploring ${idea}, vibrant colors, high detail`,
          narration: "Những chi tiết kỳ diệu dần dần được hé mở trước mắt.",
          durationSeconds: 15,
        },
        {
          sceneNumber: 3,
          description: "Cao trào điểm nhấn",
          visualPrompt: `Epic dynamic focal point shot of ${idea}, stunning visuals, hyperrealistic`,
          narration: "Mọi cảm xúc và vẻ đẹp đạt đến đỉnh điểm trong khoảnh khắc này.",
          durationSeconds: 15,
        },
        {
          sceneNumber: 4,
          description: "Kết thúc",
          visualPrompt: `Epic wide angle conclusion shot of ${idea}, breathtaking cinematic finale`,
          narration: "Cảm ơn bạn đã đồng hành trong hành trình tuyệt vời này.",
          durationSeconds: 15,
        },
      ],
      totalDuration: 60,
    };
  }
}

export async function generateImageFromPrompt(
  visualPrompt: string,
  onRetry?: (waitSec: number) => void
): Promise<string> {
  const seed = Math.floor(Math.random() * 10000000);
  const cleanPrompt = visualPrompt
    .replace(/[^\w\s,.-]/gi, "")
    .slice(0, 300);

  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    cleanPrompt
  )}?nologo=true&seed=${seed}`;

  const maxRetries = 4;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(imageUrl);

      if (res.status === 402 && attempt < maxRetries) {
        const retryHeader = res.headers.get("retry-after");
        const waitSec = retryHeader ? parseInt(retryHeader, 10) + 2 : 15;
        if (onRetry) onRetry(waitSec);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }

      if (!res.ok) {
        throw new Error(`Không thể tạo hình ảnh (HTTP ${res.status})`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const contentType = res.headers.get("content-type") || "image/jpeg";

      return `data:${contentType};base64,${base64}`;
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  throw new Error("Không thể tạo hình ảnh sau các lần thử");
}
