"use client";

import { useState, useEffect, useRef } from "react";

interface Scene {
  sceneNumber: number;
  description: string;
  visualPrompt: string;
  narration: string;
  durationSeconds: number;
}

interface VideoScript {
  title: string;
  scenes: Scene[];
  totalDuration: number;
}

interface JobProgress {
  status: string;
  progress: number;
  currentStep: string;
  script?: VideoScript;
  videoUrl?: string;
  error?: string;
}

export default function Home() {
  const [idea, setIdea] = useState("");
  const [voice, setVoice] = useState<"female" | "male">("female");
  const [durationMode, setDurationMode] = useState<"1m" | "3m" | "5m">("1m");
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [showResult, setShowResult] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Poll for progress updates
  useEffect(() => {
    if (!jobId) return;

    const pollProgress = async () => {
      try {
        const res = await fetch(`/api/progress/${jobId}`);
        if (res.ok) {
          const data: JobProgress = await res.json();
          setProgress(data);

          if (data.status === "completed" || data.status === "error") {
            setIsGenerating(false);
            if (data.status === "completed") {
              setShowResult(true);
            }
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    pollingRef.current = setInterval(pollProgress, 2000);
    pollProgress(); // Initial call

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [jobId]);

  const handleGenerate = async () => {
    if (!idea.trim()) return;

    setIsGenerating(true);
    setProgress(null);
    setShowResult(false);
    setJobId(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: idea.trim(),
          voice,
          durationMode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setProgress({
          status: "error",
          progress: 0,
          currentStep: "❌ Lỗi",
          error: data.error,
        });
        setIsGenerating(false);
        return;
      }

      setJobId(data.jobId);
    } catch (err: any) {
      setProgress({
        status: "error",
        progress: 0,
        currentStep: "❌ Lỗi kết nối",
        error: err.message,
      });
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const exampleIdeas = [
    "Hành trình một chú rùa con vượt biển lớn",
    "Thành phố cyberpunk năm 2099 về đêm",
    "Truyền thuyết về thanh gươm rồng thần thoại",
    "Một ngày bình yên ở vùng cao Tây Bắc",
  ];

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10 mt-6">
        <div className="animate-float inline-block mb-3">
          <span className="text-6xl">🎬</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-3">
          Studio Phim AI
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
          Tạo phim ngắn & video điện ảnh kèm{" "}
          <span className="text-purple-300 font-semibold">
            lồng tiếng thuyết minh tiếng Việt
          </span>{" "}
          hoàn toàn tự động
        </p>
      </div>

      {/* Input Section */}
      <div className="w-full max-w-2xl mb-8 space-y-4">
        {/* Controls: Voice & Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
          {/* Voice Selector */}
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 block">
              🎙️ Giọng thuyết minh AI
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVoice("female")}
                disabled={isGenerating}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                  voice === "female"
                    ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-purple-500/25"
                    : "bg-white/5 hover:bg-white/10 text-gray-300"
                }`}
              >
                👩 Hoài My (Nữ)
              </button>
              <button
                type="button"
                onClick={() => setVoice("male")}
                disabled={isGenerating}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                  voice === "male"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                    : "bg-white/5 hover:bg-white/10 text-gray-300"
                }`}
              >
                👨 Nam Minh (Nam)
              </button>
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 block">
              ⏱️ Thời lượng phim
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDurationMode("1m")}
                disabled={isGenerating}
                className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  durationMode === "1m"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/25"
                    : "bg-white/5 hover:bg-white/10 text-gray-300"
                }`}
              >
                1 Phút (4 cảnh)
              </button>
              <button
                type="button"
                onClick={() => setDurationMode("3m")}
                disabled={isGenerating}
                className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  durationMode === "3m"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/25"
                    : "bg-white/5 hover:bg-white/10 text-gray-300"
                }`}
              >
                3 Phút (8 cảnh)
              </button>
              <button
                type="button"
                onClick={() => setDurationMode("5m")}
                disabled={isGenerating}
                className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  durationMode === "5m"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/25"
                    : "bg-white/5 hover:bg-white/10 text-gray-300"
                }`}
              >
                5 Phút (12 cảnh)
              </button>
            </div>
          </div>
        </div>

        {/* Idea Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập ý tưởng bộ phim của bạn... (ví dụ: Chuyến thám hiểm hành tinh xa xôi của phi hành gia)"
            className="w-full h-32 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 resize-none text-base md:text-lg transition-all"
            disabled={isGenerating}
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !idea.trim()}
            className="absolute bottom-4 right-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/25"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Đang sản xuất phim...
              </span>
            ) : (
              "✨ Bắt đầu làm phim"
            )}
          </button>
        </div>

        {/* Example Ideas */}
        {!isGenerating && !showResult && (
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-gray-500 text-sm py-1">Gợi ý ý tưởng:</span>
            {exampleIdeas.map((ex, i) => (
              <button
                key={i}
                onClick={() => setIdea(ex)}
                className="text-xs sm:text-sm bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/5 transition-all"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Progress Section */}
      {progress && progress.status === "processing" && (
        <div className="w-full max-w-2xl mb-8 animate-pulse-glow rounded-2xl">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-medium text-sm sm:text-base">
                {progress.currentStep}
              </span>
              <span className="text-purple-400 font-bold">
                {progress.progress}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 h-3 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress.progress}%` }}
              />
            </div>

            {/* Script preview */}
            {progress.script && (
              <div className="mt-6 space-y-3">
                <h3 className="text-white font-semibold text-lg flex items-center justify-between">
                  <span>📝 Kịch bản: {progress.script.title}</span>
                  <span className="text-xs text-purple-400 font-normal">
                    {progress.script.scenes.length} cảnh
                  </span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                  {progress.script.scenes.map((scene, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border text-sm bg-purple-500/10 border-purple-500/30 text-purple-300"
                    >
                      <div className="font-medium text-xs">Cảnh {scene.sceneNumber}</div>
                      <div className="text-xs mt-1 opacity-75 line-clamp-2">
                        {scene.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {progress && progress.status === "error" && (
        <div className="w-full max-w-2xl mb-8">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
            <h3 className="text-red-400 font-semibold text-lg mb-2">
              ❌ Có lỗi xảy ra
            </h3>
            <p className="text-red-300/80">{progress.error}</p>
            <button
              onClick={() => {
                setProgress(null);
                setJobId(null);
                setIsGenerating(false);
              }}
              className="mt-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-lg transition-all"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* Result Section */}
      {showResult && progress?.status === "completed" && progress.videoUrl && (
        <div className="w-full max-w-3xl mb-8">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-semibold text-xl mb-4 flex items-center gap-2">
              🎉 Bộ phim có lồng tiếng đã hoàn thành!
              {progress.script && (
                <span className="text-purple-400">
                  - {progress.script.title}
                </span>
              )}
            </h3>

            {/* Video Player */}
            <div className="rounded-xl overflow-hidden bg-black mb-4 shadow-2xl border border-white/10">
              <video
                controls
                autoPlay
                className="w-full aspect-video"
                src={progress.videoUrl}
              >
                Trình duyệt không hỗ trợ phát video.
              </video>
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              <a
                href={progress.videoUrl}
                download
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-green-500/25"
              >
                ⬇️ Tải Phim Về Máy
              </a>
              <button
                onClick={() => {
                  setShowResult(false);
                  setProgress(null);
                  setJobId(null);
                  setIdea("");
                }}
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl font-semibold transition-all"
              >
                🔄 Làm Bộ Phim Khác
              </button>
            </div>

            {/* Script Details */}
            {progress.script && (
              <div className="mt-6 border-t border-white/10 pt-4">
                <h4 className="text-gray-400 font-medium mb-3">
                  📋 Chi tiết kịch bản & Lời thoại lồng tiếng
                </h4>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                  {progress.script.scenes.map((scene) => (
                    <div
                      key={scene.sceneNumber}
                      className="bg-white/5 rounded-lg p-3"
                    >
                      <div className="text-purple-400 font-medium text-sm flex items-center justify-between">
                        <span>Cảnh {scene.sceneNumber}: {scene.description}</span>
                        <span className="text-xs text-gray-500">
                          {scene.durationSeconds}s
                        </span>
                      </div>
                      <div className="text-gray-300 text-sm mt-1 italic">
                        &quot;{scene.narration}&quot;
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto pt-8 pb-4 text-center text-gray-600 text-sm">
        Studio Phim AI • Tạo Phim Điện Ảnh Tự Động Kèm Lồng Tiếng Tiếng Việt
      </footer>
    </main>
  );
}
