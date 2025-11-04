import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// GET /api/calls/[id] - Get call details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const call = await prisma.call.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId
      },
      include: {
        contact: true,
        summary: true,
        recording: true,
      }
    })

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    return NextResponse.json({ call })
  } catch (error) {
    console.error('Error fetching call:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
