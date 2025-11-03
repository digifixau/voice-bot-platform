'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
  description?: string
  createdAt: string
  _count: {
    users: number
    calls: number
    contacts: number
  }
}

interface User {
  id: string
  email: string
  name: string
  role: string
  organizationId?: string
  organization?: {
    id: string
    name: string
  }
  createdAt: string
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [activeTab, setActiveTab] = useState<'organizations' | 'users'>('organizations')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user.role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user.role === 'ADMIN') {
      fetchData()
    }
  }, [session, activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'organizations') {
        const res = await fetch('/api/admin/organizations')
        const data = await res.json()
        setOrganizations(data.organizations || [])
      } else {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                Voice Bot Platform
              </Link>
              <span className="ml-4 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-full">
                Admin
              </span>
            </div>
            <div className="flex items-center">
              <Link
                href="/dashboard"
                className="text-sm text-gray-700 hover:text-gray-900 mr-4"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">
              Admin Panel
            </h1>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="px-4 py-8 sm:px-0">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('organizations')}
                    className={`${
                      activeTab === 'organizations'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Organizations
                  </button>
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`${
                      activeTab === 'users'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Users
                  </button>
                </nav>
              </div>

              <div className="mt-6">
                {activeTab === 'organizations' && (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Organizations
                      </h3>
                      <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                        Add Organization
                      </button>
                    </div>
                    <ul className="divide-y divide-gray-200">
                      {organizations.map((org) => (
                        <li key={org.id}>
                          <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-indigo-600 truncate">
                                  {org.name}
                                </p>
                                {org.description && (
                                  <p className="mt-1 text-sm text-gray-500">
                                    {org.description}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center text-sm text-gray-500">
                                  <span className="mr-4">
                                    Users: {org._count.users}
                                  </span>
                                  <span className="mr-4">
                                    Contacts: {org._count.contacts}
                                  </span>
                                  <span>
                                    Calls: {org._count.calls}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <button className="text-sm text-indigo-600 hover:text-indigo-900">
                                  Edit
                                </button>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                      {organizations.length === 0 && (
                        <li className="px-4 py-8 text-center text-gray-500">
                          No organizations found
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Users
                      </h3>
                      <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                        Add User
                      </button>
                    </div>
                    <ul className="divide-y divide-gray-200">
                      {users.map((user) => (
                        <li key={user.id}>
                          <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-indigo-600 truncate">
                                  {user.name || user.email}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                  {user.email}
                                </p>
                                <div className="mt-2 flex items-center text-sm text-gray-500">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mr-2">
                                    {user.role}
                                  </span>
                                  {user.organization && (
                                    <span className="text-gray-500">
                                      {user.organization.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="ml-4">
                                <button className="text-sm text-indigo-600 hover:text-indigo-900">
                                  Edit
                                </button>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                      {users.length === 0 && (
                        <li className="px-4 py-8 text-center text-gray-500">
                          No users found
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
