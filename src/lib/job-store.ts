export interface JobData {
  status: string;
  progress: number;
  currentStep: string;
  script?: any;
  videoUrl?: string;
  error?: string;
}

// In-memory job progress store (shared across route handlers)
const globalStore = global as unknown as {
  __jobProgressStore?: Map<string, JobData>;
};

if (!globalStore.__jobProgressStore) {
  globalStore.__jobProgressStore = new Map<string, JobData>();
}

export const jobStore = globalStore.__jobProgressStore;

export function setJobProgress(jobId: string, data: JobData) {
  jobStore.set(jobId, data);
}

export function getJobProgress(jobId: string): JobData | undefined {
  return jobStore.get(jobId);
}
