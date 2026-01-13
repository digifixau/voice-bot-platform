'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
  description?: string
  customFieldDefinitions?: any[]
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

interface Agent {
  id: string
  retellAgentId: string
  name: string
  organizationId: string
  organization: {
    id: string
    name: string
  }
  _count?: {
    calls: number
  }
  createdAt: string
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [activeTab, setActiveTab] = useState<'organizations' | 'users' | 'agents'>('organizations')
  const [loading, setLoading] = useState(true)
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [submitting, setSubmitting] = useState(false)
  
  // Organization form state
  const [orgForm, setOrgForm] = useState({
    name: '',
    description: '',
    customFieldDefinitions: [] as { key: string; label: string; description: string }[]
  })
  
  // User form state
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ORG_USER',
    organizationId: ''
  })

  // Agent form state
  const [agentForm, setAgentForm] = useState({
    retellAgentId: '',
    name: '',
    organizationId: ''
  })

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
      // Always fetch organizations for dropdown menus
      const orgRes = await fetch('/api/admin/organizations')
      const orgData = await orgRes.json()
      setOrganizations(orgData.organizations || [])

      // Fetch additional data based on active tab
      if (activeTab === 'users') {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        setUsers(data.users || [])
      } else if (activeTab === 'agents') {
        const res = await fetch('/api/agents')
        const data = await res.json()
        setAgents(data.agents || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgForm)
      })
      
      if (response.ok) {
        setShowOrgModal(false)
        setOrgForm({ name: '', description: '', customFieldDefinitions: [] })
        fetchData()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to create organization'}`)
      }
    } catch (error) {
      console.error('Error creating organization:', error)
      alert('Failed to create organization')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      })
      
      if (response.ok) {
        setShowUserModal(false)
        setUserForm({ name: '', email: '', password: '', role: 'ORG_USER', organizationId: '' })
        fetchData()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to create user'}`)
      }
    } catch (error) {
      console.error('Error creating user:', error)
      alert('Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentForm)
      })
      
      if (response.ok) {
        setShowAgentModal(false)
        setEditingAgent(null)
        setAgentForm({ retellAgentId: '', name: '', organizationId: '' })
        fetchData()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to create agent'}`)
      }
    } catch (error) {
      console.error('Error creating agent:', error)
      alert('Failed to create agent')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAgent) return
    
    setSubmitting(true)
    try {
      const response = await fetch(`/api/agents/${editingAgent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentForm)
      })
      
      if (response.ok) {
        setShowAgentModal(false)
        setEditingAgent(null)
        setAgentForm({ retellAgentId: '', name: '', organizationId: '' })
        fetchData()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to update agent'}`)
      }
    } catch (error) {
      console.error('Error updating agent:', error)
      alert('Failed to update agent')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrg) return
    
    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/organizations/${editingOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgForm)
      })
      
      if (response.ok) {
        setShowOrgModal(false)
        setEditingOrg(null)
        setOrgForm({ name: '', description: '', customFieldDefinitions: [] })
        fetchData()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to update organization'}`)
      }
    } catch (error) {
      console.error('Error updating organization:', error)
      alert('Failed to update organization')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchData()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to delete agent'}`)
      }
    } catch (error) {
      console.error('Error deleting agent:', error)
      alert('Failed to delete agent')
    }
  }

  const handleResetPassword = async (userId: string, userEmail: string) => {
    const newPassword = prompt(`Enter new password for ${userEmail}:`)
    if (!newPassword) {
      return
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long')
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      })

      if (response.ok) {
        alert('Password reset successfully')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to reset password'}`)
      }
    } catch (error) {
      console.error('Error resetting password:', error)
      alert('Failed to reset password')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchData()
        alert('User deleted successfully')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to delete user'}`)
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    }
  }

  const openAgentModal = (agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent)
      setAgentForm({
        retellAgentId: agent.retellAgentId,
        name: agent.name,
        organizationId: agent.organizationId
      })
    } else {
      setEditingAgent(null)
      setAgentForm({ retellAgentId: '', name: '', organizationId: '' })
    }
    setShowAgentModal(true)
  }

  const openOrgModal = (org?: Organization) => {
    if (org) {
      setEditingOrg(org)
      setOrgForm({
        name: org.name,
        description: org.description || '',
        customFieldDefinitions: (org.customFieldDefinitions as any[]) || []
      })
    } else {
      setEditingOrg(null)
      setOrgForm({ name: '', description: '', customFieldDefinitions: [] })
    }
    setShowOrgModal(true)
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
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                  <span className="text-gray-600">Loading data...</span>
                </div>
              ) : (
                <>
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
                  <button
                    onClick={() => setActiveTab('agents')}
                    className={`${
                      activeTab === 'agents'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Agents
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
                      <button 
                        onClick={() => openOrgModal()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                      >
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
                                <button 
                                  onClick={() => openOrgModal(org)}
                                  className="text-sm text-indigo-600 hover:text-indigo-900"
                                >
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
                      <button 
                        onClick={() => setShowUserModal(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                      >
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
                              <div className="ml-4 flex gap-2">
                                <button 
                                  onClick={() => handleResetPassword(user.id, user.email)}
                                  className="text-sm text-yellow-600 hover:text-yellow-900"
                                  title="Reset user password"
                                >
                                  Reset Password
                                </button>
                                {user.id !== session?.user.id && user.role !== 'ADMIN' && (
                                  <button 
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="text-sm text-red-600 hover:text-red-900"
                                    title="Delete user"
                                  >
                                    Delete
                                  </button>
                                )}
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

                {activeTab === 'agents' && (
                  <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Agents
                      </h3>
                      <button 
                        onClick={() => openAgentModal()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Add Agent
                      </button>
                    </div>
                    <ul className="divide-y divide-gray-200">
                      {agents.map((agent) => (
                        <li key={agent.id}>
                          <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-indigo-600 truncate">
                                  {agent.name}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                  Retell Agent ID: {agent.retellAgentId}
                                </p>
                                <div className="mt-2 flex items-center text-sm text-gray-500">
                                  <span className="text-gray-500 mr-4">
                                    Organization: {agent.organization.name}
                                  </span>
                                  {agent._count?.calls !== undefined && (
                                    <span className="text-gray-500">
                                      Calls: {agent._count.calls}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="ml-4 flex gap-2">
                                <button 
                                  onClick={() => openAgentModal(agent)}
                                  className="text-sm text-indigo-600 hover:text-indigo-900"
                                >
                                  Edit
                                </button>
                                <button 
                                  onClick={() => handleDeleteAgent(agent.id)}
                                  className="text-sm text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                      {agents.length === 0 && (
                        <li className="px-4 py-8 text-center text-gray-500">
                          No agents found
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Add/Edit Organization Modal */}
      {showOrgModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                {editingOrg ? 'Edit Organization' : 'Add New Organization'}
              </h3>
              <form onSubmit={editingOrg ? handleEditOrganization : handleCreateOrganization}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={orgForm.name}
                    onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                    placeholder="Enter organization name"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={orgForm.description}
                    onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                    placeholder="Enter description (optional)"
                    rows={3}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Field Definitions
                  </label>
                  <div className="space-y-3">
                    {orgForm.customFieldDefinitions.map((field, index) => (
                      <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-md">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            placeholder="Key (e.g. first_offer)"
                            value={field.key}
                            onChange={(e) => {
                              const newFields = [...orgForm.customFieldDefinitions]
                              newFields[index].key = e.target.value
                              setOrgForm({ ...orgForm, customFieldDefinitions: newFields })
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900"
                          />
                          <input
                            type="text"
                            placeholder="Label (e.g. First Offer)"
                            value={field.label}
                            onChange={(e) => {
                              const newFields = [...orgForm.customFieldDefinitions]
                              newFields[index].label = e.target.value
                              setOrgForm({ ...orgForm, customFieldDefinitions: newFields })
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900"
                          />
                          <input
                            type="text"
                            placeholder="Description (optional)"
                            value={field.description}
                            onChange={(e) => {
                              const newFields = [...orgForm.customFieldDefinitions]
                              newFields[index].description = e.target.value
                              setOrgForm({ ...orgForm, customFieldDefinitions: newFields })
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newFields = orgForm.customFieldDefinitions.filter((_, i) => i !== index)
                            setOrgForm({ ...orgForm, customFieldDefinitions: newFields })
                          }}
                          className="text-red-600 hover:text-red-800 text-sm px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setOrgForm({
                          ...orgForm,
                          customFieldDefinitions: [
                            ...orgForm.customFieldDefinitions,
                            { key: '', label: '', description: '' }
                          ]
                        })
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      + Add Custom Field
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOrgModal(false)
                      setOrgForm({ name: '', description: '', customFieldDefinitions: [] })
                      setEditingOrg(null)
                    }}
                    className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (editingOrg ? 'Updating...' : 'Creating...') : (editingOrg ? 'Update Organization' : 'Create Organization')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Add New User
              </h3>
              <form onSubmit={handleCreateUser}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                    placeholder="Enter full name"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                    placeholder="Enter email address"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                    placeholder="Enter password"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role *
                  </label>
                  <select
                    required
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                  >
                    <option value="ORG_USER">Organization User</option>
                    <option value="ORG_ADMIN">Organization Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                {userForm.role !== 'SUPER_ADMIN' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization *
                    </label>
                    <select
                      required
                      value={userForm.organizationId}
                      onChange={(e) => setUserForm({ ...userForm, organizationId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                    >
                      <option value="">Select an organization</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserModal(false)
                      setUserForm({ name: '', email: '', password: '', role: 'ORG_USER', organizationId: '' })
                    }}
                    className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Agent Modal */}
      {showAgentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                {editingAgent ? 'Edit Agent' : 'Add New Agent'}
              </h3>
              <form onSubmit={editingAgent ? handleEditAgent : handleCreateAgent}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Retell Agent ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={agentForm.retellAgentId}
                    onChange={(e) => setAgentForm({ ...agentForm, retellAgentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                    placeholder="Enter Retell AI agent ID"
                    disabled={!!editingAgent}
                  />
                  {editingAgent && (
                    <p className="mt-1 text-xs text-gray-500">
                      Agent ID cannot be changed after creation
                    </p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agent Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={agentForm.name}
                    onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                    placeholder="Enter agent name"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization *
                  </label>
                  <select
                    required
                    value={agentForm.organizationId}
                    onChange={(e) => setAgentForm({ ...agentForm, organizationId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                  >
                    <option value="">Select an organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAgentModal(false)
                      setEditingAgent(null)
                      setAgentForm({ retellAgentId: '', name: '', organizationId: '' })
                    }}
                    className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (editingAgent ? 'Updating...' : 'Creating...') : (editingAgent ? 'Update Agent' : 'Create Agent')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
