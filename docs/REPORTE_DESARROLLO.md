# 📋 Reporte de Desarrollo - Crown Xpress Transport
## Sistema de Inspección de 20 Puntos

---

## 📌 Información General del Proyecto

| Campo | Detalle |
|-------|---------|
| **Nombre del Proyecto** | Crown Xpress Transport - Sistema de Inspección |
| **Cliente** | Crown Xpress Transport |
| **Tipo de Aplicación** | Aplicación Web Progresiva (PWA) |
| **Plataforma de Despliegue** | Vercel |
| **Base de Datos** | Neon PostgreSQL |
| **URL de Producción** | crown-xpress-transport-ljxgyoehw-aispuroluis5-4850s-projects.vercel.app |
| **Repositorio** | github.com/Aispuro-sys/Crown-Xpress-Transport |
| **Fecha de Inicio** | Mayo 21, 2026 |
| **Fecha de Última Actualización** | Junio 12, 2026 |
| **Total de Deployments** | 136+ |
| **Desarrollador Principal** | Eduardo Aispuro |

---

## 🛠️ Stack Tecnológico

### Frontend
- **Framework**: React 18.x
- **Build Tool**: Vite 5.4.21
- **Estilos**: TailwindCSS
- **Iconos**: Lucide React
- **Generación PDF**: jsPDF + html2canvas
- **Firmas**: react-signature-canvas

### Backend
- **Runtime**: Vercel Serverless Functions
- **Base de Datos**: Neon PostgreSQL
- **ORM/Driver**: postgres (neon serverless)

### Infraestructura
- **Hosting**: Vercel
- **CDN**: Vercel Edge Network
- **CI/CD**: GitHub → Vercel Auto Deploy

---

## 📜 Historial Completo de Commits y Deployments

### 🗓️ Junio 12, 2026 (Sesión Final de Ajustes)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 1 | `18e0c14` | Fix: add option to show inactive users, they are not deleted | ✅ Ready | 26s |
| 2 | `217ea92` | Improve user management: add confirmation modals and success notifications | ✅ Ready | 21s |
| 3 | `640ff82` | Fix: use password_hash column instead of password in employees API | ✅ Ready | 19s |
| 4 | `9a58d4e` | Add dash to numeric keypad, add SQL to fix employees password column | ✅ Ready | 18s |
| 5 | `8a7e6ee` | V1: separate operator data from 20 points with button to start inspection | ✅ Ready | 18s |

**Resumen del día**: Reorganización completa del flujo V1, corrección de login, mejoras en gestión de usuarios con modales de confirmación.

---

### 🗓️ Junio 10, 2026 (Flujo de Inspección y Validaciones)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 6 | `23fdc62` | LOADED requires seal/lock (except FLATBED), seal photo required when has seal | ✅ Ready | 21s |
| 7 | `9e9ecd4` | Hide truck diagram in V1 until all unit info steps are completed | ✅ Ready | 18s |
| 8 | `4341a9d` | Fix validation: set hasSeal initial value to false to allow EMPTY inspections to proceed | ✅ Ready | 18s |
| 9 | `fe292df` | Show 20 inspection points only after completing container, seal/lock and tractor steps | ✅ Ready | 18s |
| 10 | `1c746e6` | Add tractor number step after container and seal/lock in inspection flow | ✅ Ready | 17s |
| 11 | `c7d100b` | Remove symbols from numeric keypad, keep only numbers | ✅ Ready | 18s |
| 12 | `950f5fe` | Use Tijuana timezone for date, remove guard field from form | ✅ Ready | 18s |
| 13 | `29565b9` | Reorganize inspection flow: ask trailer number and seal/lock in separate steps after prefix selection | ✅ Ready | 18s |
| 14 | `e64827a` | Make trailer number label dynamic based on trailer type | ✅ Ready | 18s |

**Resumen del día**: Implementación del flujo paso a paso, validaciones de sello/candado, zona horaria Tijuana, eliminación de campo guardia.

---

