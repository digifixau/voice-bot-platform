import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, subDays } from 'date-fns'

// GET /api/reports/summary - Get call summary reports
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = startOfDay(subDays(new Date(), days))
    const endDate = endOfDay(new Date())

    const where = {
      organizationId: session.user.organizationId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      }
    }

    // Get total calls
    const totalCalls = await prisma.call.count({ where })

    // Get calls by status
    const callsByStatus = await prisma.call.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true
      }
    })

    // Get average call duration
    const avgDuration = await prisma.call.aggregate({
      where: {
        ...where,
        duration: {
          not: null
        }
      },
      _avg: {
        duration: true
      }
    })

    // Get calls per day for the last N days
    const callsPerDay = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*)::int as count,
        AVG(duration)::int as avg_duration
      FROM calls
      WHERE organization_id = ${session.user.organizationId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `

    // Get sentiment distribution
    const sentimentDistribution = await prisma.callSummary.groupBy({
      by: ['sentiment'],
      where: {
        call: {
          organizationId: session.user.organizationId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          }
        }
      },
      _count: {
        sentiment: true
      }
    })

    // Get top contacts by call count
    const topContacts = await prisma.contact.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        _count: {
          select: {
            calls: {
              where: {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                }
              }
            }
          }
        }
      },
      orderBy: {
        calls: {
          _count: 'desc'
        }
      },
      take: 10
    })

    return NextResponse.json({
      summary: {
        totalCalls,
        averageDuration: avgDuration._avg.duration || 0,
        statusBreakdown: callsByStatus.reduce((acc: any, curr) => {
          acc[curr.status] = curr._count.status
          return acc
        }, {}),
        sentimentBreakdown: sentimentDistribution.reduce((acc: any, curr) => {
          acc[curr.sentiment || 'unknown'] = curr._count.sentiment
          return acc
        }, {})
      },
      callsPerDay,
      topContacts: topContacts.map(c => ({
        id: c.id,
        name: c.name,
        phoneNumber: c.phoneNumber,
        callCount: c._count.calls
      })),
      dateRange: {
        start: startDate,
        end: endDate,
        days
      }
    })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
