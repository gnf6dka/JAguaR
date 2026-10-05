
import Editor from '@monaco-editor/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
    buttonBorder: '#5074f2',
    scrollbarTrack: 'rgba(20, 27, 40, 0.92)',
    scrollbarThumb: 'rgba(103, 141, 255, 0.72)',
    scrollbarThumbHover: 'rgba(145, 176, 255, 0.92)',
    scrollbarThumbBorder: 'rgba(17, 22, 31, 0.95)',
    scrollbarCorner: 'rgba(20, 27, 40, 0.7)'
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
    buttonBorder: '#5074f2',
    scrollbarTrack: 'rgba(222, 232, 255, 0.92)',
    scrollbarThumb: 'rgba(79, 116, 243, 0.58)',
    scrollbarThumbHover: 'rgba(47, 87, 229, 0.82)',
    scrollbarThumbBorder: 'rgba(245, 247, 252, 0.96)',
    scrollbarCorner: 'rgba(222, 232, 255, 0.8)'
  }
}

const monacoThemes = {
  dark: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '7CCFFF', fontStyle: 'bold' },
      { token: 'string.value.json', foreground: '8FE388' },
      { token: 'number.json', foreground: 'FFC56E' },
      { token: 'keyword.json', foreground: 'FF9AB1', fontStyle: 'bold' },
      { token: 'delimiter.bracket.json', foreground: 'D7E3FF' },
      { token: 'delimiter.array.json', foreground: 'AABEFF' }
    ],
    colors: {
      'editor.background': themes.dark.editorBg,
      'editor.foreground': themes.dark.text,
      'editorLineNumber.foreground': '#61708C',
      'editorLineNumber.activeForeground': '#E8EDF7',
      'editorCursor.foreground': '#7CCFFF',
      'editor.selectionBackground': '#355FC955',
      'editor.inactiveSelectionBackground': '#355FC933',
      'editorGutter.background': themes.dark.editorBg,
      'editor.foldBackground': '#355FC92A'
    }
  },
  light: {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '1E63D6', fontStyle: 'bold' },
      { token: 'string.value.json', foreground: '2D7A2D' },
      { token: 'number.json', foreground: 'C76800' },
      { token: 'keyword.json', foreground: 'B03060', fontStyle: 'bold' },
      { token: 'delimiter.bracket.json', foreground: '41598C' },
      { token: 'delimiter.array.json', foreground: '5876C5' }
    ],
    colors: {
      'editor.background': themes.light.editorBg,
      'editor.foreground': themes.light.text,
      'editorLineNumber.foreground': '#7A8AAB',
      'editorLineNumber.activeForeground': '#12213F',
      'editorCursor.foreground': '#1E63D6',
      'editor.selectionBackground': '#8EB6FF55',
      'editor.inactiveSelectionBackground': '#8EB6FF33',
      'editorGutter.background': themes.light.editorBg,
      'editor.foldBackground': '#8EB6FF24'
    }
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

const initialStatusText = 'Nahrajte JAR, ZIP nebo složku.'
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

function ScrollbarStyles({ theme }) {
  return (
    <style>
      {`
        html {
          scrollbar-color: ${theme.scrollbarThumb} ${theme.scrollbarTrack};
          scrollbar-width: thin;
        }

        body,
        textarea,
        ul,
        div {
          scrollbar-color: ${theme.scrollbarThumb} ${theme.scrollbarTrack};
        }

        *::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }

        *::-webkit-scrollbar-track {
          background: ${theme.scrollbarTrack};
          border-radius: 999px;
        }

        *::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, ${theme.scrollbarThumbHover} 0%, ${theme.scrollbarThumb} 100%);
          border: 3px solid ${theme.scrollbarThumbBorder};
          border-radius: 999px;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }

        *::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, ${theme.scrollbarThumbHover} 0%, ${theme.scrollbarThumbHover} 100%);
        }

        *::-webkit-scrollbar-corner {
          background: ${theme.scrollbarCorner};
        }

        textarea,
        ul {
          scrollbar-gutter: stable;
        }
      `}
    </style>
  )
}

