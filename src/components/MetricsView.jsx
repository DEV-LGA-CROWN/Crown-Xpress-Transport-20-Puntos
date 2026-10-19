import { useState, useEffect } from 'react'
import { BarChart3, Users, Calendar, CheckCircle, Clock, AlertCircle, RefreshCw, TrendingUp, Award, MapPin, Building2, Truck } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import PaginationControls from './PaginationControls'
import { usePagination } from '../hooks/usePagination'
import { authFetch } from '../utils/api'

function getLocalISODate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function MetricsView() {
  const { t, language } = useLanguage()
  const [period, setPeriod] = useState('day')
  const [selectedYard, setSelectedYard] = useState('all')
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMetrics = async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const params = new URLSearchParams({
        period,
        yardCode: selectedYard,
        date: getLocalISODate(now),
        offset: now.getTimezoneOffset().toString(),
      })

      const res = await authFetch(`/api/metrics?${params}`)
      const data = await res.json()
      
      if (data.success) {
        setMetrics(data)
      } else {
        setError(data.error || 'Error loading metrics')
      }
    } catch (err) {
      setError(err.message || 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    // Polling cada 30 segundos
    const interval = setInterval(() => fetchMetrics(true), 30000)
    return () => clearInterval(interval)
  }, [period, selectedYard])

  // Hooks de paginación deben ir ANTES de cualquier return condicional.
  // Se inicializan con arrays vacíos y se alimentan cuando metrics llega.
  const byGuardData = metrics?.byGuard || []
  const byDayData = metrics?.byDay || []
  const guardPagination = usePagination(byGuardData, 'mv_guard_pageSize')
  const dayPagination = usePagination(byDayData, 'mv_day_pageSize')

  if (loading) {
    return (
      <div className="card animate-slide-up">
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-crown-navy" />
          <p className="text-slate-500 text-sm font-medium">
            {language === 'es' ? 'Cargando métricas...' : 'Loading metrics...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card animate-slide-up">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-center">{error}</p>
        </div>
      </div>
    )
  }

  if (!metrics) return null

  const {
    general = {},
    byGuard = [],
    byDay = [],
    byYard = [],
    yards = [],
    dateLabel,
    isAllYards = true,
    nbcw = { total: 0, inspected: 0, pending: 0 },
    nbcwByYard = [],
  } = metrics

  const periods = [
    { value: 'day', es: 'Hoy', en: 'Today' },
    { value: 'week', es: 'Semana', en: 'Week' },
    { value: 'month', es: 'Mes', en: 'Month' },
  ]

  // NOTA: "total" ya incluye las inspecciones en estado 'pending' (el guard
  // ya la realizó y firmó, solo falta la aprobación del supervisor). Por eso
  // "pending" es un SUBCONJUNTO de "total", no algo que se reste como
  // "faltante". Solo se excluyen las inspecciones 'superseded' (reemplazadas
  // por una reconfirmación).
  const total = general.total_inspections || 0
  const completed = general.completed || 0
  const pending = general.pending || 0
  const audited = general.audited || 0

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">
                {language === 'es' ? 'Métricas' : 'Metrics'}
              </h2>
              <p className="text-xs text-white/70 capitalize">
                {dateLabel} · {isAllYards
                  ? (language === 'es' ? 'Todas las yardas' : 'All yards')
                  : (yards.find(y => y.code === selectedYard)?.name || selectedYard)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <MapPin className="w-4 h-4 text-white/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedYard}
                onChange={(e) => setSelectedYard(e.target.value)}
                className="pl-9 pr-8 py-2 rounded-xl bg-white/10 text-white text-sm font-semibold border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 appearance-none cursor-pointer hover:bg-white/20 transition-colors"
              >
                <option value="all" className="text-slate-900">
                  {language === 'es' ? 'Todas las yardas' : 'All yards'}
                </option>
                {yards.map((y) => (
                  <option key={y.id} value={y.code} className="text-slate-900">
                    {y.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center bg-white/10 rounded-xl p-1 gap-1">
              {periods.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    period === p.value
                      ? 'bg-white text-crown-navy shadow-md'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {language === 'es' ? p.es : p.en}
                </button>
              ))}
            </div>
            <button
              onClick={fetchMetrics}
              className="p-2.5 text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
              title={language === 'es' ? 'Actualizar' : 'Refresh'}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* NBCW: Salidas esperadas vs Inspeccionadas vs Pendientes reales */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Truck className="w-5 h-5" />
            {language === 'es' ? 'NBCW — Pendientes Reales' : 'NBCW — Actual Pending'}
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-crown-navy">{nbcw.total}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">
                {language === 'es' ? 'Salidas NBCW' : 'NBCW Outputs'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold text-blue-600">{nbcw.inspectedToday || 0}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">
                {language === 'es' ? 'Inspecc. Hoy' : 'Insp. Today'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold text-red-600">{nbcw.pending}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">
                {language === 'es' ? 'Pendientes' : 'Pending'}
              </p>
            </div>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-700"
              style={{ width: `${nbcw.total > 0 ? Math.round((nbcw.inspected / nbcw.total) * 100) : 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-3">
            {language === 'es'
              ? 'Compara las salidas registradas en NBCW contra las inspecciones realmente creadas (sin importar si ya fueron aprobadas por el supervisor). "Pendientes Reales" son las que aún no se han inspeccionado.'
              : 'Compares NBCW logged outputs against inspections actually created (regardless of supervisor approval). "Actually Pending" are the ones not yet inspected at all.'}
          </p>

          {metrics?.debug && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                {language === 'es' ? 'Diagnóstico NBCW' : 'NBCW diagnostics'}
              </summary>
              <pre className="mt-2 p-2 bg-slate-50 rounded text-[10px] overflow-auto">
                {JSON.stringify(metrics.debug, null, 2)}
              </pre>
            </details>
          )}

          {isAllYards && nbcwByYard.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
              {nbcwByYard.map((y) => (
                <div key={y.yard_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <Truck className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-medium text-slate-700 truncate">{y.yard_name}</span>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-sm">
                    <span className="text-slate-500">{y.nbcw_total} {language === 'es' ? 'total' : 'total'}</span>
                    <span className="text-green-600 font-semibold">{y.nbcw_inspected} {language === 'es' ? 'hechas' : 'done'}</span>
                    <span className="text-red-600 font-semibold">{y.nbcw_pending} {language === 'es' ? 'pendientes' : 'pending'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Metrics by Yard (only on general report) */}
      {isAllYards && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {language === 'es' ? 'Por Yarda' : 'By Yard'}
            </h3>
          </div>
          <div className="card-body">
            {!byYard || byYard.length === 0 ? (
              <EmptyState language={language} icon={Building2} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {byYard.map((y) => {
                  return (
                    <button
                      key={y.yard_id}
                      onClick={() => setSelectedYard(y.yard_code)}
                      className="text-left flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors border border-slate-100"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 bg-crown-navy/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-crown-navy" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{y.yard_name}</p>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">{y.yard_code} · {y.yard_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-center">
                          <p className="text-lg font-bold text-slate-800">{y.total_inspections}</p>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">{language === 'es' ? 'Total' : 'Total'}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metrics by Guard */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            {language === 'es' ? 'Por Guard' : 'By Guard'}
          </h3>
        </div>
        <div className="card-body">
          {byGuard.length === 0 ? (
            <EmptyState language={language} icon={Users} />
          ) : (
            <div>
            <div className="space-y-2">
              {guardPagination.pageItems.map((guard, idx) => {
                return (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors border border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 bg-crown-navy/10 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-crown-navy" />
                        </div>
                        {idx === 0 && guard.total_inspections > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-crown-gold rounded-full flex items-center justify-center">
                            <Award className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{guard.guard_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 flex-shrink-0">
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-800">{guard.total_inspections}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">{language === 'es' ? 'Total' : 'Total'}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <PaginationControls
              page={guardPagination.page}
              pageSize={guardPagination.pageSize}
              total={byGuard.length}
              totalPages={guardPagination.totalPages}
              setPage={guardPagination.setPage}
              setPageSize={guardPagination.setPageSize}
            />
            </div>
          )}
        </div>
      </div>

      {/* Metrics by Day */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {language === 'es' ? 'Por Día (Últimos 7 días)' : 'By Day (Last 7 days)'}
          </h3>
        </div>
        <div className="card-body">
          {byDay.length === 0 ? (
            <EmptyState language={language} icon={Calendar} />
          ) : (
            <div>
            <div className="space-y-2">
              {dayPagination.pageItems.map((day, idx) => {
                return (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors border border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 bg-crown-navy/10 rounded-full flex flex-col items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-crown-navy" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 capitalize truncate">
                          {new Date(day.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 flex-shrink-0">
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-800">{day.total_inspections}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">{language === 'es' ? 'Total' : 'Total'}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <PaginationControls
              page={dayPagination.page}
              pageSize={dayPagination.pageSize}
              total={byDay.length}
              totalPages={dayPagination.totalPages}
              setPage={dayPagination.setPage}
              setPageSize={dayPagination.setPageSize}
            />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', iconBg: 'bg-blue-500' },
    green: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', iconBg: 'bg-green-500' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-700', iconBg: 'bg-yellow-500' },
    red: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', iconBg: 'bg-red-500' },
  }
  const c = colorClasses[color]

  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className={`text-3xl font-extrabold ${c.text} leading-none`}>{value}</p>
      <p className="text-sm font-medium text-slate-500 mt-1">{label}</p>
    </div>
  )
}

function EmptyState({ language, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
        <Icon className="w-7 h-7 text-slate-300" />
      </div>
      <p className="text-slate-400 text-sm font-medium">
        {language === 'es' ? 'No hay datos disponibles' : 'No data available'}
      </p>
    </div>
  )
}
