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
  onNotify?: (message: string) => void
): Promise<string> {
  const cleanPrompt = visualPrompt
    .replace(/[^\w\s,.-]/gi, "")
    .slice(0, 250);

  // Prioritize ultra-fast models (turbo/sana generate in <1s) with fallback
  const models = ["turbo", "sana", ""];
  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const seed = Math.floor(Math.random() * 10000000);
    const modelParam = models[(attempt - 1) % models.length];
    const modelQuery = modelParam ? `&model=${modelParam}` : "";

    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      cleanPrompt
    )}?nologo=true&seed=${seed}${modelQuery}`;

    try {
      const res = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "image/jpeg,image/png,image/*",
        },
      });

      // Handle 402 Rate Limit (queue delay)
      if (res.status === 402) {
        const retryHeader = res.headers.get("retry-after");
        const waitSec = retryHeader ? parseInt(retryHeader, 10) + 2 : 15;
        if (onNotify) onNotify(`⏳ Đang xếp hàng xử lý (chờ ${waitSec}s)...`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }

      // Handle 503 / 502 / 504 / 500 / 429 (Server busy / overloaded)
      if (!res.ok) {
        if (attempt < maxRetries) {
          if (onNotify)
            onNotify(
              `⚠️ Máy chủ AI đang bận (HTTP ${res.status}), đang chuyển server dự phòng (lần ${attempt}/${maxRetries})...`
            );
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        throw new Error(
          `Máy chủ AI hiện đang bận (HTTP ${res.status}). Vui lòng bấm thử lại sau giây lát.`
        );
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const contentType = res.headers.get("content-type") || "image/jpeg";

      return `data:${contentType};base64,${base64}`;
    } catch (err: any) {
      if (attempt === maxRetries) {
        throw new Error(
          err.message || "Không thể kết nối máy chủ tạo ảnh. Vui lòng thử lại."
        );
      }
      if (onNotify)
        onNotify(`🔄 Đang thử lại kết nối (lần ${attempt}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  throw new Error("Không thể tạo hình ảnh sau các lần thử");
}