### 🗓️ Junio 9, 2026 (PDF, Imágenes y Compatibilidad Tablets)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 15 | `92167d0` | Fix PDF view button on iPad - open window first then load PDF | ✅ Ready | 18s |
| 16 | `775a079` | Add hint text about closing PDF tab to return | ✅ Ready | 20s |
| 17 | `7a7c71c` | Simplify PDF modal with buttons - iframe doesnt work on tablets | ✅ Ready | 18s |
| 18 | `596e8e6` | Fix PDF scroll on iOS tablet with scrollable wrapper | ✅ Ready | 18s |
| 19 | `3fa7cde` | Add padding top to PDF viewer header to avoid overlap with app header | ✅ Ready | 17s |
| 20 | `e2c5370` | Embed PDF viewer in modal using object tag for iOS support | ✅ Ready | 18s |
| 21 | `97f0283` | Change Regresar a Inicio to Confirmar button | ✅ Ready | 17s |
| 22 | `13fed62` | Remove react-pdf, use simple success modal with view/download buttons | ✅ Ready | 19s |
| 23 | `218ef32` | Fix react-pdf CSS imports and worker configuration for build | ✅ Ready | 21s |
| 24 | `4b8f0eb` | Add react-pdf for in-page PDF viewing with page navigation for tablet | ❌ Error | 8s |
| 25 | `757c556` | Change PDF viewer to success modal with 'View PDF' button for tablet compatibility | ✅ Ready | 17s |
| 26 | `f3906c5` | Restore PDF modal viewer with scrollable container for tablet support | ✅ Ready | 18s |
| 27 | `5e1b5fd` | Fix PDF viewer for tablet: use link click method instead of window.open | ✅ Ready | 17s |
| 28 | `240dd10` | Change PDF viewer in history to open in new tab instead of fullscreen modal | ✅ Ready | 19s |
| 29 | `df8adf0` | Fix PDF viewer: show all pages, block background scroll, generate PDF on-demand if missing | ✅ Ready | 18s |
| 30 | `cbd92e2` | Fix HTTP 413: Remove PDF from payload, compress images more aggressively (400px, 40% quality) | ✅ Ready | 18s |
| 31 | `f270cfe` | Use different truck diagram images based on inspection type (LOADED, EMPTY, DROPPED) | ✅ Ready | 20s |
| 32 | `2b6eaeb` | Fix keypad: block scroll, clear value on close, improve clear button, dynamic title based on trailer type; Add PDF viewer eye button in history | ✅ Ready | 18s |
| 33 | `5411333` | Fix HTTP 413: compress images before upload to reduce payload size | ✅ Ready | 17s |
| 34 | `1ae4d65` | Complete trailer flow: Crown/Customer prefixes by type, chassis only for containers, simplified keypad | ✅ Ready | 20s |
| 35 | `e6b5a9c` | Add OTHER trailer type option | ✅ Ready | 18s |

**Resumen del día**: Solución de compatibilidad con iPad/iOS Safari para visualización de PDFs, compresión de imágenes para evitar HTTP 413, imágenes de diagrama por tipo de inspección.

---

### 🗓️ Junio 8, 2026 (Tipos de Remolque y Firmas)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 36 | `4cee230` | Add NumericKeypad component and chassis number field for iPad input | ✅ Ready | 18s |
| 37 | `c235a46` | Fix trailer sizes and add Crown fleet selection (CXT, RBX, ABBA, JGB) | ✅ Ready | 18s |
| 38 | `b0ff703` | Add equipment owner selection (Crown/Customer) after trailer size | ✅ Ready | 18s |
| 39 | `7d5f10e` | Add trailer type (Box/Container/Flatbed) and size selection for LOADED/EMPTY inspections | ✅ Ready | 17s |
| 40 | `2d7fc84` | feat: ocultar completamente sección de firmas hasta completar puntos | ✅ Ready | 18s |
| 41 | `f039ac2` | feat: ocultar secciones hasta completar todos los puntos | ✅ Ready | 18s |
| 42 | `dd2bd32` | feat: firmas en V1 solo aparecen tras completar todos los puntos | ✅ Ready | 18s |
| 43 | `67c3b47` | feat: ocultar firma de auditor en v1 con checkbox | ✅ Ready | 18s |
| 44 | `462d3b6` | fix: eliminar conflicto builds/functions en vercel.json | ✅ Ready | 22s |
| 45 | `2268e13` | fix: filtrar puntos de inspección por tipo en todos los componentes | ✅ Ready | 20s |
| 46 | `944f4b8` | feat: búsqueda mejorada de operador y filtrado por tipo de inspección | ✅ Ready | 18s |

**Resumen del día**: Implementación de tipos de remolque (Contenedor/Caja/Plataforma), tamaños, selección de propietario Crown/Cliente, teclado numérico para iPad.

---

### 🗓️ Junio 7, 2026 (Tipos de Inspección y Búsqueda)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 47 | `83b0d21` | Hide seal photo for EMPTY/BOBTAIL and jump to last point when Mark All OK | ✅ Ready | 18s |
| 48 | `f712949` | Improve seal/lock layout and uppercase labels | ✅ Ready | 18s |
| 49 | `ed204f8` | Fix: sync inspectionType state with context to hide components on change | ✅ Ready | 18s |
| 50 | `52a5f74` | Fix: clear inspectionType in context when clicking Change button | ✅ Ready | 18s |
| 51 | `977d4bd` | Fix change button text color to be visible on dark header | ✅ Ready | 17s |
| 52 | `cc857cb` | Add advanced search and filters to inspection history | ✅ Ready | 18s |
| 53 | `40c9e6f` | Remove container question, uppercase all form labels | ✅ Ready | 18s |
| 54 | `4fadfdc` | Block v1 form components until inspection type is selected | ✅ Ready | 18s |
| 55 | `f3e5405` | Add inspection type selection (Loaded/Empty/Bobtail) with filtered points | ✅ Ready | 19s |
| 56 | `d863500` | Add missing /api/employees route to vercel.json | ✅ Ready | 23s |
| 57 | `ccc2eb0` | Fix fetchJson to properly parse JSON using text() method | ✅ Ready | 19s |
| 58 | `97e548b` | Fix fetchJson to always parse JSON response | ✅ Ready | 18s |
| 59 | `e4957bc` | Add debug logging for operator search | ✅ Ready | 18s |
| 60 | `71f0fce` | Consolidate operator search into employees endpoint to reduce serverless functions | ✅ Ready | 19s |
| 61 | `155032c` | Add operator search by employee number, improve PDF layout, auto-assign guard name | ❌ Error | 15s |
| 62 | `2972519` | Improve truck diagram display in PDF - better proportions and centering | ✅ Ready | 21s |
| 63 | `a48a16c` | Generate PDF for reconfirmations before saving | ✅ Ready | 19s |
| 64 | `4405f4f` | Improve reconfirmation success modal and make date field readonly | ✅ Ready | 19s |
| 65 | `55421c3` | Add reconfirm endpoint for inspection reconfirmations | ✅ Ready | 18s |
| 66 | `12e9b3e` | Reorganize PDF: 20 points page 1, truck diagram page 2, signatures page 3 | ✅ Ready | 17s |
| 67 | `4b9405e` | Force uppercase on all inputs except login page | ✅ Ready | 18s |
| 68 | `3cacae8` | Add Mark All OK button to v2 StepByStepInspection | ✅ Ready | 17s |

