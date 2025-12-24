'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Sede {
  id: string
  nombre: string
  codigo: string
}

interface User {
  id: string
  name: string
  email: string
  username: string | null
  role: string
  sedeId: string | null
  sede: Sede | null
  active: boolean
  createdAt: string
  _count: {
    invoices: number
  }
}

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', username: '', password: '', role: 'USER_L1', sedeId: '' })
  const [creating, setCreating] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [updating, setUpdating] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados para selección masiva
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkAction, setBulkAction] = useState<'CHANGE_ROLE' | 'CHANGE_SEDE' | 'DELETE' | null>(null)
  const [bulkActionRole, setBulkActionRole] = useState('USER_L1')
  const [bulkActionSedeId, setBulkActionSedeId] = useState<string>('')
  const [processingBulkAction, setProcessingBulkAction] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      if (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
        router.push('/')
      } else {
        loadUsers()
        loadSedes()
      }
    }
  }, [status, router, session])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setUsers(data.users || [])
      setSelectedUsers(new Set()) // Limpiar selección
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSedes = async () => {
    try {
      const response = await fetch('/api/sedes')
      const data = await response.json()
      setSedes(data.sedes || [])
    } catch (error) {
      console.error('Error loading sedes:', error)
    }
  }

  // Funciones de selección
  const toggleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedUsers.size === selectableUsers.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(selectableUsers.map(u => u.id)))
    }
  }

  // Usuarios que se pueden seleccionar (no incluye al usuario actual)
  const selectableUsers = users.filter(u => u.id !== session?.user?.id)

  const handleBulkAction = async () => {
    if (!bulkAction || selectedUsers.size === 0) return

    setProcessingBulkAction(true)

    try {
      const response = await fetch('/api/users/bulk-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
          action: bulkAction,
          role: bulkAction === 'CHANGE_ROLE' ? bulkActionRole : undefined,
          sedeId: bulkAction === 'CHANGE_SEDE' ? (bulkActionSedeId || null) : undefined,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        alert(result.message)
        setShowBulkActionModal(false)
        setBulkAction(null)
        setSelectedUsers(new Set())
        await loadUsers()
      } else {
        alert(result.error || 'Error al realizar la acción')
      }
    } catch (error) {
      console.error('Error bulk action:', error)
      alert('Error al realizar la acción')
    } finally {
      setProcessingBulkAction(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newUser,
          sedeId: newUser.sedeId || null,
        }),
      })

      if (response.ok) {
        setShowCreateModal(false)
        setNewUser({ name: '', email: '', username: '', password: '', role: 'USER_L1', sedeId: '' })
        await loadUsers()
      } else {
        const error = await response.json()
        alert(error.error || 'Error al crear usuario')
      }
    } catch (error) {
      console.error('Error creating user:', error)
      alert('Error al crear usuario')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setUpdating(true)

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingUser.name,
          email: editingUser.email,
          username: editingUser.username || null,
          role: editingUser.role,
          sedeId: editingUser.sedeId || null,
          active: editingUser.active ?? true,
        }),
      })

      if (response.ok) {
        setShowEditModal(false)
        setEditingUser(null)
        await loadUsers()
      } else {
        const error = await response.json()
        alert(error.error || 'Error al actualizar usuario')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Error al actualizar usuario')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario ${name}?`)) return

    try {
      const response = await fetch(`/api/users?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadUsers()
      } else {
        const error = await response.json()
        alert(error.error || 'Error al eliminar usuario')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error al eliminar usuario')
    }
  }

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setBulkLoading(true)
    setBulkResult(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        alert('El archivo CSV debe tener al menos una fila de encabezados y una de datos')
        return
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const users = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const user: any = {}

        headers.forEach((header, idx) => {
          if (header === 'nombre' || header === 'name') user.nombre = values[idx]
          else if (header === 'email' || header === 'correo') user.email = values[idx]
          else if (header === 'username' || header === 'usuario') user.username = values[idx]
          else if (header === 'rol' || header === 'role') user.rol = values[idx]
          else if (header === 'sede') user.sede = values[idx]
          else if (header === 'password' || header === 'contraseña') user.password = values[idx]
        })

        if (user.nombre && user.email) {
          users.push(user)
        }
      }

      const response = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users }),
      })

      const result = await response.json()

      if (response.ok) {
        setBulkResult({
          created: result.created,
          skipped: result.skipped,
          errors: result.errors || [],
        })
        await loadUsers()
      } else {
        alert(result.error || 'Error al cargar usuarios')
      }
    } catch (error) {
      console.error('Error uploading CSV:', error)
      alert('Error al procesar el archivo CSV')
    } finally {
      setBulkLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
              <p className="text-gray-600 mt-1">Administra los usuarios de tu organización</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                ← Volver
              </button>
              <button
                onClick={() => setShowBulkModal(true)}
                className="px-4 py-2 bg-green-100 text-green-700 rounded-xl font-semibold hover:bg-green-200 transition-colors"
              >
                📥 Carga CSV
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
              >
                + Crear Usuario
              </button>
            </div>
          </div>
        </div>

        {/* Barra de acciones masivas */}
        {selectedUsers.size > 0 && (
          <div className="bg-indigo-600 rounded-2xl p-4 mb-4 shadow-lg flex items-center justify-between flex-wrap gap-4 animate-slideDown">
            <div className="flex items-center gap-3 text-white">
              <div className="bg-white/20 rounded-full p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-semibold">{selectedUsers.size} usuario{selectedUsers.size > 1 ? 's' : ''} seleccionado{selectedUsers.size > 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  setBulkAction('CHANGE_ROLE')
                  setShowBulkActionModal(true)
                }}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Cambiar Rol
              </button>
              <button
                onClick={() => {
                  setBulkAction('CHANGE_SEDE')
                  setShowBulkActionModal(true)
                }}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Cambiar Sede
              </button>
              <button
                onClick={() => {
                  setBulkAction('DELETE')
                  setShowBulkActionModal(true)
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar
              </button>
              <button
                onClick={() => setSelectedUsers(new Set())}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <tr>
                  <th className="px-4 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectableUsers.length > 0 && selectedUsers.size === selectableUsers.length}
                      onChange={toggleSelectAll}
                      className="w-5 h-5 rounded border-2 border-white/50 text-indigo-600 focus:ring-2 focus:ring-white/50 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-4 text-left font-semibold">Nombre</th>
                  <th className="px-4 py-4 text-left font-semibold">Email</th>
                  <th className="px-4 py-4 text-left font-semibold">Usuario</th>
                  <th className="px-4 py-4 text-left font-semibold">Rol</th>
                  <th className="px-4 py-4 text-left font-semibold">Sede</th>
                  <th className="px-4 py-4 text-left font-semibold">Docs</th>
                  <th className="px-4 py-4 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => {
                  const isCurrentUser = user.id === session?.user?.id
                  const isSelected = selectedUsers.has(user.id)

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        {!isCurrentUser && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectUser(user.id)}
                            className="w-5 h-5 rounded border-2 border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {user.name}
                        {isCurrentUser && <span className="ml-2 text-xs text-indigo-600">(Tú)</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{user.email}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm font-mono">{user.username || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'ORG_ADMIN' ? 'bg-indigo-100 text-indigo-700' :
                          user.role === 'VERIFICADOR' ? 'bg-amber-100 text-amber-700' :
                          user.role === 'APROBADOR' ? 'bg-green-100 text-green-700' :
                          user.role === 'STAFF' ? 'bg-teal-100 text-teal-700' :
                          user.role === 'USER_L3' ? 'bg-pink-100 text-pink-700' :
                          user.role === 'USER_L2' ? 'bg-cyan-100 text-cyan-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {user.role === 'ORG_ADMIN' ? 'Admin' :
                           user.role === 'SUPER_ADMIN' ? 'Super Admin' :
                           user.role === 'VERIFICADOR' ? 'Verificador' :
                           user.role === 'APROBADOR' ? 'Aprobador' :
                           user.role === 'STAFF' ? 'Staff' :
                           user.role === 'USER_L3' ? 'Asesor L3' :
                           user.role === 'USER_L2' ? 'Usuario L2' :
                           'Usuario L1'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {user.sede?.nombre || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user._count.invoices}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => {
                              setEditingUser(user)
                              setShowEditModal(true)
                            }}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.name)}
                            disabled={isCurrentUser}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No hay usuarios registrados
            </div>
          )}
        </div>
      </div>

      {/* Modal de Acción Masiva */}
      {showBulkActionModal && bulkAction && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBulkActionModal(false)
              setBulkAction(null)
            }
          }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl relative z-[51]">
            <div className={`p-6 rounded-t-3xl ${
              bulkAction === 'DELETE'
                ? 'bg-gradient-to-r from-red-600 to-rose-600'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600'
            } text-white`}>
              <h3 className="font-bold text-xl">
                {bulkAction === 'CHANGE_ROLE' && 'Cambiar Rol'}
                {bulkAction === 'CHANGE_SEDE' && 'Cambiar Sede'}
                {bulkAction === 'DELETE' && 'Eliminar Usuarios'}
              </h3>
              <p className="text-white/80 text-sm mt-1">{selectedUsers.size} usuario{selectedUsers.size > 1 ? 's' : ''} seleccionado{selectedUsers.size > 1 ? 's' : ''}</p>
            </div>
            <div className="p-6">
              {bulkAction === 'CHANGE_ROLE' && (
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nuevo Rol</label>
                  <select
                    value={bulkActionRole}
                    onChange={(e) => setBulkActionRole(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                  >
                    <option value="USER_L1">Usuario L1 (solo Planillas)</option>
                    <option value="USER_L2">Usuario L2 (Rendiciones + Cajas)</option>
                    <option value="USER_L3">Asesor L3 (Planillas con destino)</option>
                    <option value="VERIFICADOR">Verificador (Asociar planillas)</option>
                    <option value="APROBADOR">Aprobador (Aprobar planillas)</option>
                    <option value="STAFF">Staff (Ver todo)</option>
                    <option value="ORG_ADMIN">Administrador</option>
                  </select>
                </div>
              )}

              {bulkAction === 'CHANGE_SEDE' && (
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nueva Sede</label>
                  <select
                    value={bulkActionSedeId}
                    onChange={(e) => setBulkActionSedeId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                  >
                    <option value="">Sin sede asignada</option>
                    {sedes.map(sede => (
                      <option key={sede.id} value={sede.id}>{sede.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {bulkAction === 'DELETE' && (
                <div className="bg-red-50 p-4 rounded-xl">
                  <p className="text-red-800 font-medium">
                    ¿Estás seguro de eliminar {selectedUsers.size} usuario{selectedUsers.size > 1 ? 's' : ''}?
                  </p>
                  <p className="text-red-600 text-sm mt-2">Esta acción no se puede deshacer.</p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkActionModal(false)
                    setBulkAction(null)
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBulkAction}
                  disabled={processingBulkAction}
                  className={`flex-1 px-4 py-3 text-white rounded-xl font-semibold disabled:opacity-50 transition-all shadow-lg ${
                    bulkAction === 'DELETE'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                  }`}
                >
                  {processingBulkAction ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false)
            }
          }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl relative z-[51] max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-3xl">
              <h3 className="font-bold text-xl">Crear Nuevo Usuario</h3>
            </div>
            <form onSubmit={handleCreateUser} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre *</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    required
                    autoFocus
                    autoComplete="off"
                    placeholder="Nombre completo"
                  />
                  <p className="text-xs text-gray-500 mt-1">Se formateará automáticamente a Título</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    required
                    autoComplete="off"
                    placeholder="usuario@azaleia.com.pe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Usuario (para login)</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white font-mono"
                    autoComplete="off"
                    placeholder="USUARIO"
                  />
                  <p className="text-xs text-gray-500 mt-1">Opcional. Se convertirá a mayúsculas</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña *</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                  >
                    <option value="USER_L1">Usuario L1 (solo Planillas)</option>
                    <option value="USER_L2">Usuario L2 (Rendiciones + Cajas)</option>
                    <option value="USER_L3">Asesor L3 (Planillas con destino)</option>
                    <option value="VERIFICADOR">Verificador (Asociar planillas)</option>
                    <option value="APROBADOR">Aprobador (Aprobar planillas)</option>
                    <option value="STAFF">Staff (Ver todo)</option>
                    <option value="ORG_ADMIN">Administrador</option>
                    {session?.user.role === 'SUPER_ADMIN' && (
                      <option value="SUPER_ADMIN">Super Administrador</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sede</label>
                  <select
                    value={newUser.sedeId}
                    onChange={(e) => setNewUser({ ...newUser, sedeId: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                  >
                    <option value="">Sin sede asignada</option>
                    {sedes.map(sede => (
                      <option key={sede.id} value={sede.id}>{sede.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg"
                >
                  {creating ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false)
              setEditingUser(null)
            }
          }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl relative z-[51] max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-3xl">
              <h3 className="font-bold text-xl">Editar Usuario</h3>
              <p className="text-blue-100 text-sm mt-1">Modifica la información del usuario</p>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre *</label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    required
                    autoFocus
                    placeholder="Nombre completo"
                  />
                  <p className="text-xs text-gray-500 mt-1">Se formateará automáticamente a Título</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    required
                    placeholder="usuario@azaleia.com.pe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Usuario (para login)</label>
                  <input
                    type="text"
                    value={editingUser.username || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white font-mono"
                    placeholder="USUARIO"
                  />
                  <p className="text-xs text-gray-500 mt-1">Opcional. Se convertirá a mayúsculas</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  >
                    <option value="USER_L1">Usuario L1 (solo Planillas)</option>
                    <option value="USER_L2">Usuario L2 (Rendiciones + Cajas)</option>
                    <option value="USER_L3">Asesor L3 (Planillas con destino)</option>
                    <option value="VERIFICADOR">Verificador (Asociar planillas)</option>
                    <option value="APROBADOR">Aprobador (Aprobar planillas)</option>
                    <option value="STAFF">Staff (Ver todo)</option>
                    <option value="ORG_ADMIN">Administrador</option>
                    {session?.user.role === 'SUPER_ADMIN' && (
                      <option value="SUPER_ADMIN">Super Administrador</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sede</label>
                  <select
                    value={editingUser.sedeId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, sedeId: e.target.value || null })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">Sin sede asignada</option>
                    {sedes.map(sede => (
                      <option key={sede.id} value={sede.id}>{sede.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border-2 border-gray-200">
                    <div>
                      <span className="block text-sm font-semibold text-gray-700">Estado del Usuario</span>
                      <span className="block text-xs text-gray-500 mt-1">
                        {editingUser.active ? 'Usuario activo - puede iniciar sesión' : 'Usuario inactivo - no puede iniciar sesión'}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={editingUser.active ?? true}
                        onChange={(e) => setEditingUser({ ...editingUser, active: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-14 h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-6 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                  </label>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl border-2 border-amber-200">
                  <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Nota sobre contraseñas
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    No puedes cambiar la contraseña desde aquí. El usuario debe usar la opción de recuperación de contraseña.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingUser(null)
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg"
                >
                  {updating ? 'Actualizando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBulkModal(false)
              setBulkResult(null)
            }
          }}
        >
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl relative z-[51]">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-3xl">
              <h3 className="font-bold text-xl">📥 Carga Masiva de Usuarios</h3>
              <p className="text-green-100 text-sm mt-1">Sube un archivo CSV con los usuarios</p>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-2">Formato del archivo CSV:</h4>
                <div className="bg-gray-100 p-4 rounded-xl text-sm font-mono text-gray-700 overflow-x-auto">
                  <p>nombre,email,username,rol,sede,password</p>
                  <p className="text-gray-500">Juan Perez,jperez@azaleia.com.pe,JPEREZ,USER,Arica,MiClave123</p>
                </div>
                <div className="mt-3 text-sm text-gray-600 space-y-1">
                  <p>• <strong>nombre</strong> y <strong>email</strong> son obligatorios</p>
                  <p>• <strong>nombre</strong>: se formateará a Título automáticamente</p>
                  <p>• <strong>rol</strong>: USER, VERIFICADOR, STAFF, ADMIN</p>
                  <p>• <strong>sede</strong>: Arica, Lurín (o código ARICA, LURIN)</p>
                  <p>• <strong>password</strong>: si no se especifica, será "Azaleia2025"</p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleBulkUpload}
                className="hidden"
              />

              {bulkResult && (
                <div className={`mb-4 p-4 rounded-xl ${bulkResult.errors.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                  <p className="font-semibold text-gray-900">Resultado:</p>
                  <p className="text-green-700">✅ Creados: {bulkResult.created}</p>
                  <p className="text-gray-600">⏭️ Omitidos (ya existían): {bulkResult.skipped}</p>
                  {bulkResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-red-700">❌ Errores:</p>
                      <ul className="text-sm text-red-600 list-disc ml-4">
                        {bulkResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {bulkResult.errors.length > 5 && (
                          <li>...y {bulkResult.errors.length - 5} más</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkModal(false)
                    setBulkResult(null)
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={bulkLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg"
                >
                  {bulkLoading ? 'Procesando...' : 'Seleccionar CSV'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