function decodeSsoaToken(token) {
  const parts = token.trim().split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    return { valid: false, error: 'Token musí obsahovat header, payload a podpis oddělené tečkami.' }
  }

  try {
    const decodePart = (part) => {
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
      const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
      return JSON.parse(new TextDecoder().decode(bytes))
    }
    const header = decodePart(parts[0])
    const payload = decodePart(parts[1])

    if (!header || typeof header !== 'object' || Array.isArray(header) || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { valid: false, error: 'Header a payload musí být JSON objekty.' }
    }

    return { valid: true, header, payload, error: '' }
  } catch (err) {
    return { valid: false, error: `Neplatný token: ${err?.message || 'header nebo payload není validní JSON.'}` }
  }
}

function JsonPreview({ value, theme, beforeMount }) {
  return (
    <Editor
      height="100%"
      language="json"
      theme={theme}
      value={value}
      beforeMount={beforeMount}
      options={{
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        lineNumbers: 'off',
        folding: true,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        fontSize: 12,
        padding: { top: 10, bottom: 10 },
        automaticLayout: true
      }}
    />
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
  const [isEditorExpanded, setIsEditorExpanded] = useState(false)
  const [isFolderDragActive, setIsFolderDragActive] = useState(false)
  const [isFileDragActive, setIsFileDragActive] = useState(false)
  const [trails, setTrails] = useState([])
  const [ssoaEntries, setSsoaEntries] = useState({ dev: { entryName: null, timestamp: null }, prod: { entryName: null, timestamp: null } })
  const [ssoaModal, setSsoaModal] = useState(null)
  const [ssoaToken, setSsoaToken] = useState('')
  const [ssoaOriginalToken, setSsoaOriginalToken] = useState('')
  const [ssoaSaving, setSsoaSaving] = useState(false)
  const [ssoaSaveMessage, setSsoaSaveMessage] = useState('')
  const trailIdRef = useRef(0)
  const trailTimeoutsRef = useRef([])
  const theme = themes[themeMode]

  // Version change modal: 'closed' | 'input' | 'busy' | 'result'
  const [versionModalStep, setVersionModalStep] = useState('closed')
  const [newVersionInput, setNewVersionInput] = useState('')
  const [versionChangeResult, setVersionChangeResult] = useState(null)
  const [lastValidFlags, setLastValidFlags] = useState([])
  const decodedSsoaToken = useMemo(() => decodeSsoaToken(ssoaToken), [ssoaToken])
  const ssoaHeaderText = decodedSsoaToken.valid ? JSON.stringify(decodedSsoaToken.header, null, 2) : ''
  const ssoaHeaderHeight = Math.max(80, ssoaHeaderText.split('\n').length * 18 + 20)

  const loadSsoaEntries = useCallback(async (loadedMeta) => {
    try {
      setSsoaEntries(await window.api.listSsoaManifests(loadedMeta))
    } catch (_err) {
      setSsoaEntries({ dev: { entryName: null, timestamp: null }, prod: { entryName: null, timestamp: null } })
    }
  }, [])

  const resetAppState = useCallback(() => {
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
    setIsEditorExpanded(false)
    setIsFolderDragActive(false)
    setIsFileDragActive(false)
    setLastValidFlags([])
    setSsoaEntries({ dev: { entryName: null, timestamp: null }, prod: { entryName: null, timestamp: null } })
    setSsoaModal(null)
    setSsoaToken('')
    setSsoaOriginalToken('')
    setSsoaSaveMessage('')
    setNewVersionInput('')
    setVersionChangeResult(null)
    setVersionModalStep('closed')
  }, [])

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
    const unsubscribe = window.api?.onAppReset?.(resetAppState)

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [resetAppState])

  useEffect(() => {
    if (!isEditorExpanded) {
      return undefined
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsEditorExpanded(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isEditorExpanded])

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
  const isAtInitialState =
    meta === null &&
    editorText === '' &&
    status === initialStatusText &&
    error === '' &&
    !busy &&
    !saveBusy &&
    !exportBusy &&
    !isEditorExpanded &&
    !isFolderDragActive &&
    !isFileDragActive &&
    trails.length === 0 &&
    lastValidFlags.length === 0 &&
    versionModalStep === 'closed'

  const onDrop = useCallback(async (files, rejections, event) => {
    setError('')
    setIsFileDragActive(false)

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

    let filePath = null
    const [file] = files || []

    // V Electronu mají File objekty vlastnost 'path' nebo můžeme použít webUtils
    if (file?.path) {
      filePath = file.path
    } else if (typeof window.api?.getPathForFile === 'function') {
      filePath = window.api.getPathForFile(file)
    }

    if (!filePath) {
      setStatus('Soubor nebyl načten.')
      setError('Při přetažení se nepodařilo zjistit cestu k souboru. Zkuste přetáhnout z Průzkumníka znovu.')
      return
    }

    setBusy(true)
    try {
      const loaded = await window.api.loadManifestFile(filePath)
      await loadSsoaEntries(loaded)
      setMeta(loaded)
      setEditorText(loaded.editorText)
      setStatus(loaded.message)
      spawnTrails('load')
    } catch (err) {
      setMeta(null)
      setSsoaEntries({ dev: { entryName: null, timestamp: null }, prod: { entryName: null, timestamp: null } })
      setEditorText('')
      setError(err?.message || 'Načtení selhalo.')
    } finally {
      setBusy(false)
    }
  }, [loadSsoaEntries, spawnTrails])

  const loadFileFromPath = useCallback(async (filePath) => {
    setBusy(true)
    setError('')
    try {
      if (!filePath) {
        const pickedPath = await window.api.pickManifestFile()
        if (!pickedPath) {
          setStatus('Soubor nebyl vybrán.')
          return
        }
        filePath = pickedPath
      }

      const loaded = await window.api.loadManifestFile(filePath)
      await loadSsoaEntries(loaded)
      setMeta(loaded)
      setEditorText(loaded.editorText)
      setStatus(loaded.message)
      spawnTrails('load')
    } catch (err) {
      setMeta(null)
      setSsoaEntries({ dev: { entryName: null, timestamp: null }, prod: { entryName: null, timestamp: null } })
      setEditorText('')
      setError(err?.message || 'Načtení selhalo.')
    } finally {
      setBusy(false)
      setIsFileDragActive(false)
    }
  }, [loadSsoaEntries, spawnTrails])

  const onFilePanelClick = useCallback(() => {
    if (busy) {
      return
    }

    loadFileFromPath(null)
  }, [busy, loadFileFromPath])

  const getDroppedPath = useCallback((event) => {
    const dataTransferFiles = event?.dataTransfer?.files
    if (!dataTransferFiles?.length) {
      return null
    }

    const droppedItem = dataTransferFiles[0]
    if (droppedItem?.path) {
      return droppedItem.path
    }

    if (typeof window.api?.getPathForFile === 'function') {
      return window.api.getPathForFile(droppedItem)
    }

    return null
  }, [])

  const panelStyle = useMemo(
    () => ({
      ...basePanelStyle,
      borderColor: isFileDragActive ? theme.panelBorderActive : theme.panelBorder,
      background: isFileDragActive ? theme.panelBgActive : theme.panelBg
    }),
    [isFileDragActive, theme]
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

  useEffect(() => {
    if (!parsedEditorState.error && booleanFlags.length > 0) {
      setLastValidFlags(booleanFlags)
    }
    if (!parsedEditorState.error && booleanFlags.length === 0) {
      setLastValidFlags([])
    }
  }, [booleanFlags, parsedEditorState.error])

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
      await loadSsoaEntries(loaded)
      setMeta(loaded)
      setEditorText(loaded.editorText)
      setStatus(loaded.message)
      spawnTrails('load')
    } catch (err) {
      setMeta(null)
      setSsoaEntries({ dev: { entryName: null, timestamp: null }, prod: { entryName: null, timestamp: null } })
      setEditorText('')
      setError(err?.message || 'Načtení složky selhalo.')
    } finally {
      setBusy(false)
      setIsFolderDragActive(false)
    }
  }, [loadSsoaEntries, spawnTrails])

  const loadDroppedPath = useCallback(async (droppedPath) => {
    const pathType = await window.api.getPathType(droppedPath)

    if (pathType === 'directory') {
      await loadFolderFromPath(droppedPath)
      return
    }

    if (pathType === 'file') {
      await loadFileFromPath(droppedPath)
      return
    }

    throw new Error('Přetažená položka není ani soubor, ani složka.')
  }, [loadFileFromPath, loadFolderFromPath])

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
    setIsFolderDragActive(false)
    setIsFileDragActive(false)

    if (busy) {
      return
    }

    const droppedPath = getDroppedPath(event)
    if (!droppedPath) {
      setStatus('Složka nebyla načtena.')
      setError('Při přetažení se nepodařilo zjistit cestu ke složce.')
      setIsFolderDragActive(false)
      return
    }

    loadDroppedPath(droppedPath).catch((err) => {
      setMeta(null)
      setEditorText('')
      setError(err?.message || 'Načtení položky selhalo.')
      setBusy(false)
    })
  }, [busy, getDroppedPath, loadDroppedPath])

  const onFileDragEnter = useCallback((event) => {
    event.preventDefault()
    if (!busy) {
      setIsFileDragActive(true)
    }
  }, [busy])

  const onFileDragOver = useCallback((event) => {
    event.preventDefault()
    if (!busy) {
      setIsFileDragActive(true)
    }
  }, [busy])

  const onFileDragLeave = useCallback((event) => {
    event.preventDefault()
    const nextTarget = event.relatedTarget
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsFileDragActive(false)
    }
  }, [])

  const onFileDrop = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsFileDragActive(false)
    setIsFolderDragActive(false)

    if (busy) {
      return
    }

    const droppedPath = getDroppedPath(event)
    if (!droppedPath) {
      setStatus('Soubor nebyl načten.')
      setError('Při přetažení se nepodařilo zjistit cestu k souboru. Zkuste přetáhnout z Průzkumníka znovu.')
      return
    }

    loadDroppedPath(droppedPath).catch((err) => {
      setMeta(null)
      setEditorText('')
      setError(err?.message || 'Načtení položky selhalo.')
      setBusy(false)
    })
  }, [busy, getDroppedPath, loadDroppedPath])

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
    if (!meta || busy || saveBusy) {
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

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()

        if (!meta || busy || saveBusy || versionModalStep !== 'closed' || ssoaModal) {
          return
        }

        onSave()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [busy, meta, onSave, saveBusy, ssoaModal, versionModalStep])

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
        sourceFilePath: meta.filePath,
        kind: meta.kind
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

  const onOpenSsoaModal = useCallback(async (environment) => {
    if (!meta) return

    const entryName = ssoaEntries[environment]?.entryName
    if (!entryName) return

    setError('')
    setSsoaSaveMessage('')
    try {
      const result = await window.api.loadSsoaManifest({ ...meta, environment, entryName })
      setSsoaToken(result.token)
      setSsoaOriginalToken(result.token)
      setSsoaModal({ environment, entryName: result.entryName })
    } catch (err) {
      setError(err?.message || 'Načtení SSOA manifestu selhalo.')
    }
  }, [meta, ssoaEntries])

  const onSaveSsoaManifest = useCallback(async () => {
    if (!meta || !ssoaModal || !decodedSsoaToken.valid || ssoaSaving) return

    setSsoaSaving(true)
    setSsoaSaveMessage('')
    setError('')
    try {
      await window.api.saveSsoaManifest({
        ...meta,
        environment: ssoaModal.environment,
        entryName: ssoaModal.entryName,
        token: ssoaToken.trim()
      })
      setSsoaOriginalToken(ssoaToken.trim())
      await loadSsoaEntries(meta)
      const message = `SSOA (${ssoaModal.environment}) manifest změněn.`
      setSsoaSaveMessage(message)
      setStatus(message)
      spawnTrails('save')
    } catch (err) {
      const message = err?.message || 'Uložení SSOA manifestu selhalo.'
      setSsoaSaveMessage(message)
      setError(message)
    } finally {
      setSsoaSaving(false)
    }
  }, [decodedSsoaToken.valid, loadSsoaEntries, meta, spawnTrails, ssoaModal, ssoaSaving, ssoaToken])

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

  const configureMonaco = useCallback((monaco) => {
    monaco.editor.defineTheme('jaguar-dark', monacoThemes.dark)
    monaco.editor.defineTheme('jaguar-light', monacoThemes.light)
  }, [])

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
      <ScrollbarStyles theme={theme} />
      <TrailLayer trails={trails} />

      {isEditorExpanded && (
        <button
          type='button'
          onClick={() => setIsEditorExpanded(false)}
          title='Zmenšit editor'
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 980,
            padding: '10px 18px',
            fontWeight: 300,
            borderRadius: 10,
            border: `1px solid ${theme.editorBorder}`,
            background: theme.statusBg,
            color: theme.text,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: themeMode === 'light'
              ? '0 16px 36px rgba(18, 33, 63, 0.18)'
              : '0 16px 36px rgba(0, 0, 0, 0.34)'
          }}
        >
          <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <polyline points='9 3 9 9 3 9' />
            <line x1='9' y1='9' x2='3' y2='3' />
            <polyline points='15 21 15 15 21 15' />
            <line x1='15' y1='15' x2='21' y2='21' />
            <polyline points='21 9 15 9 15 3' />
            <line x1='15' y1='9' x2='21' y2='3' />
            <polyline points='3 15 9 15 9 21' />
            <line x1='9' y1='15' x2='3' y2='21' />
          </svg>
          Zmenšit editor
        </button>
      )}

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

      <div
        style={{
          maxWidth: 980,
          margin: '0 auto',
          paddingRight: 24,
          paddingBottom: 24,
          paddingLeft: 24,
          paddingTop: meta ? 0 : 24,
          fontFamily: 'Segoe UI, sans-serif',
          color: theme.text,
          position: 'relative',
          zIndex: 1
        }}
      >
        
        {/* <h1 style={{ marginTop: 0 }}>JAR Manifest Editor</h1> */}
        {!meta && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            <div
              role='button'
              tabIndex={0}
              onClick={onFilePanelClick}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onFilePanelClick()
                }
              }}
              onDragEnter={onFileDragEnter}
              onDragOver={onFileDragOver}
              onDragLeave={onFileDragLeave}
              onDrop={onFileDrop}
              style={panelStyle}
            >
              <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Vyberte soubor (JAR, ZIP)</p>
              <p style={{ margin: '8px 0 0 0', fontSize: 12, color: theme.mutedText }}>nebo přetáhni</p>
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
              <p style={{ margin: '8px 0 0 0', fontSize: 12, color: theme.mutedText }}>nebo přetáhni</p>
            </div>
          </div>
        )}

      {meta && (
        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.2 }}>
                {meta.kind === 'folder'
                  ? <span aria-hidden='true'>📁</span>
                  : (
                    <span
                      aria-hidden='true'
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 26,
                        height: 18,
                        padding: '0 6px',
                        borderRadius: 999,
                        border: `1px solid ${theme.editorBorder}`,
                        background: theme.editorBg,
                        color: theme.text,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        lineHeight: 1,
                        boxSizing: 'border-box',
                        verticalAlign: 'middle'
                      }}
                    >
                      {meta.filePath.toLowerCase().endsWith('.zip') ? 'ZIP' : 'JAR'}
                    </span>
                  )}
                {meta.kind === 'folder' ? 'Složka:' : 'Soubor:'}
              </span>
              <span style={{ fontWeight: 300, lineHeight: 1.2 }}>{meta.filePath}</span>
            </div>
            {/* <div><strong>Typ:</strong> {meta.kind.toUpperCase()}</div> */}
            <div><span style={{ fontWeight: 400 }}>📄 Vnitřní manifest:</span> <span style={{ fontWeight: 300 }}>{meta.innerManifestDisplayPath || meta.innerManifestEntryName || 'N/A'}</span></div>
            {isZipLikeMeta && (
              <div>
                <span style={{ fontWeight: 400 }}>📄 Vnější manifest:</span>{' '}
                {meta.outerManifestEntryName
                  ? <span style={{ fontWeight: 300 }}>{meta.outerManifestEntryName}</span>
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
        </div>
      )}

      <div
        style={{
          marginTop: meta ? 8 : 20,
          padding: 8,
          paddingLeft: 12,
          paddingRight: isAtInitialState ? 12 : 44,
          borderRadius: 10,
          background: theme.statusBg,
          border: `1px solid ${theme.statusBorder}`,
          position: 'relative'
        }}
      >
        <div style={{ minWidth: 0 }}>
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
        {!isAtInitialState && (
          <button
            type='button'
            onClick={resetAppState}
            title='Vrátit JAguaRa do výchozího stavu'
            aria-label='Vrátit JAguaRa do výchozího stavu'
            style={{
              position: 'absolute',
              top: '50%',
              right: 10,
              transform: 'translateY(-50%)',
              width: 22,
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              border: `1px solid ${theme.editorBorder}`,
              background: theme.editorBg,
              color: theme.text,
              cursor: 'pointer',
              padding: 0
            }}
          >
            <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
              <polyline points='23 4 23 10 17 10' />
              <polyline points='1 20 1 14 7 14' />
              <path d='M3.51 9a9 9 0 0 1 14.13-3.36L23 10' />
              <path d='M20.49 15a9 9 0 0 1-14.13 3.36L1 14' />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: theme.errorBg, border: `1px solid ${theme.errorBorder}`, color: theme.errorText }}>
          {error}
        </div>
      )}

      {meta && (
        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>

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
            {!parsedEditorState.error && !booleanFlags.length && (
              <div style={{ color: theme.mutedText }}>
                V aktuálním manifestu nejsou žádné boolean hodnoty.
              </div>
            )}

            {(parsedEditorState.error ? lastValidFlags : booleanFlags).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', opacity: parsedEditorState.error ? 0.45 : 1, transition: 'opacity 0.15s' }}>
                {(parsedEditorState.error ? lastValidFlags : booleanFlags).map((flag) => (
                  <label
                    key={flag.label}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 999,
                      border: `1px solid ${theme.editorBorder}`,
                      background: theme.editorBg,
                      color: theme.text,
                      cursor: parsedEditorState.error ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <input
                      type='checkbox'
                      checked={flag.value}
                      disabled={!!parsedEditorState.error}
                      onChange={() => !parsedEditorState.error && onToggleFlag(flag.path)}
                    />
                    <span style={{ fontFamily: 'Consolas, monospace', fontSize: 12, lineHeight: 1.2 }}>{flag.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div
            style={isEditorExpanded ? {
              position: 'fixed',
              inset: 0,
              zIndex: 950,
              borderRadius: 0,
              border: 'none',
              boxSizing: 'border-box',
              overflow: 'hidden',
              background: theme.editorBg
            } : {
              position: 'relative',
              width: '100%',
              minHeight: 380,
              borderRadius: 10,
              border: `1px solid ${theme.editorBorder}`,
              boxSizing: 'border-box',
              overflow: 'hidden',
              background: theme.editorBg
            }}
          >
            <Editor
              beforeMount={configureMonaco}
              language='json'
              theme={themeMode === 'light' ? 'jaguar-light' : 'jaguar-dark'}
              value={editorText}
              onChange={(nextValue) => {
                applyEditorChange(nextValue ?? '')
              }}
              height={isEditorExpanded ? '100vh' : '420px'}
              options={{
                automaticLayout: true,
                minimap: { enabled: false },
                glyphMargin: true,
                folding: true,
                foldingStrategy: 'auto',
                showFoldingControls: 'always',
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                roundedSelection: true,
                renderLineHighlight: 'all',
                bracketPairColorization: { enabled: true },
                guides: {
                  bracketPairs: true,
                  indentation: true
                },
                wordWrap: 'on',
                wrappingIndent: 'indent',
                tabSize: 2,
                insertSpaces: true,
                fontFamily: 'Consolas, Courier New, monospace',
                fontSize: 14,
                lineHeight: 22,
                padding: {
                  top: 14,
                  bottom: 14
                }
              }}
            />
            {!isEditorExpanded && (
              <button
                type='button'
                onClick={() => setIsEditorExpanded(true)}
                title='Roztáhnout editor'
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 15,
                  zIndex: 10,
                  padding: '10px 18px',
                  fontWeight: 400,
                  borderRadius: 10,
                  border: `1px solid ${theme.editorBorder}`,
                  background: theme.statusBg,
                  color: theme.text,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: themeMode === 'light'
                    ? '0 8px 20px rgba(18, 33, 63, 0.12)'
                    : '0 8px 20px rgba(0, 0, 0, 0.28)'
                }}
              >
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <polyline points='15 3 21 3 21 9' />
                  <line x1='14' y1='10' x2='21' y2='3' />
                  <polyline points='9 21 3 21 3 15' />
                  <line x1='10' y1='14' x2='3' y2='21' />
                  <polyline points='21 15 21 21 15 21' />
                  <line x1='14' y1='14' x2='21' y2='21' />
                  <polyline points='3 9 3 3 9 3' />
                  <line x1='10' y1='10' x2='3' y2='3' />
                </svg>
                Roztáhnout editor
              </button>
            )}
          </div>

          <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
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
            {(ssoaEntries.dev.entryName || ssoaEntries.prod.entryName) && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {ssoaEntries.dev.entryName && (
                    <button
                      type="button"
                      onClick={() => onOpenSsoaModal('dev')}
                      disabled={busy}
                      style={{ padding: '10px 16px', fontWeight: 600, borderRadius: 8, border: '1px solid #48b9a2', background: '#173d3b', color: '#80e2ce', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.55 : 1 }}
                    >
                      SSOA (dev)
                    </button>
                  )}
                  {ssoaEntries.prod.entryName && (
                    <button
                      type="button"
                      onClick={() => onOpenSsoaModal('prod')}
                      disabled={busy}
                      style={{ padding: '10px 16px', fontWeight: 600, borderRadius: 8, border: '1px solid #e2a648', background: '#49371d', color: '#ffd28a', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.55 : 1 }}
                    >
                      SSOA (prod)
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gap: 3, color: theme.mutedText, fontSize: 12, fontFamily: 'Consolas, monospace', textAlign: 'right' }}>
                  {ssoaEntries.dev.entryName && <div><strong style={{ color: theme.text }}>DEV</strong> {ssoaEntries.dev.timestamp || 'timestamp nenalezen'}</div>}
                  {ssoaEntries.prod.entryName && <div><strong style={{ color: theme.text }}>PROD</strong> {ssoaEntries.prod.timestamp || 'timestamp nenalezen'}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!meta && (
        <div style={{ marginTop: 14, color: theme.mutedText }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            Jaguar umí:
          </div>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: 14, lineHeight: 1.5 }}>
            <li>zobrazit manifest aplikace a umožnit jeho úpravu, uložení a export</li>
            <li>provést hluboké přečíslování verze aplikace</li>
          </ul>
        </div>
      )}

      {!meta && (
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
          verze: {appVersion} | dev: gnf6dka
        </footer>
      )}
      </div>

      {ssoaModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.72)' }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !ssoaSaving) setSsoaModal(null)
          }}
        >
          <style>{`
            .ssoa-modal-body { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 14px; flex: 1; min-height: 0; }
            .ssoa-preview-grid { display: grid; grid-template-rows: max-content minmax(0, 1fr); gap: 12px; min-height: 0; }
            @media (max-width: 760px) {
              .ssoa-modal-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(200px, 0.7fr) minmax(320px, 1fr); overflow-y: auto; }
              .ssoa-preview-grid { grid-template-rows: max-content minmax(220px, 1fr); }
            }
          `}</style>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ssoa-modal-title"
            style={{ width: 'min(1380px, 96vw)', height: 'min(880px, 94vh)', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14, padding: 20, borderRadius: 12, border: `1px solid ${theme.panelBorder}`, background: theme.panelBg, color: theme.text, boxShadow: '0 18px 60px rgba(0,0,0,0.55)' }}
          >
            <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setSsoaModal(null)}
                disabled={ssoaSaving}
                title="Zpět"
                aria-label="Zpět"
                style={{ width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${theme.editorBorder}`, background: theme.editorBg, color: theme.text, cursor: ssoaSaving ? 'not-allowed' : 'pointer' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 id="ssoa-modal-title" style={{ margin: 0, fontSize: 18 }}>SSOA ({ssoaModal.environment})</h2>
                <div style={{ marginTop: 3, color: theme.mutedText, fontSize: 12, fontFamily: 'Consolas, monospace' }}>{ssoaModal.entryName}</div>
              </div>
            </header>

            <div className="ssoa-modal-body">
              <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Token .mose</h3>
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', border: `1px solid ${theme.editorBorder}`, borderRadius: 8 }}>
                  <Editor
                    height="100%"
                    language="plaintext"
                    theme={themeMode === 'dark' ? 'jaguar-dark' : 'jaguar-light'}
                    value={ssoaToken}
                    onChange={(value) => setSsoaToken(value ?? '')}
                    beforeMount={configureMonaco}
                    options={{
                      minimap: { enabled: false },
                      lineNumbers: 'off',
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                      padding: { top: 12, bottom: 12 },
                      automaticLayout: true
                    }}
                  />
                </div>
                <div style={{ minHeight: 46, paddingTop: 8, fontSize: 12 }}>
                  <div style={{ color: decodedSsoaToken.valid ? theme.statusSuccess : theme.errorText }}>
                    {decodedSsoaToken.valid ? 'Token je syntakticky validní.' : decodedSsoaToken.error}
                  </div>
                  <div style={{ marginTop: 4, color: theme.mutedText }}>
                    Změna obsahu nepřepočítá kryptografický podpis tokenu.
                  </div>
                </div>
              </section>

              <div className="ssoa-preview-grid">
                <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Header</h3>
                  <div style={{ height: ssoaHeaderHeight, flexShrink: 0, overflow: 'hidden', border: `1px solid ${theme.editorBorder}`, borderRadius: 8 }}>
                    <JsonPreview
                      value={ssoaHeaderText}
                      theme={themeMode === 'dark' ? 'jaguar-dark' : 'jaguar-light'}
                      beforeMount={configureMonaco}
                    />
                  </div>
                </section>
                <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Payload</h3>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', border: `1px solid ${theme.editorBorder}`, borderRadius: 8 }}>
                    <JsonPreview
                      value={decodedSsoaToken.valid ? JSON.stringify(decodedSsoaToken.payload, null, 2) : ''}
                      theme={themeMode === 'dark' ? 'jaguar-dark' : 'jaguar-light'}
                      beforeMount={configureMonaco}
                    />
                  </div>
                </section>
              </div>
            </div>

            <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
              <div style={{ color: ssoaSaveMessage && !ssoaSaveMessage.startsWith('SSOA') ? theme.errorText : theme.statusSuccess, fontSize: 13 }}>
                {ssoaSaveMessage}
              </div>
              <button
                type="button"
                onClick={onSaveSsoaManifest}
                disabled={!decodedSsoaToken.valid || ssoaToken.trim() === ssoaOriginalToken.trim() || ssoaSaving}
                style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${theme.buttonBorder}`, background: theme.buttonBg, color: theme.buttonText, fontWeight: 700, cursor: decodedSsoaToken.valid && ssoaToken.trim() !== ssoaOriginalToken.trim() && !ssoaSaving ? 'pointer' : 'not-allowed', opacity: decodedSsoaToken.valid && ssoaToken.trim() !== ssoaOriginalToken.trim() && !ssoaSaving ? 1 : 0.5 }}
              >
                {ssoaSaving ? 'Ukládám…' : 'Uložit změny'}
              </button>
            </footer>
          </section>
        </div>
      )}

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
                      <button
                        type="button"
                        title="Vložit níže"
                        aria-label="Vložit níže"
                        onClick={() => setNewVersionInput(String(currentManifestVersion))}
                        style={{ marginLeft: 6, width: 28, height: 26, verticalAlign: 'middle', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${theme.editorBorder}`, background: theme.editorBg, color: theme.text, cursor: 'pointer' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 5v14" /><path d="m19 12-7 7-7-7" />
                        </svg>
                      </button>
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

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
