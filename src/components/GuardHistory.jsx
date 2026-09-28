import { useState, useEffect, useMemo } from 'react'
import { FileText, Search, Download, AlertTriangle, ChevronDown, ChevronRight, Lock, GitBranch, CheckCircle, X, Filter, Calendar, Truck, User, Tag, Eye } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { listInspections, downloadPdf, getInspection, reconfirmInspection } from '../utils/api'
import { generateInspectionPDF } from '../utils/pdfGenerator'
import { INSPECTION_TYPES } from '../data/inspectionPoints'
import AuditTrail from './AuditTrail'
import ReconfirmModal from './ReconfirmModal'
import PaginationControls from './PaginationControls'
import { usePagination } from '../hooks/usePagination'

// Localized labels for trailer types
const TRAILER_TYPE_LABELS = {
  BOX: { es: 'CAJA', en: 'BOX' },
  CONTAINER: { es: 'CONTENEDOR', en: 'CONTAINER' },
  FLATBED: { es: 'PLATAFORMA', en: 'FLATBED' },
  RABON: { es: 'RABÓN', en: 'RABON' },
  BOBTAIL: { es: 'BOTADO', en: 'BOBTAIL' },
  OTHER: { es: 'OTROS', en: 'OTHER' },
}

// Get localized label for an inspection type code
const inspectionTypeLabel = (code, lang) => {
  if (!code) return '—'
  const cfg = INSPECTION_TYPES[code]
  return cfg ? cfg[lang] : code
}

// Get localized label for a trailer type code
const trailerTypeLabel = (code, lang) => {
  if (!code) return '—'
  const cfg = TRAILER_TYPE_LABELS[code]
  return cfg ? cfg[lang] : code
}

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

/**
 * GuardHistory: read-only history of inspections done by the current guard.
 * Guard cannot edit/delete. Can only create reconfirmations linked to original.
 * Shows original and reconfirmations side by side.
 */
