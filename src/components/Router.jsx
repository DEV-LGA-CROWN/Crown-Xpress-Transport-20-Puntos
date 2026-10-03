import { useState } from 'react'
import { ClipboardCheck, History, Home, ShieldCheck, FileText, Users, MapPin, BarChart3 } from 'lucide-react'
import GuidedInspection from './GuidedInspection'
import UnitInfo from './UnitInfoEnhanced'
import TruckDiagram from './TruckDiagram'
import InspectionList from './InspectionList'
import SealPhoto from './SealPhoto'
import SignaturesSection from './SignaturesSection'
import SubmitBar from './SubmitBar'
import SuccessModal from './SuccessModal'
import InspectionHistory from './InspectionHistory'
import GuardHistory from './GuardHistory'
import SupervisorView from './SupervisorView'
import UserManagement from './UserManagement'
import YardManagement from './YardManagement'
import MetricsView from './MetricsView'
import { useLanguage } from '../context/LanguageContext'
import { useInspection } from '../context/InspectionContext'
import { useAuth } from '../context/AuthContext'

export default function Router() {
  const { t, language } = useLanguage()
  const { resetInspection, unitInfo } = useInspection()
  const { user, canEdit, canViewAll } = useAuth()
  const [page, setPage] = useState(canViewAll() && !canEdit() ? 'supervisor' : 'form')
  const [success, setSuccess] = useState({ open: false, filename: null })
  const [unitInfoFlowComplete, setUnitInfoFlowComplete] = useState(false)
  const [showInspectionPoints, setShowInspectionPoints] = useState(false)
  
  // Check if inspection type and trailer info has been selected
  // For BOBTAIL/FLATBED: only need inspectionType
  // For LOADED/EMPTY: need inspectionType + trailerType + trailerSize + equipmentOwner
  // For CROWN owner: also need crownFleet
  // For CUSTOMER with CONTAINER: also need customerPrefix
  const inspectionTypeSelected = !!unitInfo?.inspectionType && (
    unitInfo.inspectionType === 'BOBTAIL' ||
    unitInfo.inspectionType === 'FLATBED' ||
    (!!unitInfo?.trailerType && !!unitInfo?.trailerSize && !!unitInfo?.equipmentOwner &&
      (unitInfo.equipmentOwner === 'CROWN' ? !!unitInfo?.crownFleet :
        (unitInfo.trailerType === 'CONTAINER' ? !!unitInfo?.customerPrefix : true)))
  )

  const handleSuccess = (payload) => {
    setSuccess({ open: true, filename: payload.filename })
    // Optionally switch to history after success
    // setPage('history')
  }

  const handleNewInspection = () => {
    resetInspection()
    setSuccess({ open: false, filename: null })
    setShowInspectionPoints(false)
    setUnitInfoFlowComplete(false)
    setPage('form')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isAdmin = user?.role === 'admin'

  // Un usuario no puede inspeccionar sin yarda asignada
  const userYards = (user?.yard_assignments || []).filter(ya => ya.is_active !== false)
  const hasYard = userYards.length > 0 || !!user?.location_name
  const noYardMessage = language === 'es'
    ? 'No puedes crear inspecciones porque no tienes una yarda asignada. Contacta al administrador.'
    : 'You cannot create inspections because you have no assigned yard. Contact the administrator.'
  
  const tabs = [
    canEdit() && { id: 'form', label: 'v1 - Vista Clásica', icon: FileText },
    canEdit() && { id: 'guided', label: 'v2 - Inspección Guiada', icon: Home },
    canEdit() && { id: 'my-history', label: language === 'es' ? 'Mi Historial' : 'My History', icon: History },
    canViewAll() && { id: 'supervisor', label: language === 'es' ? 'Vista Supervisor' : 'Supervisor View', icon: ShieldCheck },
    isAdmin && { id: 'metrics', label: language === 'es' ? 'Métricas' : 'Metrics', icon: BarChart3 },
    isAdmin && { id: 'users', label: language === 'es' ? 'Usuarios' : 'Users', icon: Users },
    isAdmin && { id: 'yards', label: language === 'es' ? 'Yardas' : 'Yards', icon: MapPin },
  ].filter(Boolean)

  const Nav = () => (
    <nav className="sticky top-14 z-20 bg-white border-b border-slate-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 py-2 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setPage(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  page === tab.id
                    ? 'bg-crown-navy text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )

  return (
    <>
      <Nav />
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {page === 'form' && canEdit() && !hasYard && (
          <div className="card">
            <div className="card-body text-center py-12">
              <MapPin className="w-12 h-12 mx-auto text-amber-400 mb-3" />
              <p className="text-slate-700 font-semibold">{noYardMessage}</p>
            </div>
          </div>
        )}
        {page === 'form' && canEdit() && hasYard && (
          <div className="space-y-5">
            <UnitInfo onFlowComplete={setUnitInfoFlowComplete} />
            {/* For BOBTAIL: go directly to 20 points, no button needed */}
            {/* For LOADED/EMPTY: Show "Start Inspection" button after unit info is complete */}
            {inspectionTypeSelected && unitInfoFlowComplete && !showInspectionPoints && unitInfo?.inspectionType !== 'BOBTAIL' && unitInfo?.inspectionType !== 'FLATBED' && (
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setShowInspectionPoints(true)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="px-8 py-4 bg-crown-gold hover:bg-crown-gold-dark text-crown-navy font-bold rounded-xl text-lg transition-colors shadow-lg"
                >
                  {language === 'es' ? 'COMENZAR INSPECCIÓN DE 20 PUNTOS' : 'START 20-POINT INSPECTION'}
                </button>
              </div>
            )}
            {/* Only show inspection components after clicking the button (or directly for BOBTAIL/FLATBED) */}
            {inspectionTypeSelected && unitInfoFlowComplete && (showInspectionPoints || unitInfo?.inspectionType === 'BOBTAIL' || unitInfo?.inspectionType === 'FLATBED') && (
              <>
                <TruckDiagram />
                <InspectionList />
                <SealPhoto />
                <SignaturesSection />
                <SubmitBar onSuccess={handleSuccess} />
              </>
            )}
          </div>
        )}
        {page === 'guided' && canEdit() && !hasYard && (
          <div className="card">
            <div className="card-body text-center py-12">
              <MapPin className="w-12 h-12 mx-auto text-amber-400 mb-3" />
              <p className="text-slate-700 font-semibold">{noYardMessage}</p>
            </div>
          </div>
        )}
        {page === 'guided' && canEdit() && hasYard && (
          <div className="space-y-5">
            <GuidedInspection />
          </div>
        )}
        {page === 'my-history' && canEdit() && <GuardHistory />}
        {page === 'supervisor' && canViewAll() && <SupervisorView />}
        {page === 'metrics' && isAdmin && <MetricsView />}
        {page === 'users' && isAdmin && <UserManagement />}
        {page === 'yards' && isAdmin && <YardManagement />}
      </div>

      <footer className="border-t border-slate-200 bg-white/50 backdrop-blur py-4 mt-2 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-slate-500">
            {t('footer')} · <span className="font-mono text-crown-gold-dark">{t('formCode')}</span>
          </p>
        </div>
      </footer>

      <SuccessModal
        open={success.open}
        filename={success.filename}
        onClose={() => setSuccess({ open: false, filename: null })}
        onNew={handleNewInspection}
      />
    </>
  )
}
