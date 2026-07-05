import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// DELETE /api/admin/calls/[id] - Delete a call (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const call = await prisma.call.findUnique({
      where: { id }
    })

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    await prisma.call.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Call deleted successfully' })
  } catch (error) {
    console.error('Error deleting call:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
