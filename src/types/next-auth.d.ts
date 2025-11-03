import { UserRole } from '@prisma/client'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      organizationId: string | null
      organizationName?: string
    } & DefaultSession['user']
  }

  interface User {
    role: UserRole
    organizationId: string | null
    organizationName?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    organizationId: string | null
    organizationName?: string
  }
}
