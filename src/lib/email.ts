import nodemailer from 'nodemailer'
import { prisma } from './prisma'
import { console } from 'inspector/promises'

interface CallEmailData {
  callId: string
  retellCallId: string
  direction: string
  status: string
  duration: number
  fromNumber?: string
  toNumber?: string
  clientPhoneNumber?: string
  contactName?: string
  agentName?: string
  transcript?: string
  summary?: string
  sentiment?: string
  recordingUrl?: string
  startedAt?: Date
  endedAt?: Date
}

interface SendEmailOptions {
  to: string[]
  subject: string
  html: string
  text?: string
}

/**
 * Create a nodemailer transporter with the organization's SMTP settings
 */
function createTransporter(settings: {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPassword: string
}) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPassword,
    },
  })
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`
  }
  return `${minutes}m ${remainingSeconds}s`
}

/**
 * Generate the HTML email template for a call notification
 */
function generateCallEmailHtml(data: CallEmailData, orgName: string): string {
  const directionLabel = data.direction === 'inbound' ? '📞 Inbound Call' : '📱 Outbound Call'
  const statusColor = data.status === 'COMPLETED' ? '#22c55e' : data.status === 'FAILED' ? '#ef4444' : '#f59e0b'
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Call Notification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${directionLabel}</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${orgName}</p>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #333;">Call Details</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 140px;">Status:</td>
          <td style="padding: 8px 0;">
            <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px;">${data.status}</span>
          </td>
        </tr>
        ${data.contactName ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">Contact:</td>
          <td style="padding: 8px 0; font-weight: 500;">${data.contactName}</td>
        </tr>
        ` : ''}
        ${data.clientPhoneNumber ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">Client Phone:</td>
          <td style="padding: 8px 0;">${data.clientPhoneNumber}</td>
        </tr>
        ` : ''}
        ${data.fromNumber ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">From:</td>
          <td style="padding: 8px 0;">${data.fromNumber}</td>
        </tr>
        ` : ''}
        ${data.toNumber ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">To:</td>
          <td style="padding: 8px 0;">${data.toNumber}</td>
        </tr>
        ` : ''}
        ${data.agentName ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">Agent:</td>
          <td style="padding: 8px 0;">${data.agentName}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: #666;">Duration:</td>
          <td style="padding: 8px 0;">${formatDuration(data.duration)}</td>
        </tr>
        ${data.startedAt ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">Started:</td>
          <td style="padding: 8px 0;">${new Date(data.startedAt).toLocaleString()}</td>
        </tr>
        ` : ''}
        ${data.sentiment ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">Sentiment:</td>
          <td style="padding: 8px 0; text-transform: capitalize;">${data.sentiment}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    ${data.summary ? `
    <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #333;">📋 Summary</h2>
      <p style="margin: 0; color: #555;">${data.summary}</p>
    </div>
    ` : ''}

    ${data.transcript ? `
    <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #333;">📝 Transcript</h2>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; max-height: 300px; overflow-y: auto; font-size: 14px; white-space: pre-wrap; color: #555;">
${data.transcript}
      </div>
    </div>
    ` : ''}

    ${data.recordingUrl ? `
    <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #333;">🎙️ Recording</h2>
      <a href="${data.recordingUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Listen to Recording</a>
    </div>
    ` : ''}
  </div>

  <div style="background: #333; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="margin: 0; color: #999; font-size: 12px;">
      This is an automated notification from your Voice Bot Platform.<br>
      Call ID: ${data.retellCallId}
    </p>
  </div>
</body>
</html>
`
}

/**
 * Generate plain text version of the email
 */
function generateCallEmailText(data: CallEmailData, orgName: string): string {
  const lines = [
    `${data.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call Notification - ${orgName}`,
    '='.repeat(50),
    '',
    'Call Details:',
    `- Status: ${data.status}`,
    data.contactName ? `- Contact: ${data.contactName}` : null,
    data.clientPhoneNumber ? `- Client Phone: ${data.clientPhoneNumber}` : null,
    data.fromNumber ? `- From: ${data.fromNumber}` : null,
    data.toNumber ? `- To: ${data.toNumber}` : null,
    data.agentName ? `- Agent: ${data.agentName}` : null,
    `- Duration: ${formatDuration(data.duration)}`,
    data.startedAt ? `- Started: ${new Date(data.startedAt).toLocaleString()}` : null,
    data.sentiment ? `- Sentiment: ${data.sentiment}` : null,
    '',
  ].filter(Boolean)

  if (data.summary) {
    lines.push('Summary:', data.summary, '')
  }

  if (data.transcript) {
    lines.push('Transcript:', data.transcript, '')
  }

  if (data.recordingUrl) {
    lines.push('Recording URL:', data.recordingUrl, '')
  }

  lines.push('-'.repeat(50))
  lines.push(`Call ID: ${data.retellCallId}`)

  return lines.join('\n')
}

/**
 * Send email notification for a completed call
 */
export async function sendCallNotificationEmail(
  organizationId: string,
  callData: CallEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch email settings for the organization
    console.log(`Fetching email settings for organization ${organizationId}`)
    const emailSettings = await prisma.emailSettings.findUnique({
      where: { organizationId },
      include: {
        organization: {
          select: { name: true }
        }
      }
    })

    console.log('Email settings:', emailSettings)

    if (!emailSettings) {
      console.log(`No email settings configured for organization ${organizationId}`)
      return { success: false, error: 'No email settings configured' }
    }

    if (!emailSettings.isEnabled) {
      console.log(`Email notifications disabled for organization ${organizationId}`)
      return { success: false, error: 'Email notifications disabled' }
    }

    // Check if we should send based on notification trigger settings
    const direction = callData.direction?.toLowerCase()
    const trigger = emailSettings.notificationTrigger

    if (trigger === 'INBOUND_ONLY' && direction !== 'inbound') {
      console.log(`Skipping email - trigger is INBOUND_ONLY but call is ${direction}`)
      return { success: false, error: 'Call type does not match notification trigger' }
    }

    if (trigger === 'OUTBOUND_ONLY' && direction !== 'outbound') {
      console.log(`Skipping email - trigger is OUTBOUND_ONLY but call is ${direction}`)
      return { success: false, error: 'Call type does not match notification trigger' }
    }

    if (emailSettings.toEmails.length === 0) {
      console.log(`No recipient emails configured for organization ${organizationId}`)
      return { success: false, error: 'No recipient emails configured' }
    }

    // Create transporter
    const transporter = createTransporter({
      smtpHost: emailSettings.smtpHost,
      smtpPort: emailSettings.smtpPort,
      smtpSecure: emailSettings.smtpSecure,
      smtpUser: emailSettings.smtpUser,
      smtpPassword: emailSettings.smtpPassword,
    })

    const orgName = emailSettings.organization.name
    const directionLabel = direction === 'inbound' ? 'Inbound' : 'Outbound'
    const subject = `${directionLabel} Call ${callData.status} - ${callData.contactName || callData.clientPhoneNumber || 'Unknown'}`

    // Send email
    const result = await transporter.sendMail({
      from: emailSettings.fromName 
        ? `"${emailSettings.fromName}" <${emailSettings.fromEmail}>`
        : emailSettings.fromEmail,
      to: emailSettings.toEmails.join(', '),
      subject,
      text: generateCallEmailText(callData, orgName),
      html: generateCallEmailHtml(callData, orgName),
    })

    console.log(`Email sent successfully for call ${callData.callId}:`, result.messageId)
    return { success: true }
  } catch (error) {
    console.error('Error sending call notification email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Test SMTP connection with the provided settings
 */
export async function testSmtpConnection(settings: {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPassword: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter(settings)
    await transporter.verify()
    return { success: true }
  } catch (error) {
    console.error('SMTP connection test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send a test email to verify configuration
 */
export async function sendTestEmail(
  settings: {
    smtpHost: string
    smtpPort: number
    smtpSecure: boolean
    smtpUser: string
    smtpPassword: string
    fromEmail: string
    fromName?: string
  },
  toEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter(settings)

    await transporter.sendMail({
      from: settings.fromName 
        ? `"${settings.fromName}" <${settings.fromEmail}>`
        : settings.fromEmail,
      to: toEmail,
      subject: 'Voice Bot Platform - Test Email',
      text: 'This is a test email from your Voice Bot Platform. If you received this email, your SMTP settings are configured correctly.',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #667eea; margin-top: 0;">✅ Test Email Successful</h1>
    <p>This is a test email from your Voice Bot Platform.</p>
    <p>If you received this email, your SMTP settings are configured correctly!</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="color: #666; font-size: 12px;">Sent from Voice Bot Platform</p>
  </div>
</body>
</html>
      `,
    })

    return { success: true }
  } catch (error) {
    console.error('Test email failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
