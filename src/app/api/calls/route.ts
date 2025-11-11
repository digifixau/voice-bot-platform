import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { ca } from 'zod/locales'

// GET /api/calls - List all calls for the user's organization
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    console.log('Session data:', JSON.stringify(session, null, 2))
    console.log('Organization ID:', session?.user?.organizationId)

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!session.user.organizationId) {
      console.error('User has no organization ID:', session.user)
      return NextResponse.json({ 
        error: 'User is not associated with any organization',
        user: {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role
        }
      }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const contactId = searchParams.get('contactId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {
      organizationId: session.user.organizationId
    }

    console.log(where)

    if (status) {
      where.status = status
    }

    if (contactId) {
      where.contactId = contactId
    }

    // Add date filtering
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lt = new Date(endDate)
      }
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
          agent: {
            select: {
              id: true,
              name: true,
              retellAgentId: true,
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

    console.log(calls)

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
