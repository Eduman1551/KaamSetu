// Skills-test generation (implemented in the next milestone).
export interface GenerationProgress {
  done: number;
  total: number;
  error: string | null;
}

export function queueTestGeneration(_studentId: string) {
  /* filled in by the test-generation milestone */
}

export function generationProgress(_studentId: string): GenerationProgress | null {
  return null;
}
