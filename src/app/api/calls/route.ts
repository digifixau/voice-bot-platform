import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// GET /api/calls - List all calls for the user's organization
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const contactId = searchParams.get('contactId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {
      organizationId: session.user.organizationId
    }

    if (status) {
      where.status = status
    }

    if (contactId) {
      where.contactId = contactId
    }

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            }
          },
          summary: true,
          recording: {
            select: {
              id: true,
              cloudflareR2Url: true,
              recordingUrl: true,
              duration: true,
              format: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.call.count({ where })
    ])

    return NextResponse.json({ 
      calls,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching calls:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
