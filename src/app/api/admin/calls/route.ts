import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { CallStatus } from '@prisma/client'

// GET /api/admin/calls - List calls across organizations (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Prisma.CallWhereInput = {}

    if (organizationId) {
      where.organizationId = organizationId
    }

    if (status) {
      where.status = status as CallStatus
    }

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            }
          },
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
            }
          },
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
