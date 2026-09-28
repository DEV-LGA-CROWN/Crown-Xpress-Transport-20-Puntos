import { useState, useEffect } from 'react'
import { FileText, Search, Download, Eye, ChevronDown, ChevronRight } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { listInspections, downloadPdf } from '../utils/api'
import AuditTrail from './AuditTrail'
import PaginationControls from './PaginationControls'
import { usePagination } from '../hooks/usePagination'

export default function InspectionHistory() {
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    load()
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Guards see only their own inspections, Supervisors/Admins see all inspections from their assigned yards
        const isAdmin = user?.role === 'admin'
        const isSupervisor = user?.role === 'supervisor'
        let res

        if (isAdmin) {
          // Admin: ver todas las inspecciones de todas las yardas
          res = await listInspections({ limit: 'all' })
        } else if (isSupervisor) {
          // Supervisor: filter by yard_assignments
          const userYards = user?.yard_assignments || []
          const yardCodes = userYards.length > 0 ? userYards.map(ya => ya.yard_code).join(',') : user?.location_name || ''
          res = await listInspections({ limit: 'all', yardCode: yardCodes })
        } else {
          // Guard: filter by their own name (guard_name)
          res = await listInspections({ limit: 'all', guardName: user?.full_name })
        }

        console.log('Inspections loaded:', res)
        setInspections(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        console.error('Error loading inspections:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
  }, [user?.yard_assignments, user?.location_name, user?.role, user?.full_name])

  const filtered = inspections.filter(i =>
    i.trailer_number?.toLowerCase().includes(search.toLowerCase()) ||
    i.tractor_number?.toLowerCase().includes(search.toLowerCase()) ||
    i.driver_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.location?.toLowerCase().includes(search.toLowerCase())
  )

  const { page, pageSize, pageItems, totalPages, setPage, setPageSize } = usePagination(filtered, 'ih_pageSize')

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const handleDownload = async (id, filename) => {
    try {
      const blob = await downloadPdf(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `inspection-${id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(language === 'es' ? 'Error descargando PDF' : 'Error downloading PDF')
    }
  }

  if (loading) {
    return (
      <section className="card animate-slide-up">
        <div className="card-body text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-crown-navy/30 border-t-crown-navy rounded-full mx-auto mb-3" />
          <p className="text-slate-500">{language === 'es' ? 'Cargando historial...' : 'Loading history...'}</p>
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
    <section className="card animate-slide-up">
      <div className="card-header flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-crown-gold" />
          <h2 className="font-bold tracking-wide uppercase text-sm">
            {language === 'es' ? 'Historial de Inspecciones' : 'Inspection History'}
          </h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === 'es' ? 'Buscar trailer, operador...' : 'Search trailer, operator...'}
            className="pl-9 pr-3 py-1.5 w-56 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-crown-navy/20"
          />
        </div>
      </div>
      <div className="card-body">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3" />
            <p>{search ? (language === 'es' ? 'Sin resultados' : 'No results') : (language === 'es' ? 'Sin inspecciones' : 'No inspections')}</p>
          </div>
        ) : (
          <div>
          <div className="space-y-2">
            {pageItems.map(insp => (
              <div key={insp.id} className="border border-slate-200 rounded-lg overflow-hidden hover:border-crown-navy/30 transition-colors">
                {/* Header */}
                <div
                  className="px-4 py-3 bg-white flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggle(insp.id)}
                >
                  <div className="flex items-center gap-3">
                    {expanded[insp.id] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <div>
                      <div className="font-semibold text-slate-800">
                        {insp.inspection_type === 'BOBTAIL' || insp.trailer_type === 'BOBTAIL'
                          ? (insp.tractor_number || `Inspección #${insp.id}`)
                          : (insp.tractor_number || insp.trailer_number || `Inspección #${insp.id}`)
                        }
                        {insp.inspection_type !== 'BOBTAIL' && insp.trailer_type !== 'BOBTAIL' && insp.tractor_number && insp.trailer_number && (
                          <span className="text-slate-400 text-xs ml-1">(T: {insp.trailer_number})</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {insp.driver_name || 'Sin operador'} · {insp.location || 'Sin ubicación'} · {new Date(insp.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {insp.inspection_type && (
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        insp.inspection_type === 'BOBTAIL' ? 'bg-purple-100 text-purple-700' :
                        insp.inspection_type === 'EMPTY' ? 'bg-amber-100 text-amber-700' :
                        insp.inspection_type === 'LOADED' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {insp.inspection_type}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      insp.status === 'audited' ? 'bg-emerald-100 text-emerald-700' :
                      insp.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {insp.status}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(insp.id, insp.pdf_filename) }}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                      title={language === 'es' ? 'Descargar PDF' : 'Download PDF'}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded[insp.id] && (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                      <div className="bg-emerald-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-emerald-700">{insp.good_count || 0}</div>
                        <div className="text-xs text-emerald-600">{t('good')}</div>
                      </div>
                      <div className="bg-rose-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-rose-700">{insp.bad_count || 0}</div>
                        <div className="text-xs text-rose-600">{t('bad')}</div>
                      </div>
                      <div className="bg-slate-100 rounded-lg p-2">
                        <div className="text-lg font-bold text-slate-700">{insp.pending_count || 0}</div>
                        <div className="text-xs text-slate-600">{t('pending')}</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mb-3 space-y-1">
                      <div><span className="font-semibold">Tractor:</span> {insp.tractor_number || '—'}</div>
                      <div><span className="font-semibold">Trailer:</span> {insp.trailer_number || '—'}</div>
                      <div><span className="font-semibold">Tipo:</span> {insp.inspection_type || '—'}</div>
                    </div>
                    <AuditTrail inspectionId={insp.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            totalPages={totalPages}
            setPage={setPage}
            setPageSize={setPageSize}
          />
          </div>
        )}
      </div>
    </section>
  )
}
