import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phoneNumber: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email().optional(),
  notes: z.string().optional(),
})

// GET /api/contacts - List all contacts for the user's organization
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contacts = await prisma.contact.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
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

    return NextResponse.json({ contacts })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/contacts - Create new contact
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createContactSchema.parse(body)

    const contact = await prisma.contact.create({
      data: {
        ...validatedData,
        organizationId: session.user.organizationId
      }
    })

    return NextResponse.json({ contact }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating contact:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
