import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createAgentSchema = z.object({
  retellAgentId: z.string().min(1, 'Retell Agent ID is required'),
  name: z.string().min(1, 'Agent name is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
})

// GET /api/agents - List all agents (filtered by org for non-admins)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId')

    // Admin can see all agents, org users only see their own
    const where: any = {}
    if (session.user.role === 'ADMIN') {
      if (organizationId) {
        where.organizationId = organizationId
      }
    } else {
      where.organizationId = session.user.organizationId
    }

    const agents = await prisma.agent.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          }
        },
        _count: {
          select: {
            calls: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ agents })
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/agents - Register a new agent
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createAgentSchema.parse(body)

    // Check if user has permission to create agent for this org
    if (session.user.role !== 'ADMIN') {
      if (validatedData.organizationId !== session.user.organizationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Check if agent already exists
    const existingAgent = await prisma.agent.findUnique({
      where: { retellAgentId: validatedData.retellAgentId }
    })

    if (existingAgent) {
      return NextResponse.json(
        { error: 'Agent with this Retell Agent ID already exists' },
        { status: 400 }
      )
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: validatedData.organizationId }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Create agent
    const agent = await prisma.agent.create({
      data: {
        retellAgentId: validatedData.retellAgentId,
        name: validatedData.name,
        organizationId: validatedData.organizationId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json({ agent }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating agent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
