import { useState, useEffect } from 'react'
import { MapPin, Plus, Edit2, Trash2, Save, X, Search, Building, Truck, Package, Settings, Users, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { authFetch } from '../utils/api'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const YARD_TYPES = [
  { id: 'PHYSICAL', label: { es: 'Física', en: 'Physical' }, icon: Building, color: 'bg-blue-500' },
  { id: 'VIRTUAL', label: { es: 'Virtual', en: 'Virtual' }, icon: Settings, color: 'bg-purple-500' }
]

const EQUIPMENT_TYPES = [
  { key: 'trailers', label: { es: 'Trailers', en: 'Trailers' }, icon: Package },
  { key: 'trucks', label: { es: 'Camiones', en: 'Trucks' }, icon: Truck },
  { key: 'boxes', label: { es: 'Cajas', en: 'Boxes' }, icon: Package },
  { key: 'platforms', label: { es: 'Plataformas', en: 'Platforms' }, icon: Settings },
  { key: 'machinery', label: { es: 'Maquinaria', en: 'Machinery' }, icon: Settings }
]

export default function YardManagement() {
  const { language } = useLanguage()
  const [yards, setYards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'PHYSICAL',
    description: '',
    address: '',
    max_trailers: 0,
    max_trucks: 0,
    max_boxes: 0,
    max_platforms: 0,
    max_machinery: 0,
    min_trailers: 0,
    min_trucks: 0,
    min_boxes: 0,
    min_platforms: 0,
    min_machinery: 0
  })
  const [successModal, setSuccessModal] = useState({ show: false, message: '' })
  const [confirmModal, setConfirmModal] = useState({ show: false, type: '', data: null })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadYards()
  }, [])

  async function loadYards() {
    setLoading(true)
    try {
      const res = await authFetch(`${API_BASE}/yard-management?type=yards`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setYards(Array.isArray(data.data) ? data.data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredYards = yards.filter(yard => {
    const matchesSearch = !search || 
      yard.name?.toLowerCase().includes(search.toLowerCase()) ||
      yard.code?.toLowerCase().includes(search.toLowerCase())
    const matchesType = !filterType || yard.type === filterType
    return matchesSearch && matchesType
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId ? { ...formData, id: editingId } : formData

      const res = await authFetch(`${API_BASE}/yard-management?type=yards`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      await loadYards()
      resetForm()
      setSuccessModal({
        show: true,
        message: language === 'es' 
          ? (editingId ? '¡Yarda actualizada exitosamente!' : '¡Yarda creada exitosamente!')
          : (editingId ? 'Yard updated successfully!' : 'Yard created successfully!')
      })
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (yard) => {
    setFormData({
      name: yard.name,
      code: yard.code,
      type: yard.type,
      description: yard.description || '',
      address: yard.address || '',
      max_trailers: yard.max_trailers || 0,
      max_trucks: yard.max_trucks || 0,
      max_boxes: yard.max_boxes || 0,
      max_platforms: yard.max_platforms || 0,
      max_machinery: yard.max_machinery || 0,
      min_trailers: yard.min_trailers || 0,
      min_trucks: yard.min_trucks || 0,
      min_boxes: yard.min_boxes || 0,
      min_platforms: yard.min_platforms || 0,
      min_machinery: yard.min_machinery || 0
    })
    setEditingId(yard.id)
    setShowForm(true)
  }

  const handleDeleteClick = (yard) => {
    setConfirmModal({
      show: true,
      type: 'delete',
      data: yard
    })
  }

  const handleDelete = async (id) => {
    setSaving(true)
    try {
      const res = await authFetch(`${API_BASE}/yard-management?type=yards&id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await loadYards()
      setSuccessModal({
        show: true,
        message: language === 'es' ? '¡Yarda desactivada!' : 'Yard deactivated!'
      })
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setSaving(false)
      setConfirmModal({ show: false, type: '', data: null })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'PHYSICAL',
      description: '',
      address: '',
      max_trailers: 0,
      max_trucks: 0,
      max_boxes: 0,
      max_platforms: 0,
      max_machinery: 0,
      min_trailers: 0,
      min_trucks: 0,
      min_boxes: 0,
      min_platforms: 0,
      min_machinery: 0
    })
    setEditingId(null)
    setShowForm(false)
  }

  const getYardTypeInfo = (typeId) => YARD_TYPES.find(t => t.id === typeId) || YARD_TYPES[0]

  const getCapacityStatus = (current, max, min) => {
    const percentage = max > 0 ? (current / max) * 100 : 0
    if (percentage >= 90) return { color: 'text-red-600', bg: 'bg-red-50', status: 'Llena', percentage }
    if (percentage >= 70) return { color: 'text-amber-600', bg: 'bg-amber-50', status: 'Medio', percentage }
    return { color: 'text-emerald-600', bg: 'bg-emerald-50', status: 'Disponible', percentage }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-crown-navy/30 border-t-crown-navy rounded-full mx-auto mb-3" />
          <p className="text-slate-500">{language === 'es' ? 'Cargando yardas...' : 'Loading yards...'}</p>
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
            <MapPin className="w-5 h-5 text-crown-gold" />
            <h2 className="font-bold tracking-wide uppercase text-sm">
              {language === 'es' ? 'Gestión de Yardas' : 'Yard Management'}
            </h2>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="btn-gold text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {language === 'es' ? 'Nueva Yarda' : 'New Yard'}
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
              placeholder={language === 'es' ? 'Buscar yarda...' : 'Search yard...'}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
          >
            <option value="">{language === 'es' ? 'Todos los tipos' : 'All types'}</option>
            {YARD_TYPES.map(type => (
              <option key={type.id} value={type.id}>{type.label[language]}</option>
            ))}
          </select>
        </div>

        {/* Yards list */}
        <div className="divide-y divide-slate-100">
          {filteredYards.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              {language === 'es' ? 'No hay yardas' : 'No yards found'}
            </div>
          ) : (
            filteredYards.map(yard => {
              const typeInfo = getYardTypeInfo(yard.type)
              const TypeIcon = typeInfo.icon
              return (
                <div key={yard.id} className="px-4 py-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full ${typeInfo.color} flex items-center justify-center`}>
                        <TypeIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-800">{yard.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            yard.type === 'PHYSICAL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {typeInfo.label[language]}
                          </span>
                          <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">
                            {yard.code}
                          </span>
                        </div>
                        {yard.description && (
                          <p className="text-sm text-slate-600 mb-1">{yard.description}</p>
                        )}
                        {yard.address && (
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {yard.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(yard)}
                        className="p-2 rounded-lg hover:bg-slate-200 text-slate-600"
                        title={language === 'es' ? 'Editar' : 'Edit'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(yard)}
                        className="p-2 rounded-lg hover:bg-rose-100 text-rose-500"
                        title={language === 'es' ? 'Desactivar' : 'Deactivate'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Capacity Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                    {EQUIPMENT_TYPES.map(equipment => {
                      const EquipmentIcon = equipment.icon
                      const current = yard[`current_${equipment.key}`] || 0
                      const max = yard[`max_${equipment.key}`] || 0
                      const min = yard[`min_${equipment.key}`] || 0
                      const status = getCapacityStatus(current, max, min)
                      
                      return (
                        <div key={equipment.key} className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <EquipmentIcon className="w-4 h-4 text-slate-600" />
                            <span className="text-xs font-medium text-slate-700">
                              {equipment.label[language]}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">{current}/{max}</span>
                              <span className={`font-medium ${status.color}`}>{status.status}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  status.color === 'text-red-600' ? 'bg-red-500' :
                                  status.color === 'text-amber-600' ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(status.percentage, 100)}%` }}
                              />
                            </div>
                            <div className="text-xs text-slate-400">
                              Min: {min} | Max: {max}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-800">
                {editingId 
                  ? (language === 'es' ? 'Editar Yarda' : 'Edit Yard')
                  : (language === 'es' ? 'Nueva Yarda' : 'New Yard')}
              </h3>
              <button onClick={resetForm} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === 'es' ? 'Nombre de Yarda' : 'Yard Name'} *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === 'es' ? 'Código' : 'Code'} *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20 font-mono"
                    required
                    placeholder="YDA"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === 'es' ? 'Tipo' : 'Type'} *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
                    required
                  >
                    {YARD_TYPES.map(type => (
                      <option key={type.id} value={type.id}>{type.label[language]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {language === 'es' ? 'Dirección' : 'Address'}
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
                    placeholder={language === 'es' ? 'Dirección de la yarda' : 'Yard address'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {language === 'es' ? 'Descripción' : 'Description'}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
                  rows={2}
                  placeholder={language === 'es' ? 'Descripción de la yarda' : 'Yard description'}
                />
              </div>

              {/* Capacity Configuration */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  {language === 'es' ? 'Configuración de Capacidades' : 'Capacity Configuration'}
                </h4>
                <div className="space-y-3">
                  {EQUIPMENT_TYPES.map(equipment => {
                    const EquipmentIcon = equipment.icon
                    return (
                      <div key={equipment.key} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                        <div className="flex items-center gap-2">
                          <EquipmentIcon className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">
                            {equipment.label[language]}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-slate-500">Min</label>
                            <input
                              type="number"
                              min="0"
                              value={formData[`min_${equipment.key}`]}
                              onChange={(e) => setFormData(prev => ({ ...prev, [`min_${equipment.key}`]: parseInt(e.target.value) || 0 }))}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-slate-500">Max</label>
                            <input
                              type="number"
                              min="0"
                              value={formData[`max_${equipment.key}`]}
                              onChange={(e) => setFormData(prev => ({ ...prev, [`max_${equipment.key}`]: parseInt(e.target.value) || 0 }))}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

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
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-crown-navy text-white rounded-lg hover:bg-crown-navy-dark flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {language === 'es' ? 'Guardar' : 'Save'}
                    </>
                  )}
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
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                {language === 'es' ? '¿Desactivar Yarda?' : 'Deactivate Yard?'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {language === 'es' 
                  ? `¿Estás seguro de desactivar "${confirmModal.data?.name}"?` 
                  : `Are you sure you want to deactivate "${confirmModal.data?.name}"?`}
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
                  onClick={() => handleDelete(confirmModal.data.id)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {language === 'es' ? 'Desactivar' : 'Deactivate'}
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
                onClick={() => setSuccessModal({ show: false, message: '' })}
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
