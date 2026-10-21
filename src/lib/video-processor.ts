import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

const OUTPUT_DIR = path.join(process.cwd(), "public", "output");
const TEMP_DIR = path.join(process.cwd(), "temp");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function saveBase64Image(
  base64Data: string,
  filename: string
): Promise<string> {
  await ensureDir(TEMP_DIR);
  const filePath = path.join(TEMP_DIR, filename);

  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Content, "base64");
  await fs.writeFile(filePath, buffer);

  return filePath;
}

export async function createVideoFromImages(
  imagePaths: string[],
  durationPerImage: number,
  jobId: string
): Promise<string> {
  await ensureDir(OUTPUT_DIR);

  const outputPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
  const framesPerImage = durationPerImage * 25; // 25 fps

  // Static images as inputs without -loop
  const inputs = imagePaths.map((p) => `-i "${p}"`).join(" ");

  const filterParts: string[] = [];
  const concatInputs: string[] = [];

  imagePaths.forEach((_p, i) => {
    const isZoomIn = i % 2 === 0;
    const zoomExpr = isZoomIn
      ? "min(zoom+0.001,1.25)"
      : "if(lte(zoom,1.0),1.25,max(1.001,zoom-0.001))";

    filterParts.push(
      `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,zoompan=z='${zoomExpr}':d=${framesPerImage}:s=1920x1080:fps=25[v${i}]`
    );
    concatInputs.push(`[v${i}]`);
  });

  const filterComplex = `${filterParts.join("; ")}; ${concatInputs.join("")}concat=n=${imagePaths.length}:v=1:a=0[outv]`;

  const cmd = `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[outv]" -c:v libx264 -preset veryfast -pix_fmt yuv420p -r 25 "${outputPath}"`;

  try {
    await execAsync(cmd, { timeout: 120000 });
  } catch (error: any) {
    console.error("FFmpeg error:", error.stderr || error.message);
    throw new Error(`FFmpeg xử lý thất bại: ${error.message}`);
  }

  return `/output/${jobId}.mp4`;
}

export async function cleanupTempFiles(jobId: string) {
  try {
    const files = await fs.readdir(TEMP_DIR);
    for (const file of files) {
      if (file.startsWith(jobId)) {
        await fs.unlink(path.join(TEMP_DIR, file));
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}
