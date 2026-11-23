import 'next-auth';
import 'next-auth/jwt';

type Role = 'student' | 'company' | 'college';

declare module 'next-auth' {
  interface Session {
    user: { id: string; role: Role; name?: string | null; email?: string | null };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: Role;
  }
}
