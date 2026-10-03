import { useState, useEffect } from 'react'
import { Users, Plus, Edit2, Trash2, Save, X, Search, Shield, Eye, UserCheck, Crown, CheckCircle2, AlertTriangle, RefreshCw, Key, EyeOff, Copy, UserX, MapPin, User } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import PaginationControls from './PaginationControls'
import { usePagination } from '../hooks/usePagination'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const LOCATIONS = [
  { id: 1, name: 'Yard A - Laredo' },
  { id: 2, name: 'Yard B - El Paso' },
  { id: 3, name: 'Yard C - Dallas' },
  { id: 4, name: 'Yard D - Houston' },
]

const ROLES = [
  { id: 'operator', label: { es: 'Operador', en: 'Operator' }, icon: User, color: 'bg-slate-500' },
  { id: 'guard', label: { es: 'Guardia', en: 'Guard' }, icon: Shield, color: 'bg-blue-500' },
  { id: 'supervisor', label: { es: 'Supervisor', en: 'Supervisor' }, icon: UserCheck, color: 'bg-purple-500' },
  { id: 'admin', label: { es: 'Administrador', en: 'Admin' }, icon: Crown, color: 'bg-amber-500' },
]

export default function UserManagement() {
  const { language } = useLanguage()
  const [employees, setEmployees] = useState([])
  const [yards, setYards] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'guard',
    location_id: null,
    location_name: '',
    yard_assignments: [],
    profile_photo: null,
    showPasswordReset: false
  })
  const [successModal, setSuccessModal] = useState({ show: false, message: '', isEdit: false })
  const [confirmModal, setConfirmModal] = useState({ show: false, type: '', data: null })
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState({})
  const [permanentDeleteModal, setPermanentDeleteModal] = useState({ show: false, employee: null })
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [employeesRes, yardsRes, assignmentsRes] = await Promise.all([
        fetch(`${API_BASE}/employees`),
        fetch(`${API_BASE}/yard-management?type=yards`),
        fetch(`${API_BASE}/yard-management?type=assignments`)
      ])

      const employeesData = await employeesRes.json()
      const yardsData = await yardsRes.json()
      const assignmentsData = await assignmentsRes.json()

      if (employeesData.error) throw new Error(employeesData.error)
      if (yardsData.error) throw new Error(yardsData.error)
      if (assignmentsData.error) throw new Error(assignmentsData.error)

      setEmployees(Array.isArray(employeesData.data) ? employeesData.data : [])
      setYards(Array.isArray(yardsData.data) ? yardsData.data : [])
      setAssignments(Array.isArray(assignmentsData.data) ? assignmentsData.data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadEmployees() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/employees`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEmployees(data.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = !search || 
      emp.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.username?.toLowerCase().includes(search.toLowerCase())
    const matchesRole = !filterRole || emp.role === filterRole
    const matchesActive = showInactive || emp.active !== false
    return matchesSearch && matchesRole && matchesActive
  })

  const { page, pageSize, pageItems, totalPages, setPage, setPageSize } = usePagination(filteredEmployees, 'um_pageSize')

  const getEmployeeYards = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId)
    return employee?.yard_assignments || []
  }

  const handleLocationChange = (locationId) => {
    const loc = yards.find(l => l.id === parseInt(locationId))
    setFormData(prev => ({
      ...prev,
      location_id: parseInt(locationId),
      location_name: loc?.name || ''
    }))
  }

  const handleSubmitClick = (e) => {
    e.preventDefault()
    // Validar que el usuario tenga al menos una yarda asignada
    if (!formData.yard_assignments || formData.yard_assignments.length === 0) {
      alert(language === 'es'
        ? 'No se puede guardar: el usuario debe tener al menos una yarda asignada.'
        : 'Cannot save: the user must have at least one assigned yard.')
      return
    }
    // Show confirmation modal before saving
    setConfirmModal({
      show: true,
      type: editingId ? 'update' : 'create',
      data: formData
    })
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId ? { ...formData, id: editingId } : formData


      const res = await fetch(`${API_BASE}/employees`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      console.log('API response:', data)
      if (data.error) throw new Error(data.error)

      await loadData()
      const isEdit = !!editingId
      resetForm()
      setSuccessModal({
        show: true,
        message: language === 'es'
          ? (isEdit ? '¡Usuario actualizado exitosamente!' : '¡Usuario creado exitosamente!')
          : (isEdit ? 'User updated successfully!' : 'User created successfully!'),
        isEdit
      })
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setSaving(false)
      setConfirmModal({ show: false, type: '', data: null })
    }
  }

  const handleEdit = (emp) => {
    // Use yard_code to find matching yard IDs from the yards list
    const assignedYardCodes = emp.yard_assignments?.map(ya => ya.yard_code).filter(Boolean) || []
    const yardIds = yards
      .filter(yard => assignedYardCodes.includes(yard.code))
      .map(yard => Number(yard.id))
    
    setFormData({
      username: emp.username,
      password: '',
      full_name: emp.full_name,
      role: emp.role,
      location_id: emp.location_id || null,
      location_name: emp.location_name || '',
      yard_assignments: yardIds,
      current_password: emp.password_hash || '',
      active: emp.active !== false,
      showPasswordReset: false
    })
    setEditingId(emp.id)
    setShowForm(true)
  }

  const handleDeleteClick = (emp) => {
    setConfirmModal({
      show: true,
      type: 'delete',
      data: emp
    })
  }

  const handleActivateClick = (emp) => {
    setConfirmModal({
      show: true,
      type: 'activate',
      data: emp
    })
  }

  const handleActivate = async (id) => {
    setSaving(true)
    try {
      const emp = employees.find(e => e.id === id)
      const res = await fetch(`${API_BASE}/employees`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...emp, id, active: true })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await loadEmployees()
      setSuccessModal({
        show: true,
        message: language === 'es' ? '¡Usuario reactivado!' : 'User reactivated!',
        isEdit: false
      })
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setSaving(false)
      setConfirmModal({ show: false, type: '', data: null })
    }
  }

  const togglePasswordVisibility = (empId) => {
    setShowPassword(prev => ({ ...prev, [empId]: !prev[empId] }))
  }

  const copyPassword = (password) => {
    navigator.clipboard.writeText(password)
    alert(language === 'es' ? 'Contraseña copiada' : 'Password copied')
  }

  const handleDelete = async (id) => {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/employees?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await loadEmployees()
      setSuccessModal({
        show: true,
        message: language === 'es' ? '¡Usuario desactivado!' : 'User deactivated!',
        isEdit: false
      })
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setSaving(false)
      setConfirmModal({ show: false, type: '', data: null })
    }
  }

  const handlePermanentDelete = async () => {
    if (deleteConfirmText !== 'ELIMINAR') {
      alert(language === 'es' ? 'Debes escribir ELIMINAR para confirmar' : 'You must type ELIMINAR to confirm')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/employees?id=${permanentDeleteModal.employee.id}&permanent=true`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await loadEmployees()
      setPermanentDeleteModal({ show: false, employee: null })
      setDeleteConfirmText('')
      setSuccessModal({
        show: true,
        message: language === 'es' ? '¡Usuario eliminado permanentemente!' : 'User permanently deleted!',
        isEdit: false
      })
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      full_name: '',
      role: 'guard',
      location_id: null,
      location_name: '',
      yard_assignments: [],
      profile_photo: null
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert(language === 'es' ? 'La foto no puede ser mayor a 5MB' : 'Photo cannot be larger than 5MB')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profile_photo: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const getRoleInfo = (roleId) => ROLES.find(r => r.id === roleId) || ROLES[0]

  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-crown-navy/30 border-t-crown-navy rounded-full mx-auto mb-3" />
          <p className="text-slate-500">{language === 'es' ? 'Cargando usuarios...' : 'Loading users...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-crown-gold" />
            <h2 className="font-bold tracking-wide uppercase text-sm">
              {language === 'es' ? 'Gestión de Usuarios' : 'User Management'}
            </h2>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="btn-gold text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {language === 'es' ? 'Nuevo Usuario' : 'New User'}
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'es' ? 'Buscar usuario...' : 'Search user...'}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
          >
            <option value="">{language === 'es' ? 'Todos los roles' : 'All roles'}</option>
            {ROLES.map(r => (
              <option key={r.id} value={r.id}>{r.label[language]}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 text-crown-navy focus:ring-crown-navy/20"
            />
            {language === 'es' ? 'Mostrar inactivos' : 'Show inactive'}
          </label>
        </div>

        {/* Users list */}
        <div className="divide-y divide-slate-100">
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              {language === 'es' ? 'No hay usuarios' : 'No users found'}
            </div>
          ) : (
            <div>
            <div className="divide-y divide-slate-100">
            {pageItems.map(emp => {
              const roleInfo = getRoleInfo(emp.role)
              const RoleIcon = roleInfo.icon
              return (
                <div key={emp.id} className={`px-4 py-3 flex items-center justify-between ${emp.active === false ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${emp.active === false ? 'opacity-50' : ''} flex items-center justify-center overflow-hidden border-2 border-slate-200`}>
                      {emp.profile_photo ? (
                        <img src={emp.profile_photo} alt={emp.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full ${roleInfo.color} flex items-center justify-center`}>
                          <RoleIcon className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{emp.full_name}</div>
                      <div className="text-xs text-slate-500">
                        @{emp.username} · {roleInfo.label[language]}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                        <MapPin className="w-3 h-3" />
                        {(() => {
                          const assignedYards = getEmployeeYards(emp.id)
                          if (assignedYards.length > 0) {
                            return (
                              <div className="flex flex-wrap gap-1">
                                {assignedYards.map((yard, idx) => (
                                  <span key={idx} className={`px-2 py-0.5 rounded-full text-xs ${
                                    yard.yard_type === 'PHYSICAL' 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {yard.yard_name}
                                  </span>
                                ))}
                              </div>
                            )
                          }
                          return (
                            <span className="text-slate-400">
                              {language === 'es' ? 'Sin yarda asignada' : 'No yard assigned'}
                            </span>
                          )
                        })()}
                      </div>
                      {emp.active === false && (
                        <div className="text-xs text-rose-500 font-medium mt-1">
                          {language === 'es' ? 'INACTIVO' : 'INACTIVE'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(emp)}
                      className="p-2 rounded-lg hover:bg-slate-200 text-slate-600"
                      title={language === 'es' ? 'Editar' : 'Edit'}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })
            }
            </div>
            <PaginationControls
              page={page}
              pageSize={pageSize}
              total={filteredEmployees.length}
              totalPages={totalPages}
              setPage={setPage}
              setPageSize={setPageSize}
            />
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-800">
                {editingId 
                  ? (language === 'es' ? 'Editar Usuario' : 'Edit User')
                  : (language === 'es' ? 'Nuevo Usuario' : 'New User')}
              </h3>
              <button onClick={resetForm} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmitClick} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {language === 'es' ? 'Foto de Perfil' : 'Profile Photo'}
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center overflow-hidden">
                    {formData.profile_photo ? (
                      <img src={formData.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserCheck className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="px-4 py-2 bg-crown-navy text-white rounded-lg hover:bg-crown-navy/90 cursor-pointer text-sm font-medium"
                    >
                      {language === 'es' ? 'Seleccionar Foto' : 'Select Photo'}
                    </label>
                    <p className="text-xs text-slate-500 mt-1">
                      {language === 'es' ? 'Máximo 5MB' : 'Maximum 5MB'}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {language === 'es' ? 'Nombre Completo' : 'Full Name'} *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {language === 'es' ? 'Usuario' : 'Username'} *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
                  required
                />
              </div>

              {/* Current Password - Only show when editing */}
              {editingId && formData.current_password && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <label className="block text-sm font-medium text-amber-700 mb-1 flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    {language === 'es' ? 'Contraseña Actual' : 'Current Password'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showPassword['current'] ? 'text' : 'password'}
                      value={formData.current_password}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-lg font-mono text-amber-800"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('current')}
                      className="p-2 hover:bg-amber-100 rounded-lg text-amber-600"
                    >
                      {showPassword['current'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyPassword(formData.current_password)}
                      className="p-2 hover:bg-amber-100 rounded-lg text-amber-600"
                      title={language === 'es' ? 'Copiar' : 'Copy'}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Password field - show button for reset when editing */}
              {editingId ? (
                <div>
                  {!formData.showPasswordReset ? (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, showPasswordReset: true, password: '' }))}
                      className="w-full px-4 py-2 border border-crown-navy text-crown-navy rounded-lg hover:bg-crown-navy/10 flex items-center justify-center gap-2 font-medium"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {language === 'es' ? 'Restablecer Contraseña' : 'Reset Password'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {language === 'es' ? 'Nueva Contraseña' : 'New Password'}
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
                        placeholder={language === 'es' ? 'Escribe la nueva contraseña' : 'Enter new password'}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, showPasswordReset: false, password: '' }))}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        {language === 'es' ? 'Cancelar' : 'Cancel'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === 'es' ? 'Contraseña' : 'Password'} *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {language === 'es' ? 'Rol' : 'Role'} *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
                >
                  {ROLES.map(r => (
                    <option key={r.id} value={r.id}>{r.label[language]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {language === 'es' ? 'Yardas Asignadas' : 'Assigned Yards'}
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                  {yards.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      {language === 'es' ? 'No hay yardas disponibles' : 'No yards available'}
                    </p>
                  ) : (
                    yards.map(yard => (
                      <label key={yard.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={formData.yard_assignments?.includes(Number(yard.id))}
                          onChange={(e) => {
                            const newAssignments = e.target.checked
                              ? [...(formData.yard_assignments || []), Number(yard.id)]
                              : formData.yard_assignments?.filter(id => id !== Number(yard.id)) || []
                            setFormData(prev => ({ ...prev, yard_assignments: newAssignments }))
                          }}
                          className="rounded border-slate-300 text-crown-navy focus:ring-crown-navy/20"
                        />
                        <span className="text-sm text-slate-700">
                          {yard.name}
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                            yard.type === 'PHYSICAL' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {yard.type === 'PHYSICAL' ? 'Física' : 'Virtual'}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {formData.yard_assignments?.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {language === 'es' ? '⚠️ Selecciona al menos una yarda' : '⚠️ Select at least one yard'}
                  </p>
                )}
              </div>

              {/* Status and Actions - Only show when editing */}
              {editingId && (
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {language === 'es' ? 'Estado del Usuario' : 'User Status'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      formData.active 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {formData.active 
                        ? (language === 'es' ? 'ACTIVO' : 'ACTIVE')
                        : (language === 'es' ? 'INACTIVO' : 'INACTIVE')}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    {formData.active ? (
                      <button
                        type="button"
                        onClick={() => {
                          resetForm()
                          handleDeleteClick({ id: editingId, full_name: formData.full_name })
                        }}
                        className="flex-1 px-3 py-2 border border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50 flex items-center justify-center gap-2 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        {language === 'es' ? 'Desactivar' : 'Deactivate'}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            resetForm()
                            handleActivateClick({ id: editingId, full_name: formData.full_name })
                          }}
                          className="flex-1 px-3 py-2 border border-emerald-300 text-emerald-600 rounded-lg hover:bg-emerald-50 flex items-center justify-center gap-2 text-sm"
                        >
                          <RefreshCw className="w-4 h-4" />
                          {language === 'es' ? 'Reactivar' : 'Reactivate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            resetForm()
                            setPermanentDeleteModal({ show: true, employee: { id: editingId, full_name: formData.full_name, username: formData.username } })
                          }}
                          className="flex-1 px-3 py-2 border border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50 flex items-center justify-center gap-2 text-sm"
                        >
                          <UserX className="w-4 h-4" />
                          {language === 'es' ? 'Eliminar' : 'Delete'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-crown-navy text-white rounded-lg hover:bg-crown-navy-dark flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {language === 'es' ? 'Guardar' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-scale-up">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                confirmModal.type === 'delete' ? 'bg-rose-100' : confirmModal.type === 'activate' ? 'bg-emerald-100' : 'bg-amber-100'
              }`}>
                {confirmModal.type === 'activate' ? (
                  <RefreshCw className="w-8 h-8 text-emerald-500" />
                ) : (
                  <AlertTriangle className={`w-8 h-8 ${
                    confirmModal.type === 'delete' ? 'text-rose-500' : 'text-amber-500'
                  }`} />
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                {confirmModal.type === 'delete' 
                  ? (language === 'es' ? '¿Desactivar Usuario?' : 'Deactivate User?')
                  : confirmModal.type === 'activate'
                    ? (language === 'es' ? '¿Reactivar Usuario?' : 'Reactivate User?')
                    : confirmModal.type === 'update'
                      ? (language === 'es' ? '¿Guardar Cambios?' : 'Save Changes?')
                      : (language === 'es' ? '¿Crear Usuario?' : 'Create User?')}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {confirmModal.type === 'delete' 
                  ? (language === 'es' 
                      ? `¿Estás seguro de desactivar a "${confirmModal.data?.full_name}"? No podrá iniciar sesión.` 
                      : `Are you sure you want to deactivate "${confirmModal.data?.full_name}"? They won't be able to log in.`)
                  : confirmModal.type === 'activate'
                    ? (language === 'es' 
                        ? `¿Reactivar a "${confirmModal.data?.full_name}"? Podrá volver a iniciar sesión.` 
                        : `Reactivate "${confirmModal.data?.full_name}"? They will be able to log in again.`)
                    : confirmModal.type === 'update'
                      ? (language === 'es' 
                          ? `¿Guardar los cambios para "${formData.full_name}"?${formData.password ? ' (Se actualizará la contraseña)' : ''}` 
                          : `Save changes for "${formData.full_name}"?${formData.password ? ' (Password will be updated)' : ''}`)
                      : (language === 'es' 
                          ? `¿Crear el usuario "${formData.full_name}" con usuario "${formData.username}"?` 
                          : `Create user "${formData.full_name}" with username "${formData.username}"?`)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal({ show: false, type: '', data: null })}
                  disabled={saving}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    if (confirmModal.type === 'delete') {
                      handleDelete(confirmModal.data.id)
                    } else if (confirmModal.type === 'activate') {
                      handleActivate(confirmModal.data.id)
                    } else {
                      handleSubmit()
                    }
                  }}
                  disabled={saving}
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
                    confirmModal.type === 'delete' ? 'bg-rose-500 hover:bg-rose-600' : confirmModal.type === 'activate' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-crown-navy hover:bg-crown-navy-dark'
                  }`}
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {confirmModal.type === 'delete' ? <Trash2 className="w-4 h-4" /> : confirmModal.type === 'activate' ? <RefreshCw className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      {confirmModal.type === 'delete' 
                        ? (language === 'es' ? 'Desactivar' : 'Deactivate')
                        : confirmModal.type === 'activate'
                          ? (language === 'es' ? 'Reactivar' : 'Reactivate')
                          : (language === 'es' ? 'Confirmar' : 'Confirm')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Modal */}
      {permanentDeleteModal.show && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-rose-200 bg-rose-50 flex items-center justify-between rounded-t-xl">
              <h3 className="font-bold text-rose-700 flex items-center gap-2">
                <UserX className="w-5 h-5" />
                {language === 'es' ? '⚠️ Eliminar Permanentemente' : '⚠️ Delete Permanently'}
              </h3>
              <button 
                onClick={() => { setPermanentDeleteModal({ show: false, employee: null }); setDeleteConfirmText('') }}
                className="p-1 hover:bg-rose-100 rounded"
              >
                <X className="w-5 h-5 text-rose-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-center">
                <UserX className="w-12 h-12 text-rose-500 mx-auto mb-2" />
                <div className="font-bold text-rose-700 text-lg">{permanentDeleteModal.employee?.full_name}</div>
                <div className="text-sm text-rose-600">@{permanentDeleteModal.employee?.username}</div>
              </div>
              
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                <p className="text-amber-800 text-sm font-medium">
                  {language === 'es' 
                    ? '⚠️ Esta acción es IRREVERSIBLE. El usuario será eliminado permanentemente de la base de datos.'
                    : '⚠️ This action is IRREVERSIBLE. The user will be permanently deleted from the database.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {language === 'es' 
                    ? 'Para confirmar, escribe ELIMINAR:' 
                    : 'To confirm, type ELIMINAR:'}
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="ELIMINAR"
                  className="w-full px-3 py-2 border-2 border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono text-lg text-center uppercase"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setPermanentDeleteModal({ show: false, employee: null }); setDeleteConfirmText('') }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  onClick={handlePermanentDelete}
                  disabled={saving || deleteConfirmText !== 'ELIMINAR'}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {language === 'es' ? 'Eliminar' : 'Delete'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModal.show && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {language === 'es' ? '¡Éxito!' : 'Success!'}
              </h3>
              <p className="text-slate-500 mb-6">
                {successModal.message}
              </p>
              <button
                onClick={() => setSuccessModal({ show: false, message: '', isEdit: false })}
                className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
              >
                {language === 'es' ? 'Aceptar' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
