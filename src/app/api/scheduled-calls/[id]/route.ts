import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// DELETE /api/scheduled-calls/[id] - Cancel a scheduled call
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const scheduledCall = await prisma.scheduledCall.findUnique({
      where: { id }
    })

    if (!scheduledCall) {
      return NextResponse.json({ error: 'Scheduled call not found' }, { status: 404 })
    }

    if (scheduledCall.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (scheduledCall.status !== 'PENDING') {
      return NextResponse.json({
        error: `Cannot cancel call with status: ${scheduledCall.status}`
      }, { status: 400 })
    }

    await prisma.scheduledCall.update({
      where: { id },
      data: { status: 'CANCELLED' }
    })

    return NextResponse.json({ message: 'Scheduled call cancelled successfully' })
  } catch (error) {
    console.error('Error cancelling scheduled call:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
