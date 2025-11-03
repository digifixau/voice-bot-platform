import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { UserRole } from '@prisma/client'

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== UserRole.ADMIN) {
    throw new Error('Admin access required')
  }
  return user
}

export async function requireOrganization() {
  const user = await requireAuth()
  if (!user.organizationId) {
    throw new Error('Organization membership required')
  }
  return user
}