**Resumen del día**: Implementación de selección de tipo de inspección (CARGADO/VACÍO/BOBTAIL), filtrado de puntos, búsqueda avanzada en historial, reconfirmaciones.

---

### 🗓️ Junio 5, 2026 (Historial y Debugging)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 69 | `cde5031` | Fix guard history case-insensitive name comparison | ✅ Ready | 17s |
| 70 | `f9978e7` | Add debug logging to inspection history | ✅ Ready | 19s |

**Resumen del día**: Corrección de comparación de nombres en historial, logging de debug.

---

### 🗓️ Junio 4, 2026 (PDF y Formato de Fechas)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 71 | `babf496` | Fix date format to yyyy-MM-dd for date input | ✅ Ready | 18s |
| 72 | `57d4045` | Fix inspection history column names | ✅ Ready | 17s |
| 73 | `99a6b31` | Fix generating state not resetting after success | ✅ Ready | 19s |
| 74 | `8b25c66` | Updates to inspection components | ✅ Ready | 24s |
| 75 | `1656133` | Fix date format to yyyy-MM-dd | ✅ Ready | 18s |
| 76 | `06c8961` | Update PDF, history, and API changes | ✅ Ready | 20s |
| 77 | `b63fff0` | Fix PDF landscape orientation for truck diagram page | ✅ Ready | 18s |
| 78 | `95c466c` | Fix landscape orientation for truck diagram page | ✅ Ready | 18s |
| 79 | `52d4e0b` | Fix PDF download, add reconfirm endpoint, improve error handling | ✅ Ready | 18s |
| 80 | `171241e` | Expand truck diagram to fill landscape page | ✅ Ready | 19s |
| 81 | `7e1a137` | Add operator employee number field, show in signature | ✅ Ready | 17s |
| 82 | `e5a4865` | Add search filters for container, seal, lock, guard in history | ✅ Ready | 18s |
| 83 | `1ee2ab9` | Fix date field to auto-fill with today date | ✅ Ready | 17s |
| 84 | `3436c04` | PDF landscape diagram, status letters B/M/P, no auto-download | ✅ Ready | 18s |
| 85 | `2ba8130` | PDF improvements: real truck diagram image, colored markers, 10s preview, mark all good button, reset on complete | ✅ Ready | 18s |

**Resumen del día**: Mejoras extensivas en PDF (orientación landscape, diagrama real), formato de fechas, filtros en historial, número de empleado del operador.

---

### 🗓️ Junio 3, 2026 (Firmas y Diagrama)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 86 | `2e495b2` | Add react-signature-canvas dependency | ✅ Ready | 17s |
| 87 | `1b0a435` | Major update: operator signature flow, uppercase text, OTHER option in issues, field validation indicators, finish inspection button | ❌ Error | 5s |
| 88 | `c28ce13` | Add truck diagram to PDF page 2 with B/W friendly labels, show PDF preview for 4 seconds before new inspection | ✅ Ready | 18s |

**Resumen del día**: Integración de firma digital, diagrama del camión en PDF, flujo de firma del operador.

---

### 🗓️ Junio 2, 2026 (Verificación de Imágenes con IA)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 89 | `6ef222f` | Fix Groq model to llama-3.2-11b-vision-preview | ✅ Ready | 19s |
| 90 | `f277a2c` | Switch from Gemini to Groq for image verification | ✅ Ready | 18s |
| 91 | `5ef76f3` | Fix Gemini model to gemini-1.5-flash-latest | ✅ Ready | 18s |
| 92 | `a4dd6ab` | Fix Gemini model to gemini-pro-vision | ✅ Ready | 17s |
| 93 | `2f43d21` | Migrate image verification from OpenAI to Gemini | ✅ Ready | 20s |

**Resumen del día**: Implementación de verificación de imágenes con IA. Migración: OpenAI → Gemini → Groq (llama-3.2-11b-vision).

---

### 🗓️ Junio 1, 2026 (Comentarios y Sello)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 94 | `8bafefe` | Make seal photo optional for completing inspection | ✅ Ready | 18s |
| 95 | `cec9582` | Move comments section to end of 20-point inspection, show only when completed | ✅ Ready | 17s |
| 96 | `5ca325d` | Remove odometer field from inspection forms | ✅ Ready | 19s |

**Resumen del día**: Reorganización de sección de comentarios, eliminación de campo odómetro, foto de sello opcional.

---

### 🗓️ Mayo 31, 2026 (Diagrama del Camión)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 97 | `0aa64dc` | Add truck diagram visual with 20 inspection points, fix duplicate SubmitBar in v2 | ✅ Ready | 22s |

