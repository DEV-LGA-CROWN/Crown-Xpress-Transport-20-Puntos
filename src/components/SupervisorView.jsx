import { useState, useEffect, useMemo } from 'react'
import { Filter, MapPin, User, Truck, Download, FileText, Search, ChevronRight, X, PenTool, Eye, CheckCircle } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { listInspections, downloadPdf, signSupervisor, getInspection, updateInspectionPdf } from '../utils/api'
import { generateInspectionPDF } from '../utils/pdfGenerator'
import AuditTrail from './AuditTrail'
import SignatureCanvas from './SignatureCanvas'
import PaginationControls from './PaginationControls'
import { usePagination } from '../hooks/usePagination'

// Format equipment display combining prefix/fleet + nomenclature/number
const formatEquipment = (insp) => {
  let prefix = insp.customer_prefix || insp.crown_fleet || ''
  let nomenclature = ''

  // For BOBTAIL, use tractor_number (truckid) as the primary identifier
  if (insp.inspection_type === 'BOBTAIL' || insp.trailer_type === 'BOBTAIL') {
    nomenclature = insp.tractor_number || insp.equipment_nomenclature || ''
  } else {
    nomenclature = insp.equipment_nomenclature || insp.trailer_number || insp.tractor_number || ''
  }

  // Fallback: extract prefix from nomenclature if not stored separately (e.g. "CXT-12345")
  if (!prefix && nomenclature && nomenclature.includes('-')) {
    const parts = nomenclature.split('-')
    if (parts.length >= 2 && /^[A-Z]+$/i.test(parts[0])) {
      prefix = parts[0].toUpperCase()
    }
  }
  if (prefix && nomenclature) {
    // Avoid duplicating prefix if nomenclature already starts with it
    if (nomenclature.toUpperCase().startsWith(`${prefix.toUpperCase()}-`)) {
      return nomenclature
    }
    return `${prefix}-${nomenclature}`
  }
  return nomenclature || `#${insp.id}`
}

