import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || 'today'
    
    let startDate = new Date()
    let endDate = new Date()

    const now = new Date()

    switch (range) {
      case 'today':
        startDate = startOfDay(now)
        endDate = endOfDay(now)
        break
      case 'yesterday':
        startDate = startOfDay(subDays(now, 1))
        endDate = endOfDay(subDays(now, 1))
        break
      case 'week':
        startDate = subDays(now, 7)
        endDate = endOfDay(now)
        break
      case 'month':
        startDate = subDays(now, 30)
        endDate = endOfDay(now)
        break
      case 'all':
        startDate = new Date(0) // Beginning of time
        endDate = endOfDay(now)
        break
      default:
        startDate = startOfDay(now)
        endDate = endOfDay(now)
    }

    const orgId = session.user.organizationId

    // Parallelize queries for performance
    const [
      totalCalls,
      inboundCalls,
      outboundCalls,
      sentimentData,
      agentsConnected,
      disconnectionReasonData
    ] = await Promise.all([
      // Total Calls
      prisma.call.count({
        where: {
          organizationId: orgId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      // Inbound Calls
      prisma.call.count({
        where: {
          organizationId: orgId,
          direction: 'inbound',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      // Outbound Calls
      prisma.call.count({
        where: {
          organizationId: orgId,
          direction: 'outbound',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      // Sentiment Analysis
      prisma.callSummary.groupBy({
        by: ['sentiment'],
        where: {
          call: {
            organizationId: orgId,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        _count: {
          sentiment: true
        }
      }),
      // Agents Connected (Total agents for org, not date dependent usually)
      prisma.agent.count({
        where: {
          organizationId: orgId
        }
      }),
      // Disconnection Reason Analysis
      prisma.call.groupBy({
        by: ['disconnectionReason'],
        where: {
          organizationId: orgId,
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          disconnectionReason: {
            not: null
          }
        },
        _count: {
          disconnectionReason: true
        }
      })
    ])

    // Format sentiment data for frontend
    const sentiment = sentimentData.map(item => ({
      name: item.sentiment || 'Unknown',
      value: item._count.sentiment
    }))

    // Format disconnection reason data for frontend
    const disconnectionReasons = disconnectionReasonData.map(item => ({
      name: item.disconnectionReason || 'Unknown',
      value: item._count.disconnectionReason
    }))

    return NextResponse.json({
      totalCalls,
      inboundCalls,
      outboundCalls,
      sentiment,
      agentsConnected,
      disconnectionReasons
    })

  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
