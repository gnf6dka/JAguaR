
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import packageJson from '../package.json'

const basePanelStyle = {
  borderRadius: 14,
  borderWidth: 2,
  borderStyle: 'dashed',
  padding: 32,
  textAlign: 'center',
  cursor: 'pointer'
}

const themes = {
  dark: {
    appBg: '#11161f',
    text: '#e8edf7',
    mutedText: '#9fb0d2',
    panelBg: '#222d40',
    panelBgActive: '#2c3a54',
    panelBorder: '#6f90ff',
    panelBorderActive: '#9bb3ff',
    statusBg: '#1b2434',
    statusBorder: '#2f3d58',
    statusSuccess: '#71e681',
    statusExport: '#7fcfff',
    errorBg: '#3a1f2a',
    errorBorder: '#86415a',
    errorText: '#ffb8cb',
    mismatchBg: '#3e3121',
    mismatchBorder: '#8b6a3a',
    mismatchTextAreaBg: '#2f2418',
    mismatchTextAreaBorder: '#8b6a3a',
    editorBg: '#141b28',
    editorBorder: '#344566',
    buttonBg: '#2f57e5',
    buttonText: '#f6f8ff',
    buttonBorder: '#5074f2'
  },
  light: {
    appBg: '#f5f7fc',
    text: '#12213f',
    mutedText: '#46567b',
    panelBg: '#eef3ff',
    panelBgActive: '#dce8ff',
    panelBorder: '#5074f2',
    panelBorderActive: '#2f57e5',
    statusBg: '#f4f7ff',
    statusBorder: '#d3dcf5',
    statusSuccess: '#1f7a1f',
    statusExport: '#3d8bff',
    errorBg: '#ffe8e8',
    errorBorder: '#ffc6c6',
    errorText: '#8a1f1f',
    mismatchBg: '#fff4db',
    mismatchBorder: '#f3d28a',
    mismatchTextAreaBg: '#fffaf0',
    mismatchTextAreaBorder: '#d8bc78',
    editorBg: '#ffffff',
    editorBorder: '#c6d1f0',
    buttonBg: '#2f57e5',
    buttonText: '#f6f8ff',
    buttonBorder: '#5074f2'
  }
}

const trailPresets = {
  load: {
    color: 'rgba(68, 126, 255, 0.95)',
    edge: 'rgba(145, 188, 255, 0.35)',
    count: 2
  },
  sync: {
    color: 'rgba(73, 232, 139, 0.95)',
    edge: 'rgba(168, 255, 206, 0.35)',
    count: 2
  },
  save: {
    color: 'rgba(64, 243, 134, 0.98)',
    edge: 'rgba(198, 255, 223, 0.4)',
    count: 3
  }
}

const initialStatusText = 'Očekáván JAR, ZIP nebo složka.'
const appVersion = packageJson.version

function TrailLayer({ trails }) {
  return (
    <>
      <style>
        {`@keyframes colorTrailSweep {
          0% { transform: translate3d(0, 0, 0) scaleX(0.82); opacity: 0; }
          12% { opacity: 1; }
          60% { opacity: 0.56; }
          100% { transform: translate3d(138vw, 0, 0) scaleX(1.24); opacity: 0; }
        }`}
      </style>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {trails.map((trail) => (
          <div
            key={trail.id}
            style={{
              position: 'absolute',
              left: '-42vw',
              top: `${trail.top}%`,
              width: '38vw',
              height: trail.height,
              borderRadius: 999,
              background: `linear-gradient(90deg, transparent 0%, ${trail.edge} 18%, ${trail.color} 52%, transparent 100%)`,
              filter: `blur(${trail.blur}px)`,
              animation: `colorTrailSweep ${trail.duration}ms cubic-bezier(0.2, 0.6, 0.2, 1) forwards`,
              animationDelay: `${trail.delay}ms`,
              transform: `rotate(${trail.rotate}deg)`,
              opacity: 0
            }}
          />
        ))}
      </div>
    </>
  )
}