export default function SupervisorView() {
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [signingInspection, setSigningInspection] = useState(null)
  const [signatureData, setSignatureData] = useState(null)

  // Filters
  const [filterYard, setFilterYard] = useState('')
  const [filterGuard, setFilterGuard] = useState('')
  const [filterTrailer, setFilterTrailer] = useState('')
  const [filterEquipType, setFilterEquipType] = useState('')
  const [filterEquipment, setFilterEquipment] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [groupBy, setGroupBy] = useState('yard') // yard, guard, trailer, none
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  useEffect(() => {
    load()
    async function load(silent = false) {
      if (!silent) setLoading(true)
      setError(null)
      try {
        // Admin ve todas las inspecciones de todas las yardas.
        // Supervisor ve solo las de sus yardas asignadas.
        const isAdmin = user?.role === 'admin'
        let yardCodes = ''
        if (!isAdmin) {
          const userYards = user?.yard_assignments || []
          yardCodes = userYards.length > 0 ? userYards.map(ya => ya.yard_code).join(',') : user?.location_name || ''
        }
        const res = await listInspections({ limit: 500, yardCode: yardCodes })
        setInspections(res.data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    // Polling cada 30 segundos
    const interval = setInterval(() => load(true), 30000)
    return () => clearInterval(interval)
  }, [user?.yard_assignments, user?.location_name, user?.role])

  // Unique values for filter dropdowns
  const yards = useMemo(() => [...new Set(inspections.map(i => i.location).filter(Boolean))].sort(), [inspections])
  const guards = useMemo(() => [...new Set(inspections.map(i => i.guard_name).filter(Boolean))].sort(), [inspections])
  const equipTypes = useMemo(() => [...new Set(inspections.map(i => i.trailer_type).filter(Boolean))].sort(), [inspections])

  // Filtered results
  const filtered = useMemo(() => {
    return inspections.filter(i => {
      if (filterYard && i.location !== filterYard) return false
      if (filterGuard && i.guard_name !== filterGuard) return false
      if (filterTrailer && !i.trailer_number?.toLowerCase().includes(filterTrailer.toLowerCase())) return false
      if (filterEquipType && i.trailer_type !== filterEquipType) return false
      if (filterEquipment) {
        const q = filterEquipment.toLowerCase()
        const haystack = [
          i.equipment_nomenclature,
          i.trailer_number,
          i.container_number,
          i.tractor_number,
          i.customer_prefix,
          i.crown_fleet
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filterStatus && i.status !== filterStatus) return false
      if (filterDateFrom && new Date(i.created_at) < new Date(filterDateFrom)) return false
      if (filterDateTo && new Date(i.created_at) > new Date(filterDateTo + 'T23:59:59')) return false
      return true
    })
  }, [inspections, filterYard, filterGuard, filterTrailer, filterEquipType, filterEquipment, filterStatus, filterDateFrom, filterDateTo])

  // Paginate the flat filtered list before grouping
  const { page, pageSize, pageItems, totalPages, setPage, setPageSize } = usePagination(filtered, 'sv_pageSize')

  // Grouped (only from paginated items)
  const grouped = useMemo(() => {
    if (groupBy === 'none') return { [language === 'es' ? 'Todas' : 'All']: pageItems }
    const key = groupBy === 'yard' ? 'location' : groupBy === 'guard' ? 'guard_name' : 'trailer_number'
    return pageItems.reduce((acc, item) => {
      const k = item[key] || (language === 'es' ? '(Sin asignar)' : '(Unassigned)')
      if (!acc[k]) acc[k] = []
      acc[k].push(item)
      return acc
    }, {})
  }, [pageItems, groupBy, language])

  const clearFilters = () => {
    setFilterYard('')
    setFilterGuard('')
    setFilterTrailer('')
    setFilterEquipType('')
    setFilterEquipment('')
    setFilterStatus('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const handleDownload = async (id, filename) => {
    try {
      const blob = await downloadPdf(id)
      if (blob.size === 0) {
        throw new Error('PDF vacío')
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `inspection-${id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF download error:', e)

      // If PDF doesn't exist in backend, try to generate it on the fly
      try {
        // Get inspection data
        const inspectionData = await getInspection(id)
        const insp = inspectionData.inspection

        // Map snake_case DB fields to camelCase expected by generateInspectionPDF
        const unitInfo = {
          trailerNumber: insp.trailer_number,
          tractorNumber: insp.tractor_number,
          containerNumber: insp.container_number,
          equipmentNomenclature: insp.equipment_nomenclature,
          customerPrefix: insp.customer_prefix,
          sealNumber: insp.seal_number,
          lockNumber: insp.lock_number,
          driverName: insp.driver_name,
          odometer: insp.odometer,
          location: insp.location,
          inspectionDate: insp.inspection_date,
          highSecuritySeal: insp.high_security_seal === 'yes' ? 'yes' : 'no',
          sealAffixed: insp.seal_affixed === 'yes' ? 'yes' : 'no',
          inspectionType: insp.inspection_type || 'LOADED',
          trailerType: insp.trailer_type || (insp.inspection_type === 'BOBTAIL' ? 'BOBTAIL' : null),
          workOrder: insp.wono?.split('::')[0] || insp.wono
        }

        // Convert points array to object keyed by point_id with camelCase
        const pointsObj = {}
        for (const p of (inspectionData.points || [])) {
          pointsObj[p.point_id] = {
            status: p.status,
            issueId: p.issue_id,
            issueCustomText: p.issue_text,
            photo: p.photo
          }
        }

        // Generate PDF on the fly
        const pdfResult = await generateInspectionPDF({
          unitInfo,
          points: pointsObj,
          sealPhoto: insp.seal_photo,
          guardSignature: insp.guard_name ? { name: insp.guard_name, signature: insp.guard_signature, signedAt: insp.guard_signed_at } : null,
          supervisorSignature: insp.supervisor_name ? { name: insp.supervisor_name, signature: insp.supervisor_signature, signedAt: insp.supervisor_signed_at } : null,
          operatorSignature: insp.operator_name ? { name: insp.operator_name, signature: insp.operator_signature } : null,
          language: insp.language || 'es',
          yardCode: insp.location || ''
        })

        // Download the generated PDF
        const pdfBlob = pdfResult.doc.output('blob')
        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename || `inspection-${id}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch (genError) {
        console.error('PDF generation error:', genError)
        alert(language === 'es'
          ? 'Error generando PDF. Por favor intente verlo en lugar de descargarlo.'
          : 'Error generating PDF. Please try viewing it instead of downloading.')
      }
    }
  }

  const handleViewPdf = async (id) => {
    try {
      const blob = await downloadPdf(id)
      if (blob.size === 0) {
        throw new Error('PDF vacío')
      }
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (e) {
      console.error('PDF view error:', e)

      // If PDF doesn't exist in backend, try to generate it on the fly
      try {
        // Get inspection data
        const inspectionData = await getInspection(id)
        const insp = inspectionData.inspection

        // Map snake_case DB fields to camelCase expected by generateInspectionPDF
        const unitInfo = {
          trailerNumber: insp.trailer_number,
          tractorNumber: insp.tractor_number,
          containerNumber: insp.container_number,
          equipmentNomenclature: insp.equipment_nomenclature,
          customerPrefix: insp.customer_prefix,
          sealNumber: insp.seal_number,
          lockNumber: insp.lock_number,
          driverName: insp.driver_name,
          odometer: insp.odometer,
          location: insp.location,
          inspectionDate: insp.inspection_date,
          highSecuritySeal: insp.high_security_seal === 'yes' ? 'yes' : 'no',
          sealAffixed: insp.seal_affixed === 'yes' ? 'yes' : 'no',
          inspectionType: insp.inspection_type || 'LOADED',
          trailerType: insp.trailer_type || (insp.inspection_type === 'BOBTAIL' ? 'BOBTAIL' : null),
          workOrder: insp.wono?.split('::')[0] || insp.wono
        }

        // Convert points array to object keyed by point_id with camelCase
        const pointsObj = {}
        for (const p of (inspectionData.points || [])) {
          pointsObj[p.point_id] = {
            status: p.status,
            issueId: p.issue_id,
            issueCustomText: p.issue_text,
            photo: p.photo
          }
        }

        // Generate PDF on the fly
        const pdfResult = await generateInspectionPDF({
          unitInfo,
          points: pointsObj,
          sealPhoto: insp.seal_photo,
          guardSignature: insp.guard_name ? { name: insp.guard_name, signature: insp.guard_signature, signedAt: insp.guard_signed_at } : null,
          supervisorSignature: insp.supervisor_name ? { name: insp.supervisor_name, signature: insp.supervisor_signature, signedAt: insp.supervisor_signed_at } : null,
          operatorSignature: insp.operator_name ? { name: insp.operator_name, signature: insp.operator_signature } : null,
          language: insp.language || 'es',
          yardCode: insp.location || ''
        })

        // Open PDF in new window
        const pdfBlob = pdfResult.doc.output('blob')
        const url = URL.createObjectURL(pdfBlob)
        window.open(url, '_blank')
      } catch (genError) {
        console.error('PDF generation error:', genError)
        alert(language === 'es'
          ? 'Error generando PDF. Por favor intente descargarlo.'
          : 'Error generating PDF. Please try downloading it.')
      }
    }
  }

  const handleSignSupervisor = (inspection) => {
    setSigningInspection(inspection)
    setShowSignatureModal(true)
  }

  const handleSignatureSubmit = async (signatureImage) => {
    console.log('handleSignatureSubmit called', { signingInspection: !!signingInspection, signatureImage: !!signatureImage })
    if (!signingInspection || !signatureImage) return

    try {
      console.log('Signing supervisor for inspection ID:', signingInspection.id)
      const supervisorSig = {
        name: user?.full_name || 'Supervisor',
        signature: signatureImage,
        signedAt: new Date().toISOString()
      }

      // 1. Save supervisor signature first (fast, no PDF - avoids serverless timeout)
      await signSupervisor(signingInspection.id, supervisorSig)

      // 2. Regenerate PDF in frontend and upload it separately (non-blocking)
      try {
        const inspectionData = await getInspection(signingInspection.id)
        const insp = inspectionData.inspection
        const unitInfo = {
          trailerNumber: insp.trailer_number,
          tractorNumber: insp.tractor_number,
          containerNumber: insp.container_number,
          equipmentNomenclature: insp.equipment_nomenclature,
          customerPrefix: insp.customer_prefix,
          sealNumber: insp.seal_number,
          lockNumber: insp.lock_number,
          driverName: insp.driver_name,
          odometer: insp.odometer,
          location: insp.location,
          inspectionDate: insp.inspection_date,
          highSecuritySeal: insp.high_security_seal,
          sealAffixed: insp.seal_affixed,
          inspectionType: insp.inspection_type,
          trailerType: insp.trailer_type || (insp.inspection_type === 'BOBTAIL' ? 'BOBTAIL' : null),
          workOrder: insp.wono?.split('::')[0] || insp.wono
        }
        const pointsObj = {}
        for (const p of (inspectionData.points || [])) {
          pointsObj[p.point_id] = {
            status: p.status,
            issueId: p.issue_id,
            issueCustomText: p.issue_text,
            photo: p.photo
          }
        }
        const pdfResult = await generateInspectionPDF({
          unitInfo,
          points: pointsObj,
          sealPhoto: insp.seal_photo,
          guardSignature: insp.guard_name ? { name: insp.guard_name, signature: insp.guard_signature, signedAt: insp.guard_signed_at } : null,
          supervisorSignature: supervisorSig,
          operatorSignature: insp.operator_name ? { name: insp.operator_name, signature: insp.operator_signature, signedAt: insp.operator_signed_at } : null,
          language: insp.language || 'es',
          yardCode: insp.location || ''
        })
        const pdfBase64 = pdfResult.doc.output('datauristring')
        await updateInspectionPdf(signingInspection.id, pdfBase64, pdfResult.filename)
        console.log('Supervisor PDF regenerated and uploaded')
      } catch (pdfErr) {
        console.warn('PDF regeneration/upload failed (signature already saved):', pdfErr.message)
      }

      // Refresh inspections list
      const res = await listInspections({ limit: 500 })
      setInspections(res.data || [])

      setShowSignatureModal(false)
      setSigningInspection(null)
      setSignatureData(null)

      setShowSuccessModal(true)
    } catch (err) {
      alert(language === 'es' ? `Error firmando inspección: ${err.message}` : `Error signing inspection: ${err.message}`)
    }
  }

  const stats = {
    total: filtered.length,
    completed: filtered.filter(i => i.status === 'completed').length,
    pending: filtered.filter(i => i.status === 'pending').length,
    failures: filtered.reduce((sum, i) => sum + (i.total_bad || 0), 0),
  }

  if (loading) {
    return (
      <section className="card animate-slide-up">
        <div className="card-body text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-crown-navy/30 border-t-crown-navy rounded-full mx-auto mb-3" />
          <p className="text-slate-500">{language === 'es' ? 'Cargando inspecciones...' : 'Loading inspections...'}</p>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="card animate-slide-up">
        <div className="card-body text-center py-12 text-rose-600">
          <p>{error}</p>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase">{language === 'es' ? 'Total' : 'Total'}</div>
          <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <div className="text-xs text-emerald-700 uppercase">{language === 'es' ? 'Completadas' : 'Completed'}</div>
          <div className="text-2xl font-bold text-emerald-700">{stats.completed}</div>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <div className="text-xs text-blue-700 uppercase">{language === 'es' ? 'Pendientes' : 'Pending'}</div>
          <div className="text-2xl font-bold text-blue-700">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-xl border border-rose-200 p-4">
          <div className="text-xs text-rose-700 uppercase">{language === 'es' ? 'Fallas' : 'Failures'}</div>
          <div className="text-2xl font-bold text-rose-700">{stats.failures}</div>
        </div>
      </section>

      {/* Filters */}
      <section className="card">
        <div className="card-header flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-crown-gold" />
            <h2 className="font-bold uppercase text-sm tracking-wide">
              {language === 'es' ? 'Filtros y Agrupación' : 'Filters & Grouping'}
            </h2>
          </div>
          <button
            onClick={clearFilters}
            className="text-xs px-2 py-1 text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> {language === 'es' ? 'Limpiar' : 'Clear'}
          </button>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Yard */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {language === 'es' ? 'Yarda' : 'Yard'}
              </label>
              <select
                value={filterYard}
                onChange={e => setFilterYard(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
              >
                <option value="">{language === 'es' ? 'Todas' : 'All'}</option>
                {yards.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Guard */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> {language === 'es' ? 'Guardia' : 'Guard'}
              </label>
              <select
                value={filterGuard}
                onChange={e => setFilterGuard(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
              >
                <option value="">{language === 'es' ? 'Todos' : 'All'}</option>
                {guards.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Trailer */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Truck className="w-3 h-3" /> Trailer
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input
                  type="text"
                  value={filterTrailer}
                  onChange={e => setFilterTrailer(e.target.value)}
                  placeholder="T-12345"
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Equipment Type */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1">
                {language === 'es' ? 'Tipo Equipo' : 'Equipment Type'}
              </label>
              <select
                value={filterEquipType}
                onChange={e => setFilterEquipType(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
              >
                <option value="">{language === 'es' ? 'Todos' : 'All'}</option>
                {equipTypes.map(et => <option key={et} value={et}>{et}</option>)}
              </select>
            </div>

            {/* Equipment / eqpcode search */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Truck className="w-3 h-3" /> {language === 'es' ? 'Equipo (eqpcode)' : 'Equipment (eqpcode)'}
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input
                  type="text"
                  value={filterEquipment}
                  onChange={e => setFilterEquipment(e.target.value)}
                  placeholder="CXT, 5775, MSDU..."
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1">
                {language === 'es' ? 'Estado' : 'Status'}
              </label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
              >
                <option value="">{language === 'es' ? 'Todos' : 'All'}</option>
                <option value="completed">{language === 'es' ? 'Completada' : 'Completed'}</option>
                <option value="audited">{language === 'es' ? 'Auditada' : 'Audited'}</option>
                <option value="reconfirmed">{language === 'es' ? 'Reconfirmada' : 'Reconfirmed'}</option>
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1">
                {language === 'es' ? 'Desde' : 'From'}
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1">
                {language === 'es' ? 'Hasta' : 'To'}
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            {/* Group By */}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1">
                {language === 'es' ? 'Agrupar por' : 'Group by'}
              </label>
              <div className="flex gap-1">
                {[
                  { id: 'yard', label: language === 'es' ? 'Yarda' : 'Yard' },
                  { id: 'guard', label: language === 'es' ? 'Guardia' : 'Guard' },
                  { id: 'trailer', label: 'Trailer' },
                  { id: 'none', label: language === 'es' ? 'Sin grupo' : 'None' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setGroupBy(opt.id)}
                    className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg ${
                      groupBy === opt.id
                        ? 'bg-crown-navy text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grouped Results */}
      <section className="space-y-3">
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([groupKey, items]) => (
          <div key={groupKey} className="card">
            <div className="card-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                {groupBy === 'yard' && <MapPin className="w-4 h-4 text-crown-gold" />}
                {groupBy === 'guard' && <User className="w-4 h-4 text-crown-gold" />}
                {groupBy === 'trailer' && <Truck className="w-4 h-4 text-crown-gold" />}
                <h3 className="font-bold text-sm">{groupKey}</h3>
              </div>
              <span className="text-xs text-slate-500">
                {items.length} {language === 'es' ? 'inspecciones' : 'inspections'}
              </span>
            </div>
            <div className="card-body p-0">
              <div className="divide-y divide-slate-100">
                {items.map(insp => (
                  <div key={insp.id}>
                    <button
                      onClick={() => setSelectedId(selectedId === insp.id ? null : insp.id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${
                          selectedId === insp.id ? 'rotate-90' : ''
                        }`} />
                        <div className="text-left min-w-0">
                          <div className="font-semibold text-sm text-slate-800 truncate">
                            {formatEquipment(insp)}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {new Date(insp.created_at).toLocaleString()} · {insp.guard_name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {insp.total_bad > 0 && (
                          <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-semibold">
                            {insp.total_bad} ❌
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          insp.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          insp.status === 'reconfirmed' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {insp.status === 'completed' ? (language === 'es' ? 'Completado' : 'Completed') :
                           insp.status === 'pending' ? (language === 'es' ? 'Pendiente' : 'Pending') :
                           insp.status}
                        </span>
                        {!insp.supervisor_signature && insp.status !== 'completed' && insp.status !== 'audited' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSignSupervisor(insp) }}
                            className="p-1 rounded hover:bg-emerald-200"
                            title={language === 'es' ? 'Firmar como supervisor' : 'Sign as supervisor'}
                          >
                            <PenTool className="w-4 h-4 text-emerald-600" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewPdf(insp.id) }}
                          className="p-1 rounded hover:bg-blue-200"
                          title={language === 'es' ? 'Ver PDF' : 'View PDF'}
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(insp.id, insp.pdf_filename) }}
                          className="p-1 rounded hover:bg-slate-200"
                          title={language === 'es' ? 'Descargar PDF' : 'Download PDF'}
                        >
                          <Download className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </button>
                    {selectedId === insp.id && (
                      <div className="px-4 py-4 bg-slate-50">
                        {/* Inspection Details */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-blue-50 rounded-lg py-2 px-3 text-center">
                            <div className="text-sm font-bold text-blue-600">
                              {insp.inspection_type === 'BOBTAIL' 
                                ? (language === 'es' ? 'BOTADO' : 'BOBTAIL')
                                : (insp.inspection_type || '—')}
                            </div>
                            <div className="text-xs text-blue-700">{language === 'es' ? 'Tipo Inspección' : 'Inspection Type'}</div>
                          </div>
                          <div className="bg-purple-50 rounded-lg py-2 px-3 text-center">
                            <div className="text-sm font-bold text-purple-600">{insp.trailer_type || '—'}</div>
                            <div className="text-xs text-purple-700">{language === 'es' ? 'Tipo Remolque' : 'Trailer Type'}</div>
                          </div>
                        </div>
                        {/* Additional Details */}
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div>
                            <span className="text-slate-500">{language === 'es' ? 'Equipo:' : 'Equipment:'}</span>
                            <span className="font-semibold text-slate-700 ml-1">{formatEquipment(insp)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">{language === 'es' ? 'Sello:' : 'Seal:'}</span>
                            <span className="font-semibold text-slate-700 ml-1">{insp.seal_number || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">{language === 'es' ? 'Candado:' : 'Lock:'}</span>
                            <span className="font-semibold text-slate-700 ml-1">{insp.lock_number || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">{language === 'es' ? 'Operador:' : 'Driver:'}</span>
                            <span className="font-semibold text-slate-700 ml-1">{insp.driver_name || '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">{language === 'es' ? 'Guardia:' : 'Guard:'}</span>
                            <span className="font-semibold text-slate-700 ml-1">{insp.guard_name || '—'}</span>
                          </div>
                        </div>
                        <AuditTrail inspectionId={insp.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <div className="card">
            <div className="card-body text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">{language === 'es' ? 'No se encontraron inspecciones' : 'No inspections found'}</p>
            </div>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="card">
            <div className="card-body p-0">
              <PaginationControls
                page={page}
                pageSize={pageSize}
                total={filtered.length}
                totalPages={totalPages}
                setPage={setPage}
                setPageSize={setPageSize}
              />
            </div>
          </div>
        )}
      </section>

      {/* Supervisor Signature Modal */}
      <SignatureCanvas
        open={showSignatureModal}
        onClose={() => {
          setShowSignatureModal(false)
          setSigningInspection(null)
          setSignatureData(null)
        }}
        onSave={handleSignatureSubmit}
        title={language === 'es' ? 'Firmar como Supervisor' : 'Sign as Supervisor'}
        signerName={user?.full_name || 'Supervisor'}
      />

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-slide-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {language === 'es' ? '¡Firmado Exitosamente!' : 'Successfully Signed!'}
              </h3>
              <p className="text-slate-600 mb-6">
                {language === 'es'
                  ? 'La inspección ha sido firmada y el PDF ha sido actualizado.'
                  : 'The inspection has been signed and the PDF has been updated.'}
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="btn-gold w-full"
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
