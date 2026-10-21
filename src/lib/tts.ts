import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { createWriteStream, promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const TEMP_DIR = path.join(process.cwd(), "temp");

export type VoiceGender = "female" | "male";

export async function generateSpeech(
  text: string,
  filename: string,
  voice: VoiceGender = "female"
): Promise<{ audioPath: string; duration: number }> {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  const audioPath = path.join(TEMP_DIR, filename);

  const voiceName =
    voice === "male" ? "vi-VN-NamMinhNeural" : "vi-VN-HoaiMyNeural";

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  // Clean text from emojis / special characters
  const cleanText = text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .trim();

  const readable = tts.toStream(cleanText || "...");
  const writeStream = createWriteStream(audioPath);
  readable.audioStream.pipe(writeStream);

  await new Promise<void>((resolve, reject) => {
    writeStream.on("finish", () => resolve());
    writeStream.on("error", (err) => reject(err));
  });

  // Measure audio duration using ffprobe
  let duration = 5;
  try {
    const { stdout } = await execAsync(
      `ffprobe -i "${audioPath}" -show_entries format=duration -v quiet -of csv="p=0"`
    );
    const parsed = parseFloat(stdout.trim());
    if (!isNaN(parsed) && parsed > 0) {
      duration = Math.max(parsed, 3); // minimum 3 seconds
    }
  } catch {
    duration = Math.max(Math.ceil(cleanText.length / 15), 5);
  }

  return { audioPath, duration };
}
