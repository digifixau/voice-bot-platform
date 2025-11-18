'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Contact {
  id: string
  name: string
  phoneNumber: string
}

interface Agent {
  id: string
  name: string
}

interface CallSummary {
  id: string
  summary: string | null
  sentiment: string | null
  transcript: string | null
}

interface CallRecording {
  id: string
  duration: number | null
  cloudflareR2Url: string | null
  recordingUrl: string | null
}

interface Call {
  id: string
  status: string
  duration: number | null
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  contact: Contact | null
  agent: Agent | null
  summary: CallSummary | null
  recording: CallRecording | null
  callType: string | null
  fromNumber: string | null
  toNumber: string | null
  direction: string | null
  clientPhoneNumber: string | null
}

export default function CallsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchCalls = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })
      
      if (filter !== 'all') {
        params.append('status', filter)
      }

      // Add date filtering
      if (dateFilter !== 'all') {
        const now = new Date()
        let startDate: Date | null = null

        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'yesterday':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
            const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            params.append('startDate', startDate.toISOString())
            params.append('endDate', endDate.toISOString())
            break
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
        }

        if (startDate && dateFilter !== 'yesterday') {
          params.append('startDate', startDate.toISOString())
        }
      }

      console.log('Fetching calls with params:', params.toString())
      const response = await fetch(`/api/calls?${params}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched calls:', data.calls)
        setCalls(data.calls)
        setTotalPages(data.pagination.pages)
      } else {
        console.error('Failed to fetch calls:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching calls:', error)
    } finally {
      setLoading(false)
    }
  }, [filter, dateFilter, page])

  useEffect(() => {
    if (status === 'authenticated') {
      console.log('useEffect triggered - fetchCalls called')
      fetchCalls()
    }
  }, [status, fetchCalls])

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null
    const styles: Record<string, string> = {
      Positive: 'bg-green-50 text-green-700 border border-green-200',
      Negative: 'bg-red-50 text-red-700 border border-red-200',
      Neutral: 'bg-gray-50 text-gray-700 border border-gray-200',
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[sentiment] || 'bg-gray-50 text-gray-700'}`}>
        {sentiment}
      </span>
    )
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <div className="text-gray-600">Loading...</div>
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

      {/* Page Header */}
      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">Call History</h1>
            <p className="mt-2 text-sm text-gray-600">View and manage all your call records</p>
          </div>
        </header>

        {/* Main Content */}
        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="px-4 py-8 sm:px-0">
              {/* Filters */}
              <div className="mb-6 space-y-4">
                {/* Status Filters */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Call Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {['all', 'COMPLETED', 'FAILED'].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setFilter(status)
                          setPage(1)
                        }}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                          filter === status
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        {status === 'all' ? 'All Calls' : status.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Filters */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: 'all', label: 'All Time' },
                      { value: 'today', label: 'Today' },
                      { value: 'yesterday', label: 'Yesterday' },
                      { value: 'week', label: 'Last 7 Days' },
                      { value: 'month', label: 'This Month' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setDateFilter(option.value)
                          setPage(1)
                        }}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                          dateFilter === option.value
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active Filters Summary */}
              {(filter !== 'all' || dateFilter !== 'all') && (
                <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">Active filters:</span>
                  {filter !== 'all' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      Status: {filter}
                    </span>
                  )}
                  {dateFilter !== 'all' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      Date: {dateFilter === 'today' ? 'Today' : dateFilter === 'yesterday' ? 'Yesterday' : dateFilter === 'week' ? 'Last 7 Days' : 'This Month'}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setFilter('all')
                      setDateFilter('all')
                      setPage(1)
                    }}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Calls Table */}
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {loading ? (
                  <div className="text-center py-12 px-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-sm text-gray-500">Loading calls...</p>
                  </div>
                ) : calls.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No calls found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {filter === 'all' ? 'Start by initiating a call from your contacts.' : `No ${filter.toLowerCase().replace('_', ' ')} calls.`}
                    </p>
                    <div className="mt-6">
                      <Link
                        href="/contacts"
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Go to Contacts
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contact / Agent
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone / Direction
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sentiment
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Duration
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Summary
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {calls.map((call) => (
                          <tr key={call.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                {call.contact ? (
                                  <>
                                    <div className="text-sm font-medium text-gray-900">
                                      {call.contact.name}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {call.contact.phoneNumber}
                                    </div>
                                  </>
                                ) : call.agent ? (
                                  <>
                                    <div className="text-sm font-medium text-gray-900">
                                      {call.agent.name}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {call.clientPhoneNumber || 'Unknown'}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-sm text-gray-500">Unknown</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <div className="text-sm text-gray-900">
                                  {call.clientPhoneNumber || 'N/A'}
                                </div>
                                {call.direction && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    call.direction === 'inbound' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {call.direction === 'inbound' ? '← Inbound' : '→ Outbound'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(call.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getSentimentBadge(call.summary?.sentiment || null)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDuration(call.duration)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(call.startedAt || call.createdAt)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 max-w-xs truncate">
                                {call.summary?.summary || 'No summary available'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <Link
                                href={`/calls/${call.id}`}
                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                              >
                                View Details
                              </Link>
                              {call.recording && (
                                <span className="text-green-600">
                                  <svg
                                    className="inline-block w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                                  </svg>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
