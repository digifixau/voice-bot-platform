'use client'

import { use, useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Contact {
  id: string
  name: string
  phoneNumber: string
  email: string | null
}

interface Agent {
  id: string
  name: string
  retellAgentId: string
}

interface CallSummary {
  id: string
  summary: string | null
  sentiment: string | null
  transcript: string | null
  keyPoints: string[]
  actionItems: string[]
  metadata: any
  createdAt: string
}

interface CallRecording {
  id: string
  duration: number | null
  cloudflareR2Url: string | null
  recordingUrl: string | null
  format: string | null
}

interface Call {
  id: string
  status: string
  duration: number | null
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  retellCallId: string | null
  callType: string | null
  disconnectionReason: string | null
  contact: Contact | null
  agent: Agent | null
  summary: CallSummary | null
  recording: CallRecording | null
}

export default function CallDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [call, setCall] = useState<Call | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    fetchCallDetails()
  }, [resolvedParams.id])

  const fetchCallDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/calls/${resolvedParams.id}`)
      if (response.ok) {
        const data = await response.json()
        setCall(data.call)
      } else {
        router.push('/calls')
      }
    } catch (error) {
      console.error('Error fetching call details:', error)
    } finally {
      setLoading(false)
    }
  }

  const syncCall = async () => {
    if (!call?.retellCallId) return
    
    try {
      setSyncing(true)
      const response = await fetch(`/api/calls/${resolvedParams.id}/sync`, {
        method: 'POST'
      })
      if (response.ok) {
        await fetchCallDetails()
      }
    } catch (error) {
      console.error('Error syncing call:', error)
    } finally {
      setSyncing(false)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      FAILED: 'bg-red-100 text-red-800',
      INITIATED: 'bg-yellow-100 text-yellow-800',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null
    const styles: Record<string, string> = {
      Positive: 'bg-green-50 text-green-700 border-2 border-green-200',
      Negative: 'bg-red-50 text-red-700 border-2 border-red-200',
      Neutral: 'bg-gray-50 text-gray-700 border-2 border-gray-200',
    }
    return (
      <span className={`px-3 py-1 rounded-lg text-sm font-medium ${styles[sentiment] || 'bg-gray-50 text-gray-700'}`}>
        😊 {sentiment}
      </span>
    )
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <div className="text-gray-600">Loading call details...</div>
        </div>
      </div>
    )
  }

  if (!call) {
    return (
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                  Voice Bot Platform
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <div className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Call not found</h1>
            <Link href="/calls" className="mt-4 inline-block text-indigo-600 hover:text-indigo-900">
              ← Back to Calls
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="shrink-0 flex items-center">
                <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                  Voice Bot Platform
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/contacts"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Contacts
                </Link>
                <Link
                  href="/calls"
                  className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Calls
                </Link>
                <Link
                  href="/reports"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Reports
                </Link>
                {session?.user.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Admin
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <div className="shrink-0">
                <span className="text-sm text-gray-700 mr-4">
                  {session?.user.name || session?.user.email}
                  {session?.user.organizationName && (
                    <span className="text-gray-500"> - {session.user.organizationName}</span>
                  )}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-4">
              <Link href="/calls" className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                ← Back to Calls
              </Link>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold leading-tight text-gray-900">Call Details</h1>
                {call.contact && (
                  <p className="mt-2 text-sm text-gray-600">
                    Call with {call.contact.name} ({call.contact.phoneNumber})
                  </p>
                )}
                {call.agent && !call.contact && (
                  <p className="mt-2 text-sm text-gray-600">
                    {call.callType === 'inbound' ? 'Inbound call to' : 'Call handled by'} {call.agent.name}
                  </p>
                )}
              </div>
              {call.retellCallId && (
                <button
                  onClick={syncCall}
                  disabled={syncing}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncing ? 'Syncing...' : 'Sync from Retell AI'}
                </button>
              )}
            </div>
          </div>
        </header>

        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="px-4 py-8 sm:px-0">
              {/* Call Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-sm font-medium text-gray-500 mb-1">Status</div>
                  <div>{getStatusBadge(call.status)}</div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-sm font-medium text-gray-500 mb-1">Duration</div>
                  <div className="text-2xl font-bold text-gray-900">{formatDuration(call.duration)}</div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-sm font-medium text-gray-500 mb-1">Sentiment</div>
                  <div>{call.summary?.sentiment ? getSentimentBadge(call.summary.sentiment) : 'N/A'}</div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-sm font-medium text-gray-500 mb-1">Call Type</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {call.callType === 'inbound' ? '📞 Inbound' : 
                     call.callType === 'outbound' ? '📤 Outbound' : 
                     call.contact ? '📤 Outbound' : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white p-6 rounded-lg shadow mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Timeline</h2>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="shrink-0 w-32 text-sm text-gray-500">Created</div>
                    <div className="text-sm text-gray-900">{formatDate(call.createdAt)}</div>
                  </div>
                  {call.startedAt && (
                    <div className="flex items-start">
                      <div className="shrink-0 w-32 text-sm text-gray-500">Started</div>
                      <div className="text-sm text-gray-900">{formatDate(call.startedAt)}</div>
                    </div>
                  )}
                  {call.endedAt && (
                    <div className="flex items-start">
                      <div className="shrink-0 w-32 text-sm text-gray-500">Ended</div>
                      <div className="text-sm text-gray-900">{formatDate(call.endedAt)}</div>
                    </div>
                  )}
                  {call.disconnectionReason && (
                    <div className="flex items-start">
                      <div className="shrink-0 w-32 text-sm text-gray-500">Disconnection</div>
                      <div className="text-sm text-gray-900">{call.disconnectionReason.replace('_', ' ')}</div>
                    </div>
                  )}
                  {call.retellCallId && (
                    <div className="flex items-start">
                      <div className="shrink-0 w-32 text-sm text-gray-500">Retell Call ID</div>
                      <div className="text-sm text-gray-900 font-mono">{call.retellCallId}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Call Recording */}
              {call.recording && (call.recording.recordingUrl || call.recording.cloudflareR2Url) && (
                <div className="bg-white p-6 rounded-lg shadow mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">📼 Call Recording</h2>
                  <audio
                    controls
                    className="w-full"
                    src={call.recording.cloudflareR2Url || call.recording.recordingUrl || ''}
                  >
                    Your browser does not support the audio element.
                  </audio>
                  <div className="mt-4 flex gap-4 text-sm text-gray-600">
                    <span>Duration: {formatDuration(call.recording.duration)}</span>
                    <span>Format: {call.recording.format?.toUpperCase() || 'MP3'}</span>
                  </div>
                </div>
              )}

              {/* Call Summary */}
              {call.summary && (
                <div className="bg-white p-6 rounded-lg shadow mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">📝 Call Summary</h2>
                  {call.summary.summary ? (
                    <p className="text-gray-700 leading-relaxed mb-4">{call.summary.summary}</p>
                  ) : (
                    <p className="text-gray-500 italic">No summary available</p>
                  )}

                  {/* Key Points */}
                  {call.summary.keyPoints && call.summary.keyPoints.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Points</h3>
                      <ul className="list-disc list-inside space-y-2">
                        {call.summary.keyPoints.map((point, index) => (
                          <li key={index} className="text-gray-700">{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Items */}
                  {call.summary.actionItems && call.summary.actionItems.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Action Items</h3>
                      <ul className="space-y-2">
                        {call.summary.actionItems.map((item, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-indigo-600 mr-2">✓</span>
                            <span className="text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Transcript */}
              {call.summary?.transcript && (
                <div className="bg-white p-6 rounded-lg shadow mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">💬 Transcript</h2>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                      {call.summary.transcript}
                    </pre>
                  </div>
                </div>
              )}

              {/* Metadata */}
              {call.summary?.metadata && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">🔍 Analysis Metadata</h2>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
                    <pre className="text-xs text-gray-700 font-mono">
                      {JSON.stringify(call.summary.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* No Data State */}
              {!call.summary && !call.recording && (
                <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg text-center">
                  <p className="text-yellow-800">
                    No summary or recording available yet. 
                    {call.retellCallId && (
                      <span> Try syncing from Retell AI using the button above.</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
