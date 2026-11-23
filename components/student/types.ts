import type { StudentDashboardData } from '@/lib/server/student';
import type { GenerationProgress } from '@/lib/server/testGen';

/** Dashboard payload from /api/student/dashboard (type-only import, no server code). */
export type StudentData = StudentDashboardData & { generation: GenerationProgress | null };