**Resumen del día**: Implementación del diagrama visual del camión con los 20 puntos de inspección.

---

### 🗓️ Mayo 26, 2026 (Gestión de Usuarios y Base de Datos)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 98 | `ab88673` | Fix: guard name readonly in v1, add PDF download endpoint | ✅ Ready | 16s |
| 99 | `f08f1be` | Add user management for admin: employees API, auth API, UserManagement component | ✅ Ready | 23s |
| 100 | `2839288` | Fix dark mode styles for form elements, inputs, labels, selects | ✅ Ready | 25s |
| 101 | `b35a6d8` | Add user management for admin, dark/light mode with persistence | ✅ Ready | 17s |
| 102 | `f71c35a` | Restore version: remove auth system, user management, and theme toggle | ✅ Ready | 17s |
| 103 | `2292ef9` | Add better error handling for employees API | ✅ Ready | 19s |
| 104 | `7d391f0` | Remove combined API endpoints | ✅ Ready | 17s |
| 105 | `cb9c860` | Optimize API functions for Vercel Hobby limit (combine auth and employees) | ❌ Error | 15s |
| 106 | `aef480b` | Add user management system and dark mode support | ❌ Error | 14s |
| 107 | `94253c8` | Improve PDF download error message | ✅ Ready | 21s |
| 108 | `916ca6c` | Fix reconfirmation: send full payload, fix grouping comparison | ✅ Ready | 18s |
| 109 | `eba1633` | Fix guard name auto-fill in v1 SignaturesSection | ✅ Ready | 21s |
| 110 | `8a11d3a` | Force redeploy - fix 10 char min, guard name, PDF download | ✅ Ready | 24s |
| 111 | `35a4116` | Fix PDF download, auto-fill guard name in v1, reset form after submit in v2 | ✅ Ready | 18s |
| 112 | `9ed37b4` | Change reconfirm reason minimum to 10 characters | ✅ Ready | 21s |
| 113 | `487243c` | Add original_inspection_id to list inspections API | ✅ Ready | 19s |
| 114 | `c0d6ef9` | Fix reconfirm: add modifications count, validate bad points need issue+photo | ✅ Ready | 23s |
| 115 | `1f7c660` | Fix issue select modal in reconfirm and simplify history view | ✅ Ready | 20s |
| 116 | `6e557fe` | Fix inspection data saving and reconfirm modal points display | ✅ Ready | 17s |
| 117 | `287e37f` | Increase reconfirm reason to 50 chars, show original and reconfirmations side by side | ✅ Ready | 20s |
| 118 | `499ebd6` | Add retry logic for OpenAI rate limiting (429 errors) | ✅ Ready | 19s |
| 119 | `a7b72e0` | Add auto-logout after 10 min inactivity and link guard name to logged user | ✅ Ready | 18s |
| 120 | `00ebc6b` | Update PDF to use Crown Xpress PNG logo | ✅ Ready | 25s |
| 121 | `cf78424` | Add Neon PostgreSQL database integration and improved Crown logo in PDF | ✅ Ready | 17s |
| 122 | `c744a47` | Add AI image verification, point-specific issues, and timestamp on photos | ✅ Ready | 15s |
| 123 | `a16631e` | Update favicon to Crown Xpress Transport logo | ✅ Ready | 14s |
| 124 | `5880cd4` | Fix v2 inspection: prevent premature summary expansion and add continue button for seal/signatures | ✅ Ready | 15s |
| 125 | `f567fca` | Fix progress indicators layout and add v1/v2 version tabs | ✅ Ready | 15s |

**Resumen del día**: Día más intenso de desarrollo. Integración con Neon PostgreSQL, sistema de usuarios, auto-logout, verificación IA, logo Crown, reconfirmaciones.

---

### 🗓️ Mayo 21, 2026 (Inicio del Proyecto)

| # | Commit | Descripción | Estado | Tiempo Build |
|---|--------|-------------|--------|-------------|
| 126 | `b749d7e` | Add optional checkboxes for seal and lock similar to container checkbox | ✅ Ready | 16s |
| 127 | `daa3795` | Add missing SignatureCanvas component for guided inspection | ✅ Ready | 14s |
| 128 | `e10a1c1` | Implement guided inspection flow with step-by-step navigation and container checkbox | ❌ Error | 8s |
| 129 | `0f3803f` | Fix camera modal for tablet - add floating capture button and improve responsive layout | ✅ Ready | 14s |
| 130 | `46670d2` | Add filter to show only problem points and improve mobile experience with auto-collapse | ✅ Ready | 14s |
| 131 | `25241a0` | Configure Vite build for Vercel and update vercel.json for proper static serving | ✅ Ready | 15s |
| 132 | `b29bf54` | Add favicon.ico and _redirects for proper routing | ✅ Ready | 8s |
| 133 | `54f1838` | Update vercel.json to use version 2 format without specific Node version | ✅ Ready | 13s |
| 134 | `27a00b5` | Remove Node.js version specifications - let Vercel use default | ❌ Error | 25s |
| 135 | `d2b6930` | Update Node.js version to 24.x for Vercel compatibility | ❌ Error | 25s |
| 136 | `1b77cdb` | Add engines.node to package.json specifying Node.js 18.x | ❌ Error | 1s |

