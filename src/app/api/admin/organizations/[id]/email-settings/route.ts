import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { testSmtpConnection, sendTestEmail } from '@/lib/email'

const emailSettingsSchema = z.object({
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().min(1, 'SMTP username is required'),
  smtpPassword: z.string().min(1, 'SMTP password is required'),
  fromEmail: z.string().email('Valid email address required'),
  fromName: z.string().optional(),
  toEmails: z.array(z.string().email()).min(1, 'At least one recipient email is required'),
  notificationTrigger: z.enum(['INBOUND_ONLY', 'OUTBOUND_ONLY', 'BOTH']).default('BOTH'),
  isEnabled: z.boolean().default(true),
})

const updateEmailSettingsSchema = emailSettingsSchema.partial()

const testEmailSchema = z.object({
  toEmail: z.string().email('Valid email address required'),
})

// GET /api/admin/organizations/[id]/email-settings - Get email settings for an organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: organizationId } = await params

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const emailSettings = await prisma.emailSettings.findUnique({
      where: { organizationId },
    })

    // Return null values for sensitive fields in response (don't expose password)
    if (emailSettings) {
      return NextResponse.json({
        emailSettings: {
          ...emailSettings,
          smtpPassword: '••••••••', // Mask password
        }
      })
    }

    return NextResponse.json({ emailSettings: null })
  } catch (error) {
    console.error('Error fetching email settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/organizations/[id]/email-settings - Create email settings for an organization
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: organizationId } = await params
    const body = await req.json()

    // Check if this is a test email request
    if (body.action === 'test') {
      const testData = testEmailSchema.parse(body)
      
      // Get existing settings to test with
      const existingSettings = await prisma.emailSettings.findUnique({
        where: { organizationId },
      })

      if (!existingSettings) {
        return NextResponse.json({ error: 'Email settings not configured yet' }, { status: 400 })
      }

      const result = await sendTestEmail(
        {
          smtpHost: existingSettings.smtpHost,
          smtpPort: existingSettings.smtpPort,
          smtpSecure: existingSettings.smtpSecure,
          smtpUser: existingSettings.smtpUser,
          smtpPassword: existingSettings.smtpPassword,
          fromEmail: existingSettings.fromEmail,
          fromName: existingSettings.fromName || undefined,
        },
        testData.toEmail
      )

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ message: 'Test email sent successfully' })
    }

    // Check if this is a connection test request
    if (body.action === 'testConnection') {
      const settingsData = emailSettingsSchema.parse(body)
      
      const result = await testSmtpConnection({
        smtpHost: settingsData.smtpHost,
        smtpPort: settingsData.smtpPort,
        smtpSecure: settingsData.smtpSecure,
        smtpUser: settingsData.smtpUser,
        smtpPassword: settingsData.smtpPassword,
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ message: 'SMTP connection successful' })
    }

    // Regular create/update operation
    const validatedData = emailSettingsSchema.parse(body)

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if settings already exist
    const existingSettings = await prisma.emailSettings.findUnique({
      where: { organizationId },
    })

    if (existingSettings) {
      return NextResponse.json(
        { error: 'Email settings already exist. Use PATCH to update.' },
        { status: 409 }
      )
    }

    // Test SMTP connection before saving
    const connectionTest = await testSmtpConnection({
      smtpHost: validatedData.smtpHost,
      smtpPort: validatedData.smtpPort,
      smtpSecure: validatedData.smtpSecure,
      smtpUser: validatedData.smtpUser,
      smtpPassword: validatedData.smtpPassword,
    })

    if (!connectionTest.success) {
      return NextResponse.json(
        { error: `SMTP connection failed: ${connectionTest.error}` },
        { status: 400 }
      )
    }

    const emailSettings = await prisma.emailSettings.create({
      data: {
        organizationId,
        ...validatedData,
      },
    })

    return NextResponse.json({
      emailSettings: {
        ...emailSettings,
        smtpPassword: '••••••••',
      },
      message: 'Email settings created successfully'
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error creating email settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/organizations/[id]/email-settings - Update email settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: organizationId } = await params
    const body = await req.json()
    const validatedData = updateEmailSettingsSchema.parse(body)

    // Check if settings exist
    const existingSettings = await prisma.emailSettings.findUnique({
      where: { organizationId },
    })

    if (!existingSettings) {
      return NextResponse.json(
        { error: 'Email settings not found. Use POST to create.' },
        { status: 404 }
      )
    }

    // If password is the masked value, don't update it
    if (validatedData.smtpPassword === '••••••••') {
      delete validatedData.smtpPassword
    }

    // If SMTP settings are being updated, test the connection
    if (validatedData.smtpHost || validatedData.smtpPort || validatedData.smtpUser || validatedData.smtpPassword) {
      const testSettings = {
        smtpHost: validatedData.smtpHost || existingSettings.smtpHost,
        smtpPort: validatedData.smtpPort || existingSettings.smtpPort,
        smtpSecure: validatedData.smtpSecure ?? existingSettings.smtpSecure,
        smtpUser: validatedData.smtpUser || existingSettings.smtpUser,
        smtpPassword: validatedData.smtpPassword || existingSettings.smtpPassword,
      }

      const connectionTest = await testSmtpConnection(testSettings)

      if (!connectionTest.success) {
        return NextResponse.json(
          { error: `SMTP connection failed: ${connectionTest.error}` },
          { status: 400 }
        )
      }
    }

    const emailSettings = await prisma.emailSettings.update({
      where: { organizationId },
      data: validatedData,
    })

    return NextResponse.json({
      emailSettings: {
        ...emailSettings,
        smtpPassword: '••••••••',
      },
      message: 'Email settings updated successfully'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error updating email settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/organizations/[id]/email-settings - Delete email settings
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: organizationId } = await params

    // Check if settings exist
    const existingSettings = await prisma.emailSettings.findUnique({
      where: { organizationId },
    })

    if (!existingSettings) {
      return NextResponse.json({ error: 'Email settings not found' }, { status: 404 })
    }

    await prisma.emailSettings.delete({
      where: { organizationId },
    })

    return NextResponse.json({ message: 'Email settings deleted successfully' })
  } catch (error) {
    console.error('Error deleting email settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