function App() {
  const [themeMode, setThemeMode] = useState(() => {
    const savedTheme = window.localStorage.getItem('themeMode')
    return savedTheme === 'light' ? 'light' : 'dark'
  })
  const [meta, setMeta] = useState(null)
  const [editorText, setEditorText] = useState('')
  const [needsValidation, setNeedsValidation] = useState(false)
  const [status, setStatus] = useState(initialStatusText)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [isFolderDragActive, setIsFolderDragActive] = useState(false)
  const [trails, setTrails] = useState([])
  const trailIdRef = useRef(0)
  const trailTimeoutsRef = useRef([])
  const theme = themes[themeMode]

  const spawnTrails = useCallback((kind) => {
    const preset = trailPresets[kind]
    if (!preset) {
      return
    }

    const nowItems = []
    for (let i = 0; i < preset.count; i += 1) {
      const id = trailIdRef.current
      trailIdRef.current += 1
      const duration = 720 + Math.round(Math.random() * 380)
      const delay = i * 70
      nowItems.push({
        id,
        color: preset.color,
        edge: preset.edge,
        top: 16 + Math.random() * 64,
        rotate: -7 + Math.random() * 14,
        height: 8 + Math.random() * 12,
        blur: 2 + Math.random() * 3,
        duration,
        delay
      })

      const timeoutId = window.setTimeout(() => {
        setTrails((prev) => prev.filter((entry) => entry.id !== id))
      }, duration + delay + 80)
      trailTimeoutsRef.current.push(timeoutId)
    }

    setTrails((prev) => [...prev, ...nowItems])
  }, [])

  useEffect(() => {
    return () => {
      trailTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      trailTimeoutsRef.current = []
    }
  }, [])

  useEffect(() => {
    let disposed = false
    const applyThemeFromMain = (mode) => {
      if (disposed) {
        return
      }
      setThemeMode(mode === 'light' ? 'light' : 'dark')
    }

    window.api?.getThemeMode?.().then(applyThemeFromMain).catch(() => {})
    const unsubscribe = window.api?.onThemeModeChanged?.(applyThemeFromMain)

    return () => {
      disposed = true
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    const unsubscribe = window.api?.onAppReset?.(() => {
      trailTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      trailTimeoutsRef.current = []
      setTrails([])
      setMeta(null)
      setEditorText('')
      setNeedsValidation(false)
      setStatus(initialStatusText)
      setError('')
      setBusy(false)
      setSaveBusy(false)
      setExportBusy(false)
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('themeMode', themeMode)
    document.body.style.backgroundColor = theme.appBg
    document.body.style.color = theme.text
  }, [theme, themeMode])

  const normalizedStatus = status
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  const isSavedSuccessStatus =
    normalizedStatus === 'oba manifesty byly uspesne ulozeny.' ||
    normalizedStatus === 'jar byl uspesne ulozen.' ||
    normalizedStatus === 'vnitrni jar manifest byl uspesne ulozen.'
  const isExportSuccessStatus = normalizedStatus.startsWith('manifest byl vyexportovan do ')
  const isValidationSuccessStatus = normalizedStatus === 'validace json: v poradku.'
  const isValidationFailureStatus = normalizedStatus.startsWith('validace json selhala: ')

  const resolveDropFilePath = useCallback((files, event) => {
    const [file] = files || []
    const directPath = file?.path || file?.filepath
    if (typeof directPath === 'string' && directPath.trim()) {
      return directPath
    }

    const bridgePath = window.api?.getPathForFile?.(file)
    if (typeof bridgePath === 'string' && bridgePath.trim()) {
      return bridgePath
    }

    const transferred = event?.dataTransfer?.files?.[0]
    const transferPath = transferred?.path || transferred?.filepath
    if (typeof transferPath === 'string' && transferPath.trim()) {
      return transferPath
    }

    const transferBridgePath = window.api?.getPathForFile?.(transferred)
    if (typeof transferBridgePath === 'string' && transferBridgePath.trim()) {
      return transferBridgePath
    }

    return null
  }, [])

  const onDrop = useCallback(async (files, rejections, event) => {
    setError('')

    if (!files?.length) {
      if (rejections?.length) {
        const first = rejections[0]
        const fileName = first?.file?.name || 'Soubor'
        const reason = first?.errors?.[0]?.message || 'Nepodporovany typ souboru.'
        setStatus('Soubor nebyl nacten.')
        setError(`${fileName}: ${reason}`)
      }
      return
    }

    let filePath = resolveDropFilePath(files, event)
    const isDropEvent = event?.type === 'drop'

    if (!filePath && isDropEvent) {
      setStatus('Soubor nebyl nacten.')
      setError('Pri pretazeni se nepodarilo zjistit cesta k souboru. Zkuste pretahnout z Pruzkumnika znovu.')
      return
    }

    setBusy(true)
    try {
      if (!filePath) {
        filePath = await window.api.pickManifestFile()
      }

      if (!filePath) {
        setStatus('Soubor nebyl vybran.')
        return
      }

      const loaded = await window.api.loadManifestFile(filePath)
      setMeta(loaded)
      setEditorText(loaded.editorText)
      setNeedsValidation(false)
      setStatus(loaded.message)
      spawnTrails('load')
    } catch (err) {
      setMeta(null)
      setEditorText('')
      setError(err?.message || 'Nacteni selhalo.')
    } finally {
      setBusy(false)
    }
  }, [resolveDropFilePath, spawnTrails])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/java-archive': ['.jar'],
      'application/x-java-archive': ['.jar'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/octet-stream': ['.jar', '.zip']
    }
  })

  const panelStyle = useMemo(
    () => ({
      ...basePanelStyle,
      borderColor: isDragActive ? theme.panelBorderActive : theme.panelBorder,
      background: isDragActive ? theme.panelBgActive : theme.panelBg
    }),
    [isDragActive, theme]
  )

  const folderPanelStyle = useMemo(
    () => ({
      ...basePanelStyle,
      borderColor: isFolderDragActive ? theme.panelBorderActive : theme.panelBorder,
      background: isFolderDragActive ? theme.panelBgActive : theme.panelBg
    }),
    [isFolderDragActive, theme]
  )

  const loadFolderFromPath = useCallback(async (folderPath) => {
    setBusy(true)
    setError('')
    try {
      if (!folderPath) {
        const pickedPath = await window.api.pickManifestFolder()
        if (!pickedPath) {
          setStatus('Slozka nebyla vybrana.')
          return
        }
        folderPath = pickedPath
      }

      const loaded = await window.api.loadManifestFolder(folderPath)
      setMeta(loaded)
      setEditorText(loaded.editorText)
      setNeedsValidation(false)
      setStatus(loaded.message)
      spawnTrails('load')
    } catch (err) {
      setMeta(null)
      setEditorText('')
      setError(err?.message || 'Nacteni slozky selhalo.')
    } finally {
      setBusy(false)
      setIsFolderDragActive(false)
    }
  }, [spawnTrails])

  const onFolderPanelClick = useCallback(() => {
    if (busy) {
      return
    }
    loadFolderFromPath(null)
  }, [busy, loadFolderFromPath])

  const onFolderDragEnter = useCallback((event) => {
    event.preventDefault()
    if (!busy) {
      setIsFolderDragActive(true)
    }
  }, [busy])

  const onFolderDragOver = useCallback((event) => {
    event.preventDefault()
    if (!busy) {
      setIsFolderDragActive(true)
    }
  }, [busy])

  const onFolderDragLeave = useCallback((event) => {
    event.preventDefault()
    const nextTarget = event.relatedTarget
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsFolderDragActive(false)
    }
  }, [])

  const onFolderDrop = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()

    if (busy) {
      setIsFolderDragActive(false)
      return
    }

    const droppedPath = resolveDropFilePath(Array.from(event?.dataTransfer?.files || []), event)
    if (!droppedPath) {
      setStatus('Slozka nebyla nactena.')
      setError('Pri pretazeni se nepodarilo zjistit cesta ke slozce. Zkuste pretahnout z Pruzkumnika znovu.')
      setIsFolderDragActive(false)
      return
    }

    loadFolderFromPath(droppedPath)
  }, [busy, loadFolderFromPath, resolveDropFilePath])

  const isZipLikeMeta = meta?.kind === 'zip' || meta?.kind === 'folder'

  const onSync = useCallback(async (direction) => {
    if (!meta || (meta.kind !== 'zip' && meta.kind !== 'folder')) {
      return
    }

    setBusy(true)
    setError('')
    try {
      const result = await window.api.syncZipManifest({
        ...meta,
        direction
      })
      setStatus(result.message)
      setEditorText(result.syncedText)
      setMeta((prev) => (prev
        ? {
            ...prev,
            needsSync: false,
            innerManifestText: result.innerManifestText,
            outerManifestText: result.outerManifestText
          }
        : prev))
      spawnTrails('sync')
    } catch (err) {
      setError(err?.message || 'Synchronizace selhala.')
    } finally {
      setBusy(false)
    }
  }, [meta, spawnTrails])

  const onSave = useCallback(async () => {
    if (!meta) {
      return
    }

    setBusy(true)
    setSaveBusy(true)
    setError('')
    try {
      const result = await window.api.saveManifestFile({
        ...meta,
        editorText
      })
      setEditorText(result.normalizedText)
      setStatus(result.message)
      setMeta((prev) => (prev ? { ...prev, needsSync: false } : prev))
      spawnTrails('save')
    } catch (err) {
      setError(err?.message || 'Uložení selhalo.')
    } finally {
      setSaveBusy(false)
      setBusy(false)
    }
  }, [editorText, meta, spawnTrails])

  const onExport = useCallback(async () => {
    if (!meta) {
      return
    }

    setBusy(true)
    setExportBusy(true)
    setError('')
    try {
      const result = await window.api.exportManifestFile({
        editorText,
        sourceFilePath: meta.filePath
      })

      if (result?.canceled) {
        setStatus(result.message || 'Export byl zrusen.')
        return
      }

      setEditorText(result.normalizedText)
      setStatus(result.message || 'Manifest byl vyexportovan.')
      spawnTrails('save')
    } catch (err) {
      setError(err?.message || 'Export selhal.')
    } finally {
      setExportBusy(false)
      setBusy(false)
    }
  }, [editorText, meta, spawnTrails])

  const onValidate = useCallback(() => {
    if (!meta) {
      return
    }

    setError('')
    try {
      JSON.parse(editorText)
      setNeedsValidation(false)
      setStatus('Validace JSON: v poradku.')
    } catch (err) {
      setStatus(`Validace JSON selhala: ${err?.message || 'Neplatny JSON.'}`)
    }
  }, [editorText, meta])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.appBg,
        transition: 'background-color 0.2s ease, color 0.2s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <TrailLayer trails={trails} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: themeMode === 'light'
            ? 'radial-gradient(circle at 20% 20%, rgba(67, 108, 255, 0.14), transparent 45%), radial-gradient(circle at 82% 78%, rgba(29, 186, 210, 0.16), transparent 40%)'
            : 'radial-gradient(circle at 15% 18%, rgba(102, 132, 255, 0.24), transparent 42%), radial-gradient(circle at 84% 80%, rgba(37, 192, 221, 0.2), transparent 40%)'
        }}
      />

      <div style={{ maxWidth: 980, margin: '0 auto', padding: 24, fontFamily: 'Segoe UI, sans-serif', color: theme.text, position: 'relative', zIndex: 1 }}>
        
        {/* <h1 style={{ marginTop: 0 }}>JAR Manifest Editor</h1> */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <div {...getRootProps()} style={panelStyle}>
            <input {...getInputProps()} />
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Vyberte soubor (JAR, ZIP)</p>
          </div>

          <div
            role='button'
            tabIndex={0}
            onClick={onFolderPanelClick}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onFolderPanelClick()
              }
            }}
            onDragEnter={onFolderDragEnter}
            onDragOver={onFolderDragOver}
            onDragLeave={onFolderDragLeave}
            onDrop={onFolderDrop}
            style={folderPanelStyle}
          >
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Vyberte složku</p>
          </div>
        </div>

      <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: theme.statusBg, border: `1px solid ${theme.statusBorder}` }}>
        <strong>Stav:</strong>{' '}
        <span
          style={
            isSavedSuccessStatus
              ? { color: theme.statusSuccess, fontWeight: 700 }
              : isExportSuccessStatus
                ? { color: theme.statusExport, fontWeight: 700 }
                : isValidationSuccessStatus
                  ? { color: theme.statusSuccess, fontWeight: 700 }
                  : isValidationFailureStatus
                    ? { color: theme.errorText, fontWeight: 700 }
                : undefined
          }
        >
          {status}
        </span>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: theme.errorBg, border: `1px solid ${theme.errorBorder}`, color: theme.errorText }}>
          {error}
        </div>
      )}

      {meta && (
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 14 }}>
            <div><strong>{meta.kind === 'folder' ? 'Složka:' : 'Soubor:'}</strong> {meta.filePath}</div>
            {/* <div><strong>Typ:</strong> {meta.kind.toUpperCase()}</div> */}
            <div><strong>Vnitřní manifest (relativní cesta):</strong> {meta.innerManifestDisplayPath || meta.innerManifestEntryName || 'N/A'}</div>
            {isZipLikeMeta && (
              <div>
                <strong>Vnější manifest (relativní cesta):</strong>{' '}
                {meta.outerManifestEntryName
                  ? meta.outerManifestEntryName
                  : <span style={{ color: theme.errorText, fontWeight: 700 }}>Vnější manifest nenalezen!</span>}
              </div>
            )}
          </div>

          {isZipLikeMeta && meta.needsSync && (
            <div style={{ padding: 12, borderRadius: 10, background: theme.mismatchBg, border: `1px solid ${theme.mismatchBorder}` }}>
              <div style={{ marginBottom: 8 }}>
                Externí manifest a vnitřní JAR manifest nejsou shodné.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Vnitřní manifest (v JAR)</div>
                  <textarea
                    value={meta.innerManifestText || ''}
                    readOnly
                    spellCheck={false}
                    style={{
                      width: '100%',
                      minHeight: 220,
                      borderRadius: 8,
                      border: `1px solid ${theme.mismatchTextAreaBorder}`,
                      padding: 10,
                      fontFamily: 'Consolas, monospace',
                      fontSize: 12,
                      lineHeight: 1.4,
                      boxSizing: 'border-box',
                      background: theme.mismatchTextAreaBg,
                      color: theme.text
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Vnější manifest (mimo JAR)</div>
                  <textarea
                    value={meta.outerManifestText || ''}
                    readOnly
                    spellCheck={false}
                    style={{
                      width: '100%',
                      minHeight: 220,
                      borderRadius: 8,
                      border: `1px solid ${theme.mismatchTextAreaBorder}`,
                      padding: 10,
                      fontFamily: 'Consolas, monospace',
                      fontSize: 12,
                      lineHeight: 1.4,
                      boxSizing: 'border-box',
                      background: theme.mismatchTextAreaBg,
                      color: theme.text
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => onSync('inner-to-outer')} disabled={busy} style={{ padding: '8px 14px' }}>
                  Zachovat vnitřní a kopírovat do vnějšího
                </button>
                <button onClick={() => onSync('outer-to-inner')} disabled={busy} style={{ padding: '8px 14px' }}>
                  Zachovat vnější a kopírovat do vnitřního
                </button>
              </div>
            </div>
          )}

          <textarea
            value={editorText}
            onChange={(e) => {
              setEditorText(e.target.value)
              setNeedsValidation(true)
            }}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 380,
              borderRadius: 10,
              border: `1px solid ${theme.editorBorder}`,
              padding: 14,
              fontFamily: 'Consolas, monospace',
              fontSize: 14,
              lineHeight: 1.45,
              boxSizing: 'border-box',
              background: theme.editorBg,
              color: theme.text
            }}
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onValidate}
              disabled={busy}
              style={{
                padding: '10px 18px',
                fontWeight: 600,
                borderRadius: 10,
                border: needsValidation ? '2px solid #e53935' : '1px solid #888888',
                background: '#4a4a4a',
                color: '#b0b0b0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Kontrola
            </button>
            <button
              onClick={onSave}
              disabled={busy}
              style={{
                padding: '10px 18px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #71e681',
                background: '#2a5a3a',
                color: '#71e681',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
              </svg>
              {saveBusy ? 'Probíhá...' : 'Uložit'}
            </button>
            <button
              onClick={onExport}
              disabled={busy}
              style={{
                padding: '10px 18px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #448aff',
                background: '#1f3a66',
                color: '#7ccfff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              {exportBusy ? 'Probíhá...' : 'Export'}
            </button>
          </div>
        </div>
      )}

      {!meta && (
        <p style={{ marginTop: 14, fontSize: 14, color: theme.mutedText }}>
          Zobrazí se manifest aplikace a bude možné jej upravit, uložit, exportovat.
        </p>
      )}

      <footer
        style={{
          marginTop: 24,
          paddingTop: 12,
          borderTop: `1px solid ${theme.statusBorder}`,
          fontSize: 12,
          color: theme.mutedText,
          textAlign: 'right'
        }}
      >
        Verze aplikace: {appVersion}, Author: gnf6dka
      </footer>
      </div>
    </div>
  )
}

export default App
