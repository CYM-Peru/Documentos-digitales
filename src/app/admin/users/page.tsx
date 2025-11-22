'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  _count: {
    invoices: number
  }
}

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'USER' })
  const [creating, setCreating] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      if (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
        router.push('/')
      } else {
        loadUsers()
      }
    }
  }, [status, router, session])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })

      if (response.ok) {
        setShowCreateModal(false)
        setNewUser({ name: '', email: '', password: '', role: 'USER' })
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
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          role: editingUser.role,
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

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">👥 Gestión de Usuarios</h1>
              <p className="text-gray-600 mt-1">Administra los usuarios de tu organización</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                ← Volver
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

        {/* Users Table */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Nombre</th>
                <th className="px-6 py-4 text-left font-semibold">Email</th>
                <th className="px-6 py-4 text-left font-semibold">Rol</th>
                <th className="px-6 py-4 text-left font-semibold">Facturas</th>
                <th className="px-6 py-4 text-left font-semibold">Fecha Creación</th>
                <th className="px-6 py-4 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{user.name}</td>
                  <td className="px-6 py-4 text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'ORG_ADMIN' ? 'bg-indigo-100 text-indigo-700' :
                      user.role === 'APROBADOR' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role === 'ORG_ADMIN' ? 'Admin' :
                       user.role === 'SUPER_ADMIN' ? 'Super Admin' :
                       user.role === 'APROBADOR' ? 'Aprobador' :
                       'Usuario'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{user._count.invoices}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => {
                          setEditingUser(user)
                          setShowEditModal(true)
                        }}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-semibold hover:bg-blue-100 transition-colors"
                      >
                        Editar Rol
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.name)}
                        disabled={user.id === session?.user.id}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No hay usuarios registrados
            </div>
          )}
        </div>
      </div>

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
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl relative z-[51]">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-3xl">
              <h3 className="font-bold text-xl">➕ Crear Nuevo Usuario</h3>
            </div>
            <form onSubmit={handleCreateUser} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    required
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    required
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                  >
                    <option value="USER">Usuario</option>
                    <option value="APROBADOR">Aprobador</option>
                    <option value="ORG_ADMIN">Administrador</option>
                    {session?.user.role === 'SUPER_ADMIN' && (
                      <option value="SUPER_ADMIN">Super Administrador</option>
                    )}
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

      {/* Edit User Role Modal */}
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
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl relative z-[51]">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-3xl">
              <h3 className="font-bold text-xl">✏️ Editar Rol de Usuario</h3>
              <p className="text-blue-100 text-sm mt-1">{editingUser.name}</p>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="text"
                    value={editingUser.email}
                    disabled
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    autoFocus
                  >
                    <option value="USER">Usuario</option>
                    <option value="APROBADOR">Aprobador</option>
                    <option value="ORG_ADMIN">Administrador</option>
                    {session?.user.role === 'SUPER_ADMIN' && (
                      <option value="SUPER_ADMIN">Super Administrador</option>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    {editingUser.role === 'APROBADOR' && '👤 Puede aprobar planillas de movilidad'}
                    {editingUser.role === 'ORG_ADMIN' && '⚙️ Puede gestionar usuarios y configuración'}
                    {editingUser.role === 'SUPER_ADMIN' && '👑 Acceso total al sistema'}
                    {editingUser.role === 'USER' && '📝 Usuario estándar'}
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
    </div>
  )
}
