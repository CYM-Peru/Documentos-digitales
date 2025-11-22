import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name?: string | null
    role: string
    organizationId: string
    organizationName: string
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
      organizationId: string
      organizationName: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    organizationId?: string
    organizationName?: string
  }
}
