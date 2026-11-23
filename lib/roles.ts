// Role constants safe to import on both client and server.
export type Role = 'student' | 'company' | 'college';

export const DASHBOARD: Record<Role, string> = {
  student: '/dashboard/student',
  company: '/dashboard/company',
  college: '/dashboard/college',
};