export default function GuardHistory() {
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [search, setSearch] = useState('')
  const [reconfirmTarget, setReconfirmTarget] = useState(null)
  const [successModal, setSuccessModal] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: '',
    inspectionType: ''
  })

  useEffect(() => {
    load()
    // Polling cada 30 segundos
    const interval = setInterval(() => load(true), 30000)
    return () => clearInterval(interval)
  }, [user])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setError(null)
    try {
      // Use yard_assignments from user to filter inspections
      const userYards = user?.yard_assignments || []
      const yardCodes = userYards.length > 0 ? userYards.map(ya => ya.yard_code).join(',') : user?.location_name || ''
      const res = await listInspections({ limit: 'all', yardCode: yardCodes })
      // Only show inspections from current guard/supervisor - more flexible matching
      const userName = user?.full_name?.toLowerCase().trim()
      const mine = Array.isArray(res.data) ? res.data.filter(i => {
        const guardName = i.guard_name?.toLowerCase().trim()
        // Exact match or contains (to handle variations)
        return guardName && (guardName === userName || guardName.includes(userName) || userName.includes(guardName))
      }) : []
      setInspections(mine)
    } catch (err) {
      console.error('GuardHistory error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Group inspections: originals with their reconfirmations
  const groupedInspections = useMemo(() => {
    const originals = inspections.filter(i => !i.original_inspection_id)
    const reconfirms = inspections.filter(i => i.original_inspection_id)
    
    return originals.map(orig => ({
      original: orig,
      // Compare as numbers to handle type mismatches
      reconfirmations: reconfirms.filter(r => Number(r.original_inspection_id) === Number(orig.id))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }))
  }, [inspections])

  const filteredGroups = groupedInspections.filter(g => {
    const orig = g.original
    
    // Text search
    const searchMatch = !search ||
      orig.trailer_number?.toLowerCase().includes(search.toLowerCase()) ||
      orig.driver_name?.toLowerCase().includes(search.toLowerCase()) ||
      orig.seal_number?.toLowerCase().includes(search.toLowerCase()) ||
      orig.location?.toLowerCase().includes(search.toLowerCase()) ||
      orig.guard_name?.toLowerCase().includes(search.toLowerCase())
    
    // Date filters
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : null
    const dateTo = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : null
    const inspDate = new Date(orig.created_at)
    const dateMatch = (!dateFrom || inspDate >= dateFrom) && (!dateTo || inspDate <= dateTo)
    
    // Status filter
    const statusMatch = !filters.status || orig.status === filters.status
    
    // Inspection type filter
    const typeMatch = !filters.inspectionType || orig.inspection_type === filters.inspectionType
    
    return searchMatch && dateMatch && statusMatch && typeMatch
  })
  
  // Clear all filters
  const clearFilters = () => {
    setSearch('')
    setFilters({ dateFrom: '', dateTo: '', status: '', inspectionType: '' })
  }
  
  const hasActiveFilters = search || filters.dateFrom || filters.dateTo || filters.status || filters.inspectionType

  const { page, pageSize, pageItems, totalPages, setPage, setPageSize } = usePagination(filteredGroups, 'gh_pageSize')

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const handleDownload = async (id, filename) => {
    try {
      const blob = await downloadPdf(id)
      if (!blob || blob.size === 0) {
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
          trailerType: insp.trailer_type,
          workOrder: insp.wono?.split('::')[0] || insp.wono
        }

        // Convert points array to object keyed by point_id
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

  const handleViewPdf = async (id, filename) => {
    // For iPad/iOS: Open a blank window FIRST (must be in direct click handler)
    // Then load the PDF into it after async operations
    const newWindow = window.open('about:blank', '_blank')
    
    if (!newWindow) {
      alert(language === 'es' 
        ? 'Por favor permite ventanas emergentes para ver el PDF' 
        : 'Please allow popups to view the PDF')
      return
    }

    // Show loading message in new window
    newWindow.document.write(`
      <html>
        <head><title>${language === 'es' ? 'Cargando PDF...' : 'Loading PDF...'}</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f1f5f9;">
          <div style="text-align:center;">
            <div style="font-size:24px;margin-bottom:10px;">⏳</div>
            <div>${language === 'es' ? 'Cargando PDF...' : 'Loading PDF...'}</div>
          </div>
        </body>
      </html>
    `)

    try {
      // First try to download PDF from backend
      const blob = await downloadPdf(id)
      if (blob.size === 0) {
        throw new Error('PDF vacío')
      }
      const url = URL.createObjectURL(blob)
      newWindow.location.href = url
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
          trailerType: insp.trailer_type,
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

        // Open PDF in the already-opened window
        const pdfBlob = pdfResult.doc.output('blob')
        const url = URL.createObjectURL(pdfBlob)
        newWindow.location.href = url
      } catch (genError) {
        console.error('PDF generation error:', genError)
        newWindow.close()
        alert(language === 'es'
          ? 'Error generando PDF. Por favor intente descargarlo.'
          : 'Error generating PDF. Please try downloading it.')
      }
    }
  }

  const handleReconfirm = async (id) => {
    try {
      const full = await getInspection(id)
      setReconfirmTarget(full)
    } catch (e) {
      alert(language === 'es' ? 'Error cargando inspección' : 'Error loading inspection')
    }
  }

  const handleReconfirmSubmit = async (data) => {
    try {
      // Reconstruct points object from modifications for PDF generation
      const points = {}
      const originalPoints = reconfirmTarget?.points || []

      // Start with original points
      for (const p of originalPoints) {
        points[p.point_id] = {
          status: p.status,
          issueId: p.issue_id,
          issueText: p.issue_text,
          photo: p.photo
        }
      }

      // Apply modifications
      for (const mod of data.modifications || []) {
        points[mod.pointId] = {
          status: mod.status,
          issueId: mod.issueId,
          issueText: mod.issueText,
          photo: mod.photo
        }
      }

      // Generate PDF for reconfirmation
      const pdfResult = await generateInspectionPDF({
        unitInfo: data.unitInfo,
        points,
        sealPhoto: data.sealPhoto,
        guardSignature: data.guardSignature,
        auditorSignature: data.auditorSignature,
        operatorSignature: null,
        language: data.language || language
      })

      // Convert PDF to base64
      const pdfBlob = pdfResult.doc.output('blob')
      const pdfBase64 = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result.split(',')[1])
        reader.readAsDataURL(pdfBlob)
      })

      // Add PDF data to the request
      const dataWithPdf = {
        ...data,
        pdfBase64,
        pdfFilename: pdfResult.filename
      }

      const result = await reconfirmInspection(data.original_inspection_id, dataWithPdf)
      setReconfirmTarget(null)
      setSuccessModal({
        id: result.id,
        modifications: result.modifications || 0,
        originalId: data.original_inspection_id
      })
      load()
    } catch (e) {
      console.error('Reconfirm error:', e)
      alert(
        language === 'es'
          ? `Error: ${e.message}`
          : `Error: ${e.message}`
      )
    }
  }

  if (loading) {
    return (
      <section className="card">
        <div className="card-body text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-crown-navy/30 border-t-crown-navy rounded-full mx-auto mb-3" />
          <p className="text-slate-500">{language === 'es' ? 'Cargando mi historial...' : 'Loading my history...'}</p>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="card">
        <div className="card-body text-center py-12 text-rose-600">
          <p>{error}</p>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="card animate-slide-up">
        <div className="card-header flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-crown-gold" />
            <div>
              <h2 className="font-bold uppercase text-sm tracking-wide">
                {language === 'es' ? 'MI HISTORIAL' : 'MY HISTORY'}
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Lock className="w-3 h-3" />
                {language === 'es' ? 'SOLO LECTURA · NO SE PUEDE EDITAR NI BORRAR' : 'READ ONLY · CANNOT EDIT OR DELETE'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={language === 'es' ? 'BUSCAR...' : 'SEARCH...'}
                className="pl-9 pr-3 py-1.5 w-48 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20 uppercase"
              />
            </div>
            {/* Filter toggle button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-crown-navy text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              {language === 'es' ? 'FILTROS' : 'FILTERS'}
              {hasActiveFilters && (
                <span className="w-4 h-4 bg-crown-gold text-crown-navy rounded-full text-[10px] flex items-center justify-center font-bold">
                  !
                </span>
              )}
            </button>
          </div>
        </div>
        
        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Date From */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">
                  {language === 'es' ? 'DESDE' : 'FROM'}
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
                />
              </div>
              {/* Date To */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">
                  {language === 'es' ? 'HASTA' : 'TO'}
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
                />
              </div>
              {/* Status */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">
                  {language === 'es' ? 'ESTADO' : 'STATUS'}
                </label>
                <select
                  value={filters.status}
                  onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20 uppercase"
                >
                  <option value="">{language === 'es' ? 'TODOS' : 'ALL'}</option>
                  <option value="completed">{language === 'es' ? 'COMPLETADO' : 'COMPLETED'}</option>
                  <option value="pending">{language === 'es' ? 'PENDIENTE' : 'PENDING'}</option>
                </select>
              </div>
              {/* Inspection Type */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">
                  {language === 'es' ? 'TIPO' : 'TYPE'}
                </label>
                <select
                  value={filters.inspectionType}
                  onChange={e => setFilters(f => ({ ...f, inspectionType: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20 uppercase"
                >
                  <option value="">{language === 'es' ? 'TODOS' : 'ALL'}</option>
                  <option value="LOADED">{inspectionTypeLabel('LOADED', language)}</option>
                  <option value="EMPTY">{inspectionTypeLabel('EMPTY', language)}</option>
                  <option value="BOBTAIL">{inspectionTypeLabel('BOBTAIL', language)}</option>
                  <option value="FLATBED">{inspectionTypeLabel('FLATBED', language)}</option>
                </select>
              </div>
            </div>
            {/* Clear filters button */}
            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <X className="w-3 h-3" />
                  {language === 'es' ? 'LIMPIAR FILTROS' : 'CLEAR FILTERS'}
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Results count */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
          {filteredGroups.length} {language === 'es' ? 'INSPECCIONES ENCONTRADAS' : 'INSPECTIONS FOUND'}
          {hasActiveFilters && ` (${language === 'es' ? 'FILTRADO' : 'FILTERED'})`}
        </div>
        <div className="card-body">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3" />
              <p>{search ? (language === 'es' ? 'Sin resultados' : 'No results') : (language === 'es' ? 'Sin inspecciones aún' : 'No inspections yet')}</p>
            </div>
          ) : (
            <div>
            <div className="space-y-3">
              {pageItems.map(group => (
                <div key={group.original.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  {/* Header - Click to expand */}
                  <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                    onClick={() => toggle(group.original.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {expanded[group.original.id] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">
                          {formatEquipment(group.original)} · {group.original.guard_name || group.original.driver_name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {new Date(group.original.created_at).toLocaleString()} · {group.original.location}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Status badge */}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        group.original.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {group.original.status === 'completed' ? (language === 'es' ? 'Completado' : 'Completed') : group.original.status}
                      </span>
                      {/* View PDF button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewPdf(group.original.id, group.original.pdf_filename) }}
                        className="p-1.5 rounded hover:bg-slate-100"
                        title={language === 'es' ? 'Ver PDF' : 'View PDF'}
                      >
                        <Eye className="w-4 h-4 text-crown-navy" />
                      </button>
                      {/* Download button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(group.original.id, group.original.pdf_filename) }}
                        className="p-1.5 rounded hover:bg-slate-100"
                        title={language === 'es' ? 'Descargar PDF' : 'Download PDF'}
                      >
                        <Download className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expanded[group.original.id] && (
                    <div className="border-t bg-slate-50">
                      {/* Inspection Details */}
                      <div className="px-4 py-3 grid grid-cols-2 gap-2 text-center border-b">
                        <div className="bg-blue-50 rounded-lg py-2">
                          <div className="text-sm font-bold text-blue-600">{inspectionTypeLabel(group.original.inspection_type, language)}</div>
                          <div className="text-xs text-blue-700">{language === 'es' ? 'Tipo Inspección' : 'Inspection Type'}</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg py-2">
                          <div className="text-sm font-bold text-purple-600">{trailerTypeLabel(group.original.trailer_type, language)}</div>
                          <div className="text-xs text-purple-700">{language === 'es' ? 'Tipo Remolque' : 'Trailer Type'}</div>
                        </div>
                      </div>
                      {/* Additional Details */}
                      <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs border-b">
                        <div>
                          <span className="text-slate-500">{language === 'es' ? 'Equipo:' : 'Equipment:'}</span>
                          <span className="font-semibold text-slate-700 ml-1">{formatEquipment(group.original)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">{language === 'es' ? 'Tractor/Camión:' : 'Tractor/Truck:'}</span>
                          <span className="font-semibold text-slate-700 ml-1">{group.original.tractor_number || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">{language === 'es' ? 'Caja/Contenedor:' : 'Box/Container:'}</span>
                          <span className="font-semibold text-slate-700 ml-1">{group.original.trailer_number || group.original.container_number || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">{language === 'es' ? 'Sello:' : 'Seal:'}</span>
                          <span className="font-semibold text-slate-700 ml-1">{group.original.seal_number || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">{language === 'es' ? 'Candado:' : 'Lock:'}</span>
                          <span className="font-semibold text-slate-700 ml-1">{group.original.lock_number || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">{language === 'es' ? 'Operador:' : 'Driver:'}</span>
                          <span className="font-semibold text-slate-700 ml-1">{group.original.driver_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">{language === 'es' ? 'Ubicación:' : 'Location:'}</span>
                          <span className="font-semibold text-slate-700 ml-1">{group.original.location || '—'}</span>
                        </div>
                      </div>
                      {/* Stats */}
                      <div className="px-4 py-3 grid grid-cols-2 gap-2 text-center border-b">
                        <div className="bg-emerald-50 rounded-lg py-2">
                          <div className="text-lg font-bold text-emerald-600">{group.original.total_good || 0}</div>
                          <div className="text-xs text-emerald-700">{language === 'es' ? 'Buenos' : 'Good'}</div>
                        </div>
                        <div className="bg-rose-50 rounded-lg py-2">
                          <div className="text-lg font-bold text-rose-600">{group.original.total_bad || 0}</div>
                          <div className="text-xs text-rose-700">{language === 'es' ? 'Malos' : 'Bad'}</div>
                        </div>
                      </div>

                      {/* Reconfirmations list */}
                      {group.reconfirmations.length > 0 && (
                        <div className="px-4 py-3 border-b">
                          <h4 className="text-xs font-bold text-amber-700 uppercase mb-2 flex items-center gap-1">
                            <GitBranch className="w-3 h-3" />
                            {language === 'es' ? 'Reconfirmaciones' : 'Reconfirmations'} ({group.reconfirmations.length})
                          </h4>
                          <div className="space-y-2">
                            {group.reconfirmations.map((reconf, idx) => (
                              <div key={reconf.id} className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                                <div>
                                  <div className="text-sm font-medium text-amber-800">
                                    #{idx + 1} - {new Date(reconf.created_at).toLocaleString()}
                                  </div>
                                  <div className="text-xs text-amber-600">
                                    ✅ {reconf.good_count || 0} · ❌ {reconf.bad_count || 0}
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownload(reconf.id, reconf.pdf_filename) }}
                                  className="p-1.5 rounded hover:bg-amber-100"
                                >
                                  <Download className="w-4 h-4 text-amber-600" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reconfirmation button */}
                      <div className="px-4 py-3">
                        <button
                          onClick={() => handleReconfirm(group.original.id)}
                          className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          {language === 'es' ? 'Crear Reconfirmación (corregir puntos)' : 'Create Reconfirmation (correct points)'}
                        </button>
                        <p className="text-xs text-slate-500 text-center mt-2">
                          {language === 'es'
                            ? 'Crea un nuevo registro vinculado. Los datos originales no se modifican.'
                            : 'Creates a new linked record. Original data is preserved.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <PaginationControls
              page={page}
              pageSize={pageSize}
              total={filteredGroups.length}
              totalPages={totalPages}
              setPage={setPage}
              setPageSize={setPageSize}
            />
            </div>
          )}
        </div>
      </section>

      {/* Reconfirm Modal */}
      <ReconfirmModal
        open={!!reconfirmTarget}
        originalInspection={reconfirmTarget}
        onClose={() => setReconfirmTarget(null)}
        onSubmit={handleReconfirmSubmit}
      />

      {/* Success Modal */}
      {successModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-8 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">
                {language === 'es' ? '¡Reconfirmación Exitosa!' : 'Reconfirmation Successful!'}
              </h2>
            </div>
            
            {/* Body */}
            <div className="px-6 py-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-slate-100">
                  <span className="text-slate-600">
                    {language === 'es' ? 'ID de Reconfirmación' : 'Reconfirmation ID'}
                  </span>
                  <span className="font-bold text-emerald-600 text-lg">#{successModal.id}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-slate-100">
                  <span className="text-slate-600">
                    {language === 'es' ? 'Inspección Original' : 'Original Inspection'}
                  </span>
                  <span className="font-semibold text-slate-800">#{successModal.originalId}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-slate-600">
                    {language === 'es' ? 'Puntos Corregidos' : 'Points Corrected'}
                  </span>
                  <span className="font-bold text-amber-600 text-lg">{successModal.modifications}</span>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <p className="text-sm text-emerald-700 text-center">
                  {language === 'es' 
                    ? 'La reconfirmación ha sido registrada correctamente en el sistema.' 
                    : 'The reconfirmation has been successfully recorded in the system.'}
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setSuccessModal(null)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                {language === 'es' ? 'ACEPTAR' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