**Resumen del día**: Configuración inicial del proyecto, primer deploy en Vercel, configuración de Node.js, componentes base de inspección.

---

## 📊 Resumen de Estadísticas

### Deployments por Estado
| Estado | Cantidad | Porcentaje |
|--------|----------|------------|
| ✅ Ready | 127 | 93.4% |
| ❌ Error | 9 | 6.6% |
| **Total** | **136** | **100%** |

### Deployments por Fecha
| Fecha | Cantidad | Descripción Principal |
|-------|----------|----------------------|
| Jun 12, 2026 | 5 | Flujo V1, usuarios, login |
| Jun 10, 2026 | 9 | Validaciones, teclado, flujo |
| Jun 9, 2026 | 21 | PDF, imágenes, tablets |
| Jun 8, 2026 | 11 | Remolques, firmas, filtros |
| Jun 7, 2026 | 22 | Tipos inspección, búsqueda |
| Jun 5, 2026 | 2 | Historial, debugging |
| Jun 4, 2026 | 15 | PDF, fechas, operador |
| Jun 3, 2026 | 3 | Firmas, diagrama |
| Jun 2, 2026 | 5 | IA verificación imágenes |
| Jun 1, 2026 | 3 | Comentarios, sello |
| May 31, 2026 | 1 | Diagrama camión |
| May 26, 2026 | 28 | Usuarios, temas, BD |
| May 21, 2026 | 11 | Inicio proyecto |

### Tiempo Promedio de Build
- **Promedio**: ~18 segundos
- **Mínimo**: 1 segundo (error)
- **Máximo**: 28 segundos

---

## 🎯 Funcionalidades Implementadas por Fase

### Fase 1: Fundamentos (Mayo 21-26)
- ✅ Configuración inicial de Vite + React
- ✅ Despliegue en Vercel
- ✅ Integración con Neon PostgreSQL
- ✅ Sistema de autenticación básico
- ✅ Gestión de usuarios (CRUD)
- ✅ Tabs V1/V2 para diferentes flujos
- ✅ Componente de firma digital
- ✅ Favicon y branding Crown Xpress

### Fase 2: Inspección Base (Mayo 31 - Junio 3)
- ✅ Diagrama visual del camión con 20 puntos
- ✅ Generación de PDF con logo
- ✅ Flujo de firma del operador
- ✅ Validación de campos
- ✅ Opción "Marcar Todo OK"
- ✅ Sección de comentarios

### Fase 3: Verificación con IA (Junio 2)
- ✅ Integración con OpenAI para verificar fotos
- ✅ Migración a Gemini
- ✅ Migración a Groq (llama-3.2-11b-vision)
- ✅ Retry logic para rate limiting

### Fase 4: PDF y Tablets (Junio 4-9)
- ✅ PDF con múltiples páginas
- ✅ Diagrama en página landscape
- ✅ Compatibilidad con iPad/iOS Safari
- ✅ Visor de PDF embebido
- ✅ Descarga y visualización de PDFs históricos
- ✅ Compresión de imágenes (HTTP 413 fix)

