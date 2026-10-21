import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Bạn là một biên kịch video chuyên nghiệp. Dựa trên ý tưởng sau, hãy tạo kịch bản video dài đúng 1 phút (60 giây).

Ý tưởng: ${idea}

Hãy chia thành 6 cảnh (scene), mỗi cảnh khoảng 10 giây. Trả về JSON theo format sau (KHÔNG có markdown, CHỈ JSON thuần):
{
  "title": "Tiêu đề video",
  "scenes": [
    {
      "sceneNumber": 1,
      "description": "Mô tả ngắn gọn cảnh này",
      "visualPrompt": "Prompt chi tiết bằng TIẾNG ANH để tạo hình ảnh cho cảnh này. Phải rất chi tiết về: composition, lighting, style, colors, subject. Ví dụ: 'A cinematic wide shot of a futuristic city at sunset, neon lights reflecting on wet streets, cyberpunk style, 8k, photorealistic'",
      "narration": "Lời thuyết minh bằng tiếng Việt cho cảnh này (khoảng 2-3 câu, đọc mất ~10 giây)",
      "durationSeconds": 10
    }
  ],
  "totalDuration": 60
}

Lưu ý:
- visualPrompt PHẢI bằng tiếng Anh, chi tiết, phong cách cinematic
- narration bằng tiếng Việt, tự nhiên, hấp dẫn
- Mỗi cảnh đúng 10 giây, tổng 6 cảnh = 60 giây
- Các cảnh phải liên kết logic với nhau thành câu chuyện hoàn chỉnh`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Không thể parse kịch bản từ Gemini");
  }

  const script: VideoScript = JSON.parse(jsonMatch[0]);
  return script;
}

export async function generateImageFromPrompt(
  visualPrompt: string
): Promise<string> {
  // Use Gemini's image generation (Imagen 3)
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-preview-image-generation" });

  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [{
        text: `Generate a high-quality cinematic image based on this description. Do NOT include any text in the image. Just generate the image.\n\nDescription: ${visualPrompt}`
      }]
    }],
    generationConfig: {
      responseModalities: ["image", "text"],
    } as any,
  });

  const response = result.response;
  const parts = response.candidates?.[0]?.content?.parts;

  if (parts) {
    for (const part of parts) {
      if ((part as any).inlineData) {
        const inlineData = (part as any).inlineData;
        return `data:${inlineData.mimeType};base64,${inlineData.data}`;
      }
    }
  }

  throw new Error("Gemini không trả về hình ảnh");
}
