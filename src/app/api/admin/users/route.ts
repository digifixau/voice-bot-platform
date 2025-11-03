import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'ORG_USER']),
  organizationId: z.string().optional(),
})

// GET /api/admin/users - List all users
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId')

    const users = await prisma.user.findMany({
      where: organizationId ? { organizationId } : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/users - Create new user
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
    }

    // Validate organization exists if organizationId is provided
    if (validatedData.organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: validatedData.organizationId }
      })

      if (!organization) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        name: validatedData.name,
        password: hashedPassword,
        role: validatedData.role,
        organizationId: validatedData.organizationId || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