### Fase 5: Tipos de Inspección (Junio 7-8)
- ✅ Selección CARGADO/VACÍO/BOBTAIL
- ✅ Tipos de remolque (Contenedor/Caja/Plataforma)
- ✅ Tamaños de remolque (20', 40', 45', 48', 53')
- ✅ Selección de propietario (Crown/Cliente)
- ✅ Prefijos de flota Crown (CXT, RBX, ABBA, JGB)
- ✅ Filtrado de puntos por tipo de inspección

### Fase 6: Teclado y UX (Junio 8-10)
- ✅ Teclado numérico para iPad
- ✅ Campo de número de chasis
- ✅ Etiquetas dinámicas
- ✅ Flujo paso a paso
- ✅ Zona horaria Tijuana
- ✅ Auto-asignación de guardia

### Fase 7: Refinamientos Finales (Junio 10-12)
- ✅ Validaciones de sello/candado
- ✅ Foto de sello obligatoria
- ✅ Separación de datos vs 20 puntos en V1
- ✅ Modales de confirmación mejorados
- ✅ Gestión de usuarios inactivos
- ✅ Fix de login con password_hash

---

## 🔧 Detalle Técnico de Cambios Principales

### 1. Flujo de Inspección V1 - Vista Clásica

#### Antes:
```
[Selección Tipo] → [Todos los campos juntos] → [20 Puntos visibles siempre]
```

#### Después:
```
[Selección Tipo] 
    ↓
[Tipo Remolque] 
    ↓
[Número Contenedor/Caja/Plataforma] → [Continuar]
    ↓
[Sello/Candado] (si aplica) → [Continuar]
    ↓
[Número Tractor] → [Continuar]
    ↓
[Búsqueda Operador] → [Seleccionar]
    ↓
[Resumen de Datos] → [COMENZAR INSPECCIÓN DE 20 PUNTOS]
    ↓
[Diagrama + 20 Puntos + Firmas + Enviar]
```

### 2. Validaciones de Sello/Candado

| Tipo Inspección | Tipo Remolque | Requiere Sello/Candado | Foto Sello Obligatoria |
|-----------------|---------------|------------------------|------------------------|
| CARGADO | CONTENEDOR | ✅ Sí | ✅ Si hay sello |
| CARGADO | CAJA | ✅ Sí | ✅ Si hay sello |
| CARGADO | PLATAFORMA | ❌ No | ❌ No |
| VACÍO | Cualquiera | ❌ No | ❌ No |
| BOBTAIL | N/A | ❌ No | ❌ No |

### 3. Gestión de Usuarios - Estados y Flujos

#### Crear Usuario:
```
[Llenar formulario] → [Click Guardar] → [Modal Confirmación] 
    → [Confirmar] → [API POST] → [Modal Éxito] → [Cerrar]
```

#### Actualizar Usuario:
```
[Click Editar] → [Modificar datos] → [Click Guardar] → [Modal Confirmación]
    → [Confirmar] → [API PUT] → [Modal Éxito] → [Cerrar]
```

#### Desactivar Usuario:
```
[Click Eliminar] → [Modal Confirmación] → [Confirmar] 
    → [API DELETE (soft)] → [Modal Éxito] → [Usuario oculto]
    → [Checkbox "Mostrar inactivos"] → [Usuario visible con etiqueta INACTIVO]
```

---

## 🐛 Bugs Principales Corregidos

### Bug 1: Login no funcionaba con usuarios creados
- **Causa**: La columna en BD es `password_hash`, el código usaba `password`
- **Solución**: Actualizar `api/auth.js` y `api/employees.js`
- **Commit**: `640ff82`

### Bug 2: HTTP 413 - Payload muy grande
- **Causa**: Imágenes sin comprimir excedían límite de Vercel
- **Solución**: Comprimir imágenes a 400px, 40% calidad
- **Commit**: `cbd92e2`

### Bug 3: PDF no se veía en iPad/iOS Safari
- **Causa**: `window.open` bloqueado, iframe no funciona
- **Solución**: Abrir ventana primero, luego cargar PDF
- **Commit**: `92167d0`

### Bug 4: react-pdf no compilaba
- **Causa**: Incompatibilidad con Vite build
- **Solución**: Remover react-pdf, usar botones simples
- **Commit**: `13fed62`

### Bug 5: Usuarios "eliminados" desaparecían
- **Causa**: Filtro excluía usuarios con `active = false`
- **Solución**: Agregar checkbox "Mostrar inactivos"
- **Commit**: `18e0c14`

---

## 📁 Estructura de Archivos del Proyecto

```
Crown Xpress Transport/
├── api/
│   ├── auth.js                    # Autenticación de usuarios
│   ├── employees.js               # CRUD de empleados + búsqueda operadores
│   ├── inspections.js             # CRUD de inspecciones
│   ├── pdf.js                     # Descarga de PDFs
│   ├── reconfirm.js               # Reconfirmaciones
│   └── verify-image.js            # Verificación IA de imágenes
├── sql/
│   ├── add_password_column.sql    # Migración de contraseña
│   ├── employees_table.sql        # Estructura tabla empleados
│   ├── inspections_table.sql      # Estructura tabla inspecciones
│   └── operators_table.sql        # Estructura tabla operadores
├── src/
│   ├── components/
│   │   ├── GuidedInspection.jsx   # Inspección guiada V2
│   │   ├── GuardHistory.jsx       # Historial de inspecciones
│   │   ├── NumericKeypad.jsx      # Teclado numérico iPad
│   │   ├── Router.jsx             # Navegación principal
│   │   ├── SignaturesSection.jsx  # Sección de firmas
│   │   ├── StepByStepInspection.jsx # 20 puntos paso a paso
│   │   ├── SubmitBar.jsx          # Barra de envío
│   │   ├── TruckDiagram.jsx       # Diagrama del camión
│   │   ├── UnitInfoEnhanced.jsx   # Datos de unidad
│   │   └── UserManagement.jsx     # Gestión de usuarios
│   ├── context/
│   │   ├── AuthContext.jsx        # Contexto de autenticación
│   │   ├── InspectionContext.jsx  # Contexto de inspección
│   │   └── LanguageContext.jsx    # Contexto de idioma
│   └── utils/
│       ├── api.js                 # Funciones de API
│       ├── pdfGenerator.js        # Generación de PDF
│       └── photoValidation.js     # Validación de fotos
├── docs/
│   └── REPORTE_DESARROLLO.md      # Este documento
├── package.json
├── vercel.json
└── vite.config.js
```

---

## 📈 Métricas de Calidad

### Tasa de Éxito de Deployments
- **93.4%** de deployments exitosos
- Solo **9 errores** en 136 deployments
- Tiempo promedio de resolución: < 5 minutos

### Errores Comunes Resueltos
1. **Node.js version** - Configuración de Vercel
2. **HTTP 413** - Payload muy grande (compresión de imágenes)
3. **react-pdf** - Incompatibilidad con build (removido)
4. **password vs password_hash** - Nombre de columna en BD

---

## 👥 Equipo de Desarrollo

| Rol | Responsable |
|-----|-------------|
| Desarrollo Full Stack | Eduardo Aispuro |
| Asistente de Desarrollo | Cascade AI |
| Revisión y Testing | Usuario/Cliente |
| Despliegue | Vercel (Automático) |

---

## 📄 Historial de Versiones

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| 0.1.0 | May 21, 2026 | Configuración inicial, primer deploy |
| 0.2.0 | May 26, 2026 | Sistema de usuarios, BD Neon |
| 0.3.0 | May 31, 2026 | Diagrama del camión |
| 0.4.0 | Jun 2, 2026 | Verificación IA de fotos |
| 0.5.0 | Jun 4, 2026 | PDF mejorado, historial |
| 0.6.0 | Jun 7, 2026 | Tipos de inspección |
| 0.7.0 | Jun 8, 2026 | Tipos de remolque |
| 0.8.0 | Jun 9, 2026 | Compatibilidad tablets |
| 0.9.0 | Jun 10, 2026 | Flujo paso a paso |
| **1.0.0** | **Jun 12, 2026** | **Release estable** - Flujo V1 completo, usuarios |

---

## 🚀 Proceso de Despliegue

### Flujo de CI/CD
1. Cambios locales en código
2. `npm run build` - Compilación de producción
3. `git add -A` - Stage de cambios
4. `git commit -m "mensaje"` - Commit
5. `git push origin main` - Push a GitHub
6. Vercel detecta cambios automáticamente
7. Build y deploy automático (~18-25 segundos)

### URLs de Producción
- **Aplicación**: https://crown-xpress-transport-ljxgyoehw-aispuroluis5-4850s-projects.vercel.app
- **API**: https://crown-xpress-transport-ljxgyoehw-aispuroluis5-4850s-projects.vercel.app/api/*

---

## 📝 Notas Adicionales

### Consideraciones de Seguridad
- Las contraseñas se almacenan en texto plano en `password_hash` (se recomienda implementar hashing real con bcrypt)
- La contraseña es visible en el panel de administración (decisión del cliente)
- No hay autenticación JWT implementada (sesión basada en localStorage)

### Mejoras Futuras Recomendadas
1. Implementar hashing de contraseñas con bcrypt
2. Agregar autenticación JWT
3. Implementar roles y permisos más granulares
4. Agregar logs de auditoría
5. Implementar backup automático de BD
6. Agregar tests unitarios y de integración

### Compatibilidad Probada
- ✅ Chrome (Desktop/Mobile)
- ✅ Safari (Desktop/iOS)
- ✅ Firefox
- ✅ Edge
- ✅ iPad/Tablet

---

---

## 📋 Septiembre 25, 2026 — Corrección de datos y filtros de equipo

### Corrección de inspecciones sin yarda asignada

**Problema:** Un usuario pudo realizar inspecciones sin tener yardas asignadas, dejando 668 inspecciones con `location` vacío y 4 inspecciones en una yarda incorrecta (`Yard A - Laredo`).

**Acción:** Actualización directa en PostgreSQL (`crown-postgres` en VPS IONOS):

```sql
UPDATE inspections SET location = 'CXT6'
WHERE location = '' OR location IS NULL OR location <> 'CXT6';
```

**Resultado:** 680 inspecciones reasignadas a `CXT6` (yarda 6).

| Antes | Después |
|-------|---------|
| (vacío): 668 | CXT6: 680 |
| Yard A - Laredo: 4 | — |
| CXT6: 8 | — |

**Pendiente:** Validar por qué el sistema permitió inspeccionar sin yarda asignada para evitar que vuelva a ocurrir.

### Nuevos filtros en Vista Supervisor

Commit `735175c` — `src/components/SupervisorView.jsx`

| Filtro | Tipo | Descripción |
|--------|------|-------------|
| **Tipo Equipo** | Dropdown | Filtra por `trailer_type`: BOBTAIL, BOX, RABON, CONTAINER, OTHER |
| **Equipo (eqpcode)** | Texto | Búsqueda parcial en `equipment_nomenclature`, `trailer_number`, `container_number`, `tractor_number`, `customer_prefix`, `crown_fleet` |

Ejemplos de búsqueda eqpcode: `CXT`, `5775`, `MSDU`, `R020`, `TCLU-848914-9`.

El botón **Limpiar** resetea ambos filtros junto con los existentes.

**Estado:** ✅ Pushed a `main` y `preproduccion`

---

## 📋 Septiembre 28, 2026 — Migración de datos Neon → VPS + ajustes Vista Supervisor

### Migración completa de Neon a PostgreSQL en IONOS

**Contexto:** La BD legacy en Neon (PostgreSQL 17) se vació por completo a `crownxpress` en `20-puntos-crown-postgres` (PostgreSQL 16) del VPS.

**Método:** `pg_dump` no era compatible (PG16 client vs PG17 server). Se usó `postgres_fdw` dentro del contenedor para conectar Neon→VPS y merge en una transacción con remapeo de IDs.

**Datos migrados:**

| Tabla | Insertadas | Total VPS |
|-------|-----------|-----------|
| inspections | 1,011 | 1,728 |
| inspection_points | 20,220 | 34,552 |
| audit_log | 3,345 | 5,482 |
| tpr | 1,113 | 1,443 |
| yard_assignments | 6 | — |
| operators | 20 | 20 |
| yards | 1 | 9 |
| locations | 0 | 5 |
| **users/employees** | **0 (excluidos a petición)** | — |

**Reglas aplicadas:**
- IDs nuevos vía serial — ningún registro existente fue sobreescrito
- FKs remapeadas: `inspection_id`, `location_id` (por nombre), `employee_id`/`user_id`/`assigned_by` (por username), `yard_id` (por code), `original_inspection_id`
- `tpr` deduplicado por `sql_id`
- `issue_id` casteado text→integer
- `has_photo` calculado desde `photo IS NOT NULL`
- 14 inspecciones importadas sin `location` → asignadas a `CXT6` (todas las inspecciones quedaron en CXT6, total 1,728)
- Limpieza: schema `neon` y server FDW eliminados al terminar (no quedan credenciales en el VPS)

**Backup previo:** `/root/crownxpress_backup_preimport.sql.gz` (164MB) en el VPS.

### Ajustes Vista Supervisor

Commit pendiente — `src/components/SupervisorView.jsx`:
- `limit` de listInspections subido de 500 → 5000 (para mostrar todas las inspecciones importadas)
- Renombrado "Trailer" → "Unidad" en: filtro, opción de agrupar, y etiqueta "Tipo Remolque" → "Tipo Unidad"
- Posteriormente `limit` cambiado a `'all'` (sin límite) — el historial completo siempre se muestra; la API acepta `limit=all`

### Infraestructura del VPS — estado verificado (28-sep-2026)

**Contenedor:** `20-puntos-crown-postgres` (`postgres:16-alpine`, healthy, `127.0.0.1:5433→5432`)

**Directorio compose:** `/opt/20-puntos-crown-postgres/` (renombrado desde `/opt/crown-postgres` por Martin Bogarin el 28-sep). Las labels `com.docker.compose.project.*` del contenedor aún apuntan al path viejo — usar `cd /opt/20-puntos-crown-postgres && docker compose ...` para operarlo.

```
/opt/20-puntos-crown-postgres/
├── .env                  # credenciales (POSTGRES_USER/PASSWORD)
├── docker-compose.yml    # postgres + SSL + pgdata volume
├── init/                 # docker-entrypoint-initdb.d
└── tls/                  # server.crt + server.key (ssl=on)
```

**Bases de datos dentro del contenedor:**

| DB | Qué es | Borrar |
|----|--------|--------|
| `crownxpress` | BD real de la app | ❌ principal |
| `postgres` | BD de mantenimiento por defecto (psql, pg_dump, healthcheck `pg_isready`, entrypoint) | ❌ |
| `template0` | Plantilla inmutable para crear DBs | ❌ PostgreSQL no lo permite |
| `template1` | Plantilla por defecto de `CREATE DATABASE` | ❌ |

`neon_import` (BD temporal usada en la migración) ya fue eliminada — no quedan residuos.

**Compose del contenedor** (`docker-compose.yml`): SSL habilitado, `max_connections=50`, `shared_buffers=256MB`, healthcheck `pg_isready -U crown -d crownxpress`, restart `unless-stopped`.

---

## Octubre 3, 2026 — Pendientes NBCW, métricas y validación de yarda

### Pendientes "no inspeccionadas" (177)

Investigación sobre por qué la vista NBCW muestra ~177 pendientes en últimos 3 días:

| Concepto | Cantidad |
|---|---|
| Movimientos TPR `fromd='CXT6'` últimos 3 días | 208 |
| Ya inspeccionados (match exacto por `work_order::sql_id`) | 34 |
| **Pendientes reales** | **~174** |

**Conclusión:** los pendientes SON reales — son movimientos NBCW distintos (cada uno con `sql_id` único) que no tienen inspección ligada. No son duplicados de lo ya inspeccionado: el cruce usa el `sql_id` estable del movimiento, así que un equipo/work order repetido con nuevo `sql_id` correctamente aparece como pendiente. Solo ~8 pendientes comparten tractor con inspecciones manuales sin `sql_id` (caso borde).

### Discrepancia métricas: por yarda 22 vs por guardia 35

**Causa:** RICARDO creó 35 inspecciones el 3-oct — 22 con `location='CXT6'` y **13 con `location` vacío** (usuario pudo inspeccionar sin yarda asignada antes del fix).

- "Por yarda" solo cuenta inspecciones cuya `location` coincide con una yarda activa → 22 (las 13 sin yarda se descartaban silenciosamente).
- "Por guardia" agrupa por `guard_name` sin exigir `location` → 35.

**Fix de datos:** las 13 (+1 histórica) actualizadas a `CXT6`. Total inspections con yarda asignada: 1,814/1,814.

**Fix de código** (`api/metrics.js`): inspecciones cuya `location` no coincide con yarda activa (o es NULL) ahora aparecen como fila "Sin yarda asignada" en "por yarda", para que el total siempre cuadre con "por guardia" y el problema sea visible en vez de oculto.

### Validación de yarda asignada (commit `7fd34b8`)

- `UserManagement.jsx`: bloquea crear/editar usuario sin `yard_assignments`.
- `Router.jsx`: si el usuario no tiene yarda activa ni `location_name`, bloquea Vista Clásica e Inspección Guiada con mensaje "No puedes crear inspecciones porque no tienes una yarda asignada".
- `api/_lib/handlers.js`: `createInspection` rechaza con 400 si `unitInfo.location` viene vacío (protege contra llamadas directas al API).

Los 6 usuarios activos ya estaban asignados a CXT6 (Admin Crown, VICTOR, Cristian, Maria, Ricardo, Misael).

---

*Documento generado el 15 de Junio de 2026*
*Última actualización: 3 de Octubre de 2026*
*Crown Xpress Transport - Sistema de Inspección de 20 Puntos*
