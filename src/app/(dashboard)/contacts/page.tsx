'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

interface Contact {
  id: string
  name: string
  phoneNumber: string
  email?: string
  businessName?: string
  businessWebsite?: string
  notes?: string
  customFields?: Record<string, string>
  organizationId: string
  createdAt: string
  _count?: {
    calls: number
  }
}

export default function ContactsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Call functionality state
  const [showCallModal, setShowCallModal] = useState(false)
  const [callingContact, setCallingContact] = useState<Contact | null>(null)
  const [calling, setCalling] = useState(false)
  const [callConfig, setCallConfig] = useState({
    fromNumber: '+61480038722',
    agentId: 'agent_2eed1ddae212cb8f2dd1c481de'
  })
  
  // Bulk scheduling state
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')

  const [contactForm, setContactForm] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    businessName: '',
    businessWebsite: '',
    notes: '',
    customFields: [] as { key: string; value: string }[]
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchContacts()
    }
  }, [session])

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/contacts')
      const data = await res.json()
      setContacts(data.contacts || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact)
      // Convert customFields object to array for editing
      const customFieldsArray = contact.customFields
        ? Object.entries(contact.customFields).map(([key, value]) => ({ key, value }))
        : []
      setContactForm({
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        email: contact.email || '',
        businessName: contact.businessName || '',
        businessWebsite: contact.businessWebsite || '',
        notes: contact.notes || '',
        customFields: customFieldsArray
      })
    } else {
      setEditingContact(null)
      setContactForm({ 
        name: '', 
        phoneNumber: '', 
        email: '', 
        businessName: '', 
        businessWebsite: '', 
        notes: '',
        customFields: []
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = editingContact
        ? `/api/contacts/${editingContact.id}`
        : '/api/contacts'
      const method = editingContact ? 'PATCH' : 'POST'

      // Convert customFields array to object
      const customFieldsObject = contactForm.customFields.reduce((acc, field) => {
        if (field.key.trim()) {
          acc[field.key.trim()] = field.value
        }
        return acc
      }, {} as Record<string, string>)

      const payload = {
        name: contactForm.name,
        phoneNumber: contactForm.phoneNumber,
        email: contactForm.email,
        businessName: contactForm.businessName,
        businessWebsite: contactForm.businessWebsite,
        notes: contactForm.notes,
        customFields: Object.keys(customFieldsObject).length > 0 ? customFieldsObject : undefined
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        setShowModal(false)
        setEditingContact(null)
        setContactForm({ 
          name: '', 
          phoneNumber: '', 
          email: '', 
          businessName: '', 
          businessWebsite: '', 
          notes: '',
          customFields: []
        })
        fetchContacts()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to save contact'}`)
      }
    } catch (error) {
      console.error('Error saving contact:', error)
      alert('Failed to save contact')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCallNow = async () => {
    if (!callingContact) return

    setCalling(true)
    try {
      const response = await fetch('/api/retell/create-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactId: callingContact.id,
          fromNumber: callConfig.fromNumber,
          agentId: callConfig.agentId
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Call initiated successfully! Call ID: ${data.callId}`)
        setShowCallModal(false)
        setCallingContact(null)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to initiate call'}`)
      }
    } catch (error) {
      console.error('Error initiating call:', error)
      alert('Failed to initiate call')
    } finally {
      setCalling(false)
    }
  }

  const handleScheduleCalls = async () => {
    if (selectedContacts.size === 0) {
      alert('Please select at least one contact')
      return
    }

    if (scheduleMode === 'later' && !scheduleTime) {
      alert('Please select a start time')
      return
    }

    setScheduling(true)
    try {
      const response = await fetch('/api/scheduled-calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactIds: Array.from(selectedContacts),
          scheduledTime: scheduleMode === 'later' ? new Date(scheduleTime).toISOString() : new Date().toISOString(),
          fromNumber: callConfig.fromNumber,
          agentId: callConfig.agentId
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        setShowScheduleModal(false)
        setSelectedContacts(new Set())
        setScheduleTime('')
        setScheduleMode('now')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to start call queue'}`)
      }
    } catch (error) {
      console.error('Error starting call queue:', error)
      alert('Failed to start call queue')
    } finally {
      setScheduling(false)
    }
  }

  const toggleContactSelection = (contactId: string) => {
    const newSelection = new Set(selectedContacts)
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId)
    } else {
      newSelection.add(contactId)
    }
    setSelectedContacts(newSelection)
  }

  const generateCustomFields = async () => {
    // Validate that required fields are filled
    if (!contactForm.name || !contactForm.phoneNumber) {
      alert('Please fill in the name and phone number before generating custom fields')
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/contacts/generate-fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: contactForm.name,
          phoneNumber: contactForm.phoneNumber,
          email: contactForm.email || undefined,
          businessName: contactForm.businessName || undefined,
          businessWebsite: contactForm.businessWebsite || undefined,
          notes: contactForm.notes || undefined,
        })
      })

      if (response.ok) {
        const data = await response.json()
        // Convert the custom fields object to array format for the UI
        const fieldsArray = Object.entries(data.customFields).map(([key, value]) => ({
          key,
          value: String(value)
        }))
        setContactForm({
          ...contactForm,
          customFields: fieldsArray
        })
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to generate custom fields'}`)
      }
    } catch (error) {
      console.error('Error generating custom fields:', error)
      alert('Failed to generate custom fields')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchContacts()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to delete contact'}`)
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('Failed to delete contact')
    }
  }

  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase()
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.phoneNumber.includes(query) ||
      contact.email?.toLowerCase().includes(query)
    )
  })

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
                  className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Contacts
                </Link>
                <Link
                  href="/calls"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Calls
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-700 mr-4">
                {session?.user?.email}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">
              Contacts
              {selectedContacts.size > 0 && (
                <span className="ml-3 text-sm font-normal text-gray-600">
                  ({selectedContacts.size} selected)
                </span>
              )}
            </h1>
            <div className="flex gap-2">
              {selectedContacts.size > 0 && (
                <>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Start Call Queue ({selectedContacts.size})
                  </button>
                  <button
                    onClick={() => setSelectedContacts(new Set())}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Clear Selection
                  </button>
                </>
              )}
              <button
                onClick={() => openModal()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Add Contact
              </button>
            </div>
          </div>
        </header>

        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="px-4 py-8 sm:px-0">
              {/* Search Bar */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search contacts by name, phone, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Contacts List */}
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {loading ? (
                  <div className="text-center py-12 px-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-sm text-gray-500">Loading contacts...</p>
                  </div>
                ) : filteredContacts.length === 0 ? (
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
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      {searchQuery ? 'No contacts found' : 'No contacts yet'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {searchQuery
                        ? 'Try adjusting your search query.'
                        : 'Get started by adding your first contact.'}
                    </p>
                    {!searchQuery && (
                      <div className="mt-6">
                        <button
                          onClick={() => openModal()}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          Add Contact
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {filteredContacts.map((contact) => (
                      <li key={contact.id}>
                        <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                          <div className="flex items-center gap-4">
                            {/* Checkbox for bulk selection */}
                            <input
                              type="checkbox"
                              checked={selectedContacts.has(contact.id)}
                              onChange={() => toggleContactSelection(contact.id)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            
                            <div className="flex-1 flex items-center justify-between">
                              <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-indigo-600 truncate">
                                    {contact.name}
                                  </p>
                                  {contact.businessName && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {contact.businessName}
                                    </p>
                                  )}
                                </div>
                                {contact._count?.calls !== undefined && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {contact._count.calls} call{contact._count.calls !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 sm:flex sm:justify-between">
                                <div className="sm:flex sm:flex-wrap sm:gap-x-6 gap-y-2">
                                  <p className="flex items-center text-sm text-gray-500">
                                    <svg
                                      className="shrink-0 mr-1.5 h-5 w-5 text-gray-400"
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
                                    {contact.phoneNumber}
                                  </p>
                                  {contact.email && (
                                    <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                      <svg
                                        className="shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                        />
                                      </svg>
                                      {contact.email}
                                    </p>
                                  )}
                                  {contact.businessWebsite && (
                                    <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                      <svg
                                        className="shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                                        />
                                      </svg>
                                      <a 
                                        href={contact.businessWebsite} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:text-indigo-800"
                                      >
                                        {contact.businessWebsite.replace(/^https?:\/\//, '')}
                                      </a>
                                    </p>
                                  )}
                                </div>
                              </div>
                              {contact.customFields && Object.keys(contact.customFields).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {Object.entries(contact.customFields).map(([key, value]) => (
                                    <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                      {key}: {value}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {contact.notes && (
                                <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                                  {contact.notes}
                                </p>
                              )}
                            </div>
                            <div className="ml-4 flex gap-2">
                              <button
                                onClick={() => {
                                  setCallingContact(contact)
                                  setShowCallModal(true)
                                }}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                                title="Call this contact"
                              >
                                <svg className="-ml-0.5 mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                Call
                              </button>
                              <button
                                onClick={() => openModal(contact)}
                                className="text-sm text-indigo-600 hover:text-indigo-900"
                                title="Edit contact"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(contact.id)}
                                className="text-sm text-red-600 hover:text-red-900"
                                title="Delete contact"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add/Edit Contact Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-[600px] max-h-[90vh] overflow-y-auto shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  {/* Contact Information */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={contactForm.name}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, name: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                          placeholder="Enter contact name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={contactForm.phoneNumber}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, phoneNumber: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                          placeholder="+1234567890"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={contactForm.email}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, email: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                        placeholder="contact@example.com"
                      />
                    </div>
                  </div>

                  {/* Business Details */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 border-t pt-4">Business Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Business Name
                        </label>
                        <input
                          type="text"
                          value={contactForm.businessName}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, businessName: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                          placeholder="Company name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Business Website
                        </label>
                        <input
                          type="url"
                          value={contactForm.businessWebsite}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, businessWebsite: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={contactForm.notes}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, notes: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900"
                      placeholder="Add any notes about this contact..."
                      rows={3}
                    />
                  </div>
                </div>

                {/* Custom Fields */}
                <div className="border-t pt-6 mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Custom Fields
                    </h4>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={generateCustomFields}
                        disabled={generating || !contactForm.name || !contactForm.phoneNumber}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        {generating ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="-ml-1 mr-2 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Generate with AI
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setContactForm({
                            ...contactForm,
                            customFields: [...contactForm.customFields, { key: '', value: '' }]
                          })
                        }
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
                      >
                        + Add Field
                      </button>
                    </div>
                  </div>
                  {!contactForm.name || !contactForm.phoneNumber ? (
                    <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-md text-xs mb-4 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Fill in the name and phone number to enable AI generation
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    {contactForm.customFields.map((field, index) => (
                      <div key={index} className="flex gap-3 items-start group">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={field.key}
                            onChange={(e) => {
                              const newFields = [...contactForm.customFields]
                              newFields[index].key = e.target.value
                              setContactForm({ ...contactForm, customFields: newFields })
                            }}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm text-gray-900"
                            placeholder="Field name"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => {
                              const newFields = [...contactForm.customFields]
                              newFields[index].value = e.target.value
                              setContactForm({ ...contactForm, customFields: newFields })
                            }}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm text-gray-900"
                            placeholder="Value"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newFields = contactForm.customFields.filter((_, i) => i !== index)
                            setContactForm({ ...contactForm, customFields: newFields })
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Remove field"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  {contactForm.customFields.length === 0 && (
                    <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <p className="text-sm text-gray-500">No custom fields added yet</p>
                      <p className="text-xs text-gray-400 mt-1">Add fields manually or generate them with AI</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      setEditingContact(null)
                      setContactForm({ 
                        name: '', 
                        phoneNumber: '', 
                        email: '', 
                        businessName: '', 
                        businessWebsite: '', 
                        notes: '',
                        customFields: []
                      })
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
                    {submitting
                      ? editingContact
                        ? 'Updating...'
                        : 'Creating...'
                      : editingContact
                      ? 'Update Contact'
                      : 'Create Contact'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Call Now Modal */}
      {showCallModal && callingContact && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => !calling && setShowCallModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-50">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Call {callingContact.name}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Calling: {callingContact.phoneNumber}
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      From Number
                    </label>
                    <input
                      type="tel"
                      value={callConfig.fromNumber}
                      onChange={(e) => setCallConfig({ ...callConfig, fromNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="+61480038722"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Agent ID
                    </label>
                    <input
                      type="text"
                      value={callConfig.agentId}
                      onChange={(e) => setCallConfig({ ...callConfig, agentId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="agent_xxxxx"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                <button
                  onClick={handleCallNow}
                  disabled={calling}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {calling ? 'Calling...' : 'Call Now'}
                </button>
                <button
                  onClick={() => {
                    setShowCallModal(false)
                    setCallingContact(null)
                  }}
                  disabled={calling}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Calls Modal */}
      {showScheduleModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => !scheduling && setShowScheduleModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-50">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Start Call Queue for {selectedContacts.size} Contact{selectedContacts.size !== 1 ? 's' : ''}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selected Contacts:
                    </label>
                    <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-md p-2">
                      {contacts
                        .filter(c => selectedContacts.has(c.id))
                        .map(c => (
                          <div key={c.id} className="text-sm text-gray-600 py-1">
                            {c.name} - {c.phoneNumber}
                          </div>
                        ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <div className="flex gap-4 mb-3">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="radio"
                          className="form-radio text-indigo-600"
                          name="scheduleMode"
                          value="now"
                          checked={scheduleMode === 'now'}
                          onChange={() => setScheduleMode('now')}
                        />
                        <span className="ml-2 text-sm text-gray-700">Start Immediately</span>
                      </label>
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="radio"
                          className="form-radio text-indigo-600"
                          name="scheduleMode"
                          value="later"
                          checked={scheduleMode === 'later'}
                          onChange={() => setScheduleMode('later')}
                        />
                        <span className="ml-2 text-sm text-gray-700">Schedule for Later</span>
                      </label>
                    </div>
                    
                    {scheduleMode === 'later' && (
                      <input
                        type="datetime-local"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        min={new Date().toLocaleString('sv').slice(0, 16)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 mb-2"
                      />
                    )}
                    
                    <p className="text-xs text-gray-500 mt-1">
                      {scheduleMode === 'now' 
                        ? 'Calls will be placed sequentially with 2-minute intervals starting immediately.'
                        : 'Calls will be placed sequentially with 2-minute intervals starting from the selected time.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      From Number
                    </label>
                    <input
                      type="tel"
                      value={callConfig.fromNumber}
                      onChange={(e) => setCallConfig({ ...callConfig, fromNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="+61480038722"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Agent ID
                    </label>
                    <input
                      type="text"
                      value={callConfig.agentId}
                      onChange={(e) => setCallConfig({ ...callConfig, agentId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="agent_xxxxx"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                <button
                  onClick={handleScheduleCalls}
                  disabled={scheduling}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {scheduling ? 'Starting...' : 'Start Call Queue'}
                </button>
                <button
                  onClick={() => {
                    setShowScheduleModal(false)
                    setScheduleTime('')
                  }}
                  disabled={scheduling}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
