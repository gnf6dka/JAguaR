
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

function formatFlagPath(pathParts) {
  return pathParts.reduce((label, part, index) => {
    if (typeof part === 'number') {
      return `${label}[${part}]`
    }

    if (index === 0) {
      return part
    }

    return `${label}.${part}`
  }, '')
}

function collectBooleanFlags(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }

  return Object.entries(value)
    .filter(([, nestedValue]) => typeof nestedValue === 'boolean')
    .map(([key, nestedValue]) => ({
      path: [key],
      label: formatFlagPath([key]),
      value: nestedValue
    }))
}

function setValueAtPath(value, pathParts, nextValue) {
  if (!pathParts.length) {
    return nextValue
  }

  const [currentPart, ...restPath] = pathParts

  if (Array.isArray(value)) {
    return value.map((item, index) => (
      index === currentPart ? setValueAtPath(item, restPath, nextValue) : item
    ))
  }

  if (value && typeof value === 'object') {
    return {
      ...value,
      [currentPart]: setValueAtPath(value[currentPart], restPath, nextValue)
    }
  }

  return value
}

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

  // Version change modal: 'closed' | 'input' | 'busy' | 'result'
  const [versionModalStep, setVersionModalStep] = useState('closed')
  const [newVersionInput, setNewVersionInput] = useState('')
  const [versionChangeResult, setVersionChangeResult] = useState(null)

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
    normalizedStatus === 'oba manifesty byly úspěšně uloženy.' ||
    normalizedStatus === 'jar byl úspěšně uložen.' ||
    normalizedStatus === 'vnitřní jar manifest byl úspěšně uložen.'
  const isExportSuccessStatus = normalizedStatus.startsWith('manifest byl vyexportován do ')
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
        const reason = first?.errors?.[0]?.message || 'Nepodporovaný typ souboru.'
        setStatus('Soubor nebyl načten.')
        setError(`${fileName}: ${reason}`)
      }
      return
    }

    let filePath = resolveDropFilePath(files, event)
    const isDropEvent = event?.type === 'drop'

    if (!filePath && isDropEvent) {
      setStatus('Soubor nebyl načten.')
      setError('Při přetažení se nepodařilo zjistit cestu k souboru. Zkuste přetáhnout z Průzkumníka znovu.')
      return
    }

    setBusy(true)
    try {
      if (!filePath) {
        filePath = await window.api.pickManifestFile()
      }

      if (!filePath) {
        setStatus('Soubor nebyl vybrán.')
        return
      }

      const loaded = await window.api.loadManifestFile(filePath)
      setMeta(loaded)
      setEditorText(loaded.editorText)
      setStatus(loaded.message)
      spawnTrails('load')
    } catch (err) {
      setMeta(null)
      setEditorText('')
      setError(err?.message || 'Načtení selhalo.')
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

  const parsedEditorState = useMemo(() => {
    try {
      const parsed = JSON.parse(editorText)
      const isStructured = parsed !== null && typeof parsed === 'object'
      return {
        parsed,
        isStructured,
        error: null
      }
    } catch (parseError) {
      return {
        parsed: null,
        isStructured: false,
        error: parseError
      }
    }
  }, [editorText])

  const booleanFlags = useMemo(() => {
    if (!parsedEditorState.isStructured) {
      return []
    }

    return collectBooleanFlags(parsedEditorState.parsed)
  }, [parsedEditorState])

  const loadFolderFromPath = useCallback(async (folderPath) => {
    setBusy(true)
    setError('')
    try {
      if (!folderPath) {
        const pickedPath = await window.api.pickManifestFolder()
        if (!pickedPath) {
          setStatus('Složka nebyla vybrána.')
          return
        }
        folderPath = pickedPath
      }

      const loaded = await window.api.loadManifestFolder(folderPath)
      setMeta(loaded)
      setEditorText(loaded.editorText)
      setStatus(loaded.message)
      spawnTrails('load')
    } catch (err) {
      setMeta(null)
      setEditorText('')
      setError(err?.message || 'Načtení složky selhalo.')
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
      setStatus('Složka nebyla načtena.')
      setError('Při přetažení se nepodařilo zjistit cestu ke složce. Zkuste přetáhnout z Průzkumníka znovu.')
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
        setStatus(result.message || 'Export byl zrušen.')
        return
      }

      setEditorText(result.normalizedText)
      setStatus(result.message || 'Manifest byl vyexportován.')
      spawnTrails('save')
    } catch (err) {
      setError(err?.message || 'Export selhal.')
    } finally {
      setExportBusy(false)
      setBusy(false)
    }
  }, [editorText, meta, spawnTrails])

  const applyEditorChange = useCallback((nextText) => {
    if (!meta) {
      return
    }

    setEditorText(nextText)
    setError('')

    try {
      JSON.parse(nextText)
      setStatus('Validace JSON: v pořádku.')
    } catch (err) {
      setStatus(`Validace JSON selhala: ${err?.message || 'Neplatný JSON.'}`)
    }
  }, [meta])

  const onToggleFlag = useCallback((flagPath) => {
    if (!parsedEditorState.isStructured) {
      return
    }

    let currentValue = parsedEditorState.parsed
    for (const pathPart of flagPath) {
      currentValue = currentValue?.[pathPart]
    }

    if (typeof currentValue !== 'boolean') {
      return
    }

    const nextManifest = setValueAtPath(parsedEditorState.parsed, flagPath, !currentValue)
    applyEditorChange(JSON.stringify(nextManifest, null, 2))
  }, [applyEditorChange, parsedEditorState])

  const currentManifestVersion = useMemo(() => {
    if (!parsedEditorState.isStructured) return null
    const p = parsedEditorState.parsed
    return p?.version ?? p?.Version ?? p?.appVersion ?? null
  }, [parsedEditorState])

  const onOpenVersionModal = useCallback(() => {
    setNewVersionInput('')
    setVersionChangeResult(null)
    setVersionModalStep('input')
  }, [])

  const onConfirmVersionChange = useCallback(async () => {
    if (!meta || !newVersionInput.trim() || !currentManifestVersion) return

    setVersionModalStep('busy')
    try {
      const result = await window.api.changeVersion({
        ...meta,
        oldVersion: String(currentManifestVersion),
        newVersion: newVersionInput.trim()
      })
      setVersionChangeResult({ changedFiles: result.changedFiles, error: null })
      if (result.newManifestText) {
        setEditorText(result.newManifestText)
      }
      setStatus(`Verze změněna z "${currentManifestVersion}" na "${newVersionInput.trim()}".`)
      setVersionModalStep('result')
    } catch (err) {
      setVersionChangeResult({ changedFiles: [], error: err?.message || 'Změna verze selhala.' })
      setVersionModalStep('result')
    }
  }, [meta, newVersionInput, currentManifestVersion])

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
        {!meta && (
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
        )}

      <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: theme.statusBg, border: `1px solid ${theme.statusBorder}` }}>
        <strong>Stav:</strong>{' '}
        <span
          style={
            isSavedSuccessStatus
              ? { color: theme.statusSuccess, fontWeight: 700 }
              : isExportSuccessStatus
                ? { color: theme.statusExport, fontWeight: 700 }
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

          <div
            style={{
              padding: 14,
              borderRadius: 10,
              border: `1px solid ${theme.statusBorder}`,
              background: theme.statusBg,
              display: 'grid',
              gap: 10
            }}
          >
            {/* <div style={{ fontWeight: 700 }}>Boolean flagy z manifestu</div> */}

            {parsedEditorState.error && (
              <div style={{ color: theme.errorText }}>
                Flagy jsou dostupné až po načtení validního JSONu.
              </div>
            )}

            {!parsedEditorState.error && !booleanFlags.length && (
              <div style={{ color: theme.mutedText }}>
                V aktuálním manifestu nejsou žádné boolean hodnoty.
              </div>
            )}

            {!!booleanFlags.length && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {booleanFlags.map((flag) => (
                  <label
                    key={flag.label}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 999,
                      border: `1px solid ${theme.editorBorder}`,
                      background: theme.editorBg,
                      color: theme.text,
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type='checkbox'
                      checked={flag.value}
                      onChange={() => onToggleFlag(flag.path)}
                    />
                    <span style={{ fontFamily: 'Consolas, monospace', fontSize: 13 }}>{flag.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <textarea
            value={editorText}
            onChange={(e) => {
              applyEditorChange(e.target.value)
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
            <button
              onClick={onOpenVersionModal}
              disabled={busy}
              style={{
                padding: '10px 18px',
                fontWeight: 600,
                borderRadius: 10,
                border: '1px solid #9b7cff',
                background: '#2a1f4a',
                color: '#c4a8ff',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 12 9 12"/>
                <path d="M3 12l4-4M3 12l4 4"/>
                <polyline points="21 12 15 12"/>
                <path d="M21 12l-4-4M21 12l-4 4"/>
              </svg>
              Změnit číslo verze
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
        Verze aplikace: {appVersion}, Dev: gnf6dka
      </footer>
      </div>

      {/* Version change modal */}
      {versionModalStep !== 'closed' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && versionModalStep !== 'busy') {
              setVersionModalStep('closed')
            }
          }}
        >
          <div
            style={{
              background: theme.panelBg,
              border: `1px solid ${theme.panelBorder}`,
              borderRadius: 14,
              padding: 28,
              minWidth: 400,
              maxWidth: 580,
              width: '90vw',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
            }}
          >
            {versionModalStep === 'input' && (
              <>
                <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 18 }}>Změnit číslo verze</h2>

                {currentManifestVersion != null ? (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ marginBottom: 12, fontSize: 14 }}>
                      Aktuální verze z manifestu:{' '}
                      <code
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: theme.editorBg,
                          border: `1px solid ${theme.editorBorder}`,
                          fontFamily: 'Consolas, monospace',
                          fontSize: 13
                        }}
                      >
                        {String(currentManifestVersion)}
                      </code>
                    </div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
                      Nová verze:
                    </label>
                    <input
                      type="text"
                      value={newVersionInput}
                      onChange={(e) => setNewVersionInput(e.target.value)}
                      placeholder="Zadejte nové číslo verze…"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newVersionInput.trim()) onConfirmVersionChange()
                        if (e.key === 'Escape') setVersionModalStep('closed')
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: `1px solid ${theme.editorBorder}`,
                        background: theme.editorBg,
                        color: theme.text,
                        fontFamily: 'Consolas, monospace',
                        fontSize: 14,
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: theme.mutedText }}>
                      Všechny výskyty řetězce &quot;{String(currentManifestVersion)}&quot; budou nahrazeny v každém souboru uvnitř JAR.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      marginBottom: 20,
                      padding: 12,
                      borderRadius: 8,
                      background: theme.errorBg,
                      border: `1px solid ${theme.errorBorder}`,
                      color: theme.errorText,
                      fontSize: 14
                    }}
                  >
                    Pole &quot;version&quot; nebylo nalezeno v manifestu. Změna verze není možná.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setVersionModalStep('closed')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      border: `1px solid ${theme.editorBorder}`,
                      background: 'transparent',
                      color: theme.text,
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    Zrušit
                  </button>
                  {currentManifestVersion != null && (
                    <button
                      onClick={onConfirmVersionChange}
                      disabled={!newVersionInput.trim()}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 8,
                        border: `1px solid ${theme.buttonBorder}`,
                        background: theme.buttonBg,
                        color: theme.buttonText,
                        fontWeight: 600,
                        cursor: newVersionInput.trim() ? 'pointer' : 'not-allowed',
                        opacity: newVersionInput.trim() ? 1 : 0.5,
                        fontSize: 14
                      }}
                    >
                      Potvrdit
                    </button>
                  )}
                </div>
              </>
            )}

            {versionModalStep === 'busy' && (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 15, color: theme.mutedText }}>
                Probíhá změna verze, čekejte…
              </div>
            )}

            {versionModalStep === 'result' && versionChangeResult && (
              <>
                <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 18 }}>
                  {versionChangeResult.error ? 'Chyba při změně verze' : 'Změna verze dokončena'}
                </h2>

                {versionChangeResult.error ? (
                  <div
                    style={{
                      marginBottom: 20,
                      padding: 12,
                      borderRadius: 8,
                      background: theme.errorBg,
                      border: `1px solid ${theme.errorBorder}`,
                      color: theme.errorText,
                      fontSize: 14
                    }}
                  >
                    {versionChangeResult.error}
                  </div>
                ) : (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ marginBottom: 10, fontSize: 14 }}>
                      Změna provedena v <strong>{versionChangeResult.changedFiles.length}</strong> souboru/souborech:
                    </div>
                    {versionChangeResult.changedFiles.length > 0 ? (
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 20,
                          fontFamily: 'Consolas, monospace',
                          fontSize: 12,
                          lineHeight: 1.7,
                          color: theme.mutedText,
                          maxHeight: 260,
                          overflowY: 'auto'
                        }}
                      >
                        {versionChangeResult.changedFiles.map((f, i) => (
                          <li key={i} style={{ color: theme.text }}>{f}</li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ color: theme.mutedText, fontSize: 14 }}>
                        Žádné soubory neobsahovaly hledaný řetězec.
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setVersionModalStep('closed')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      border: `1px solid ${theme.buttonBorder}`,
                      background: theme.buttonBg,
                      color: theme.buttonText,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    Zavřít
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
