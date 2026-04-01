const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs/promises')
const AdmZip = require('adm-zip')
const isEqual = require('lodash/isEqual')
const http = require('http')

const isDev = process.env.NODE_ENV === 'development'
let mainWindow = null
let currentThemeMode = 'dark'

function setThemeMode(mode, options = {}) {
  const nextMode = mode === 'light' ? 'light' : 'dark'
  const changed = currentThemeMode !== nextMode
  currentThemeMode = nextMode

  if (!options.skipMenuRefresh) {
    buildAppMenu()
  }

  if (mainWindow && !mainWindow.isDestroyed() && (changed || options.forceNotify)) {
    mainWindow.webContents.send('theme:changed', currentThemeMode)
  }

  return currentThemeMode
}

function toggleThemeMode() {
  const nextMode = currentThemeMode === 'dark' ? 'light' : 'dark'
  return setThemeMode(nextMode)
}

function buildAppMenu() {
  const template = [
    {
      label: 'Aplikace',
      submenu: [
        {
          label: 'Restart',
          accelerator: 'CommandOrControl+R',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('app:reset')
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Ukončit',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Zobrazení',
      submenu: [
        {
          label: 'Tmavý režim',
          type: 'radio',
          checked: currentThemeMode === 'dark',
          click: () => setThemeMode('dark')
        },
        {
          label: 'Světly režim',
          type: 'radio',
          checked: currentThemeMode === 'light',
          click: () => setThemeMode('light')
        },
        { type: 'separator' },
        {
          label: 'Přepnout režim',
          accelerator: 'CommandOrControl+T',
          click: () => toggleThemeMode()
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function isServerAlive(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      res.resume()
      resolve(res.statusCode >= 200 && res.statusCode < 500)
    })

    req.on('error', () => resolve(false))
    req.setTimeout(800, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function getDevServerUrl() {
  const preferredPort = Number(process.env.VITE_PORT || 5173)
  const portsToTry = [preferredPort]
  for (let i = 1; i <= 10; i += 1) {
    portsToTry.push(preferredPort + i)
  }

  for (const port of portsToTry) {
    // eslint-disable-next-line no-await-in-loop
    if (await isServerAlive(port)) {
      return `http://localhost:${port}`
    }
  }

  return `http://localhost:${preferredPort}`
}

function normalizeJsonText(text, context) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`${context}: neplatny JSON (${error.message})`)
  }

  return JSON.stringify(parsed, null, 2)
}

function findManifestEntry(zip) {
  return zip
    .getEntries()
    .find((entry) => !entry.isDirectory && path.posix.basename(entry.entryName).toLowerCase() === 'manifest.json')
}

function findZipJarEntry(zip) {
  return zip
    .getEntries()
    .find((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.jar'))
}

function loadJarManifest(jarBufferOrPath, contextLabel) {
  const jarZip = new AdmZip(jarBufferOrPath)
  const manifestEntry = findManifestEntry(jarZip)

  if (!manifestEntry) {
    throw new Error(`${contextLabel}: uvnitr JAR nebyl nalezen soubor manifest.json`)
  }

  const rawText = manifestEntry.getData().toString('utf8')
  const normalizedText = normalizeJsonText(rawText, contextLabel)

  return {
    jarZip,
    manifestEntry,
    normalizedText,
    parsed: JSON.parse(normalizedText)
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#f4f7ff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })

  mainWindow.webContents.once('did-finish-load', () => {
    setThemeMode(currentThemeMode, { skipMenuRefresh: true, forceNotify: true })
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  })

  mainWindow.webContents.on('did-fail-load', () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (isDev) {
    const devServerUrl = await getDevServerUrl()
    await mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  buildAppMenu()
  createWindow()

  ipcMain.handle('theme:get', async () => currentThemeMode)
  ipcMain.handle('theme:set', async (_event, mode) => setThemeMode(mode))
  ipcMain.handle('theme:toggle', async () => toggleThemeMode())

  ipcMain.handle('manifest:pickFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Vyberte JAR nebo ZIP soubor',
      properties: ['openFile'],
      filters: [
        { name: 'JAR/ZIP', extensions: ['jar', 'zip'] }
      ]
    })

    if (result.canceled || !result.filePaths?.length) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('manifest:load', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Neni zadana cesta k souboru.')
    }

    const ext = path.extname(filePath).toLowerCase()

    if (ext === '.jar') {
      const { manifestEntry, normalizedText } = loadJarManifest(filePath, 'JAR')

      return {
        kind: 'jar',
        filePath,
        editorText: normalizedText,
        innerManifestText: normalizedText,
        outerManifestText: null,
        outerManifestEntryName: null,
        jarEntryName: null,
        innerManifestEntryName: manifestEntry.entryName,
        needsSync: false,
        message: 'Nacten manifest.json z JAR.'
      }
    }

    if (ext === '.zip') {
      const zip = new AdmZip(filePath)
      const outerManifestEntries = zip
        .getEntries()
        .filter((entry) => !entry.isDirectory && path.posix.basename(entry.entryName).toLowerCase() === 'manifest.json')
      const jarEntry = findZipJarEntry(zip)

      if (!jarEntry) {
        throw new Error('ZIP neobsahuje zadne JAR.')
      }

      if (outerManifestEntries.length > 1) {
        throw new Error(
          `V ZIP bylo nalezeno vice externich manifestu (${outerManifestEntries.length}). Pokracovat lze pouze s jednim externim manifestem.`
        )
      }

      const outerManifestEntry = outerManifestEntries[0] || null

      const { manifestEntry: innerManifestEntry, normalizedText: innerManifestText, parsed: innerParsed } = loadJarManifest(
        jarEntry.getData(),
        'ZIP/JAR'
      )

      if (!outerManifestEntry) {
        return {
          kind: 'zip',
          filePath,
          editorText: innerManifestText,
          innerManifestText,
          outerManifestText: null,
          outerManifestEntryName: null,
          jarEntryName: jarEntry.entryName,
          innerManifestEntryName: innerManifestEntry.entryName,
          needsSync: false,
          message: 'Externi manifest nebyl nalezen. Upravit lze pouze vnitrni manifest v JAR.'
        }
      }

      const outerManifestText = normalizeJsonText(outerManifestEntry.getData().toString('utf8'), 'ZIP/outer manifest')
      const outerParsed = JSON.parse(outerManifestText)
      const manifestsEqual = isEqual(outerParsed, innerParsed)

      return {
        kind: 'zip',
        filePath,
        editorText: innerManifestText,
        innerManifestText,
        outerManifestText,
        outerManifestEntryName: outerManifestEntry.entryName,
        jarEntryName: jarEntry.entryName,
        innerManifestEntryName: innerManifestEntry.entryName,
        needsSync: !manifestsEqual,
        message: manifestsEqual
          ? 'Oba manifesty (vnější + vnitřní v JARku) jsou shodné.'
          : 'Manifesty nejsou shodné. Vyberte, kterou podobu zachovat.'
      }
    }

    throw new Error('Podporovane jsou pouze soubory .jar nebo .zip')
  })

  ipcMain.handle('manifest:syncOuterWithInner', async (_event, payload) => {
    if (!payload || payload.kind !== 'zip') {
      throw new Error('Synchronizace je dostupna pouze pro ZIP.')
    }

    const { filePath, jarEntryName, innerManifestEntryName, outerManifestEntryName } = payload
    const direction = payload.direction || 'inner-to-outer'
    if (!filePath || !jarEntryName || !innerManifestEntryName || !outerManifestEntryName) {
      throw new Error('Chybi data potrebna pro synchronizaci ZIP.')
    }

    if (direction !== 'inner-to-outer' && direction !== 'outer-to-inner') {
      throw new Error('Neznama volba synchronizace.')
    }

    const zip = new AdmZip(filePath)
    const jarEntry = zip.getEntry(jarEntryName)
    const outerManifestEntry = zip.getEntry(outerManifestEntryName)

    if (!jarEntry || !outerManifestEntry) {
      throw new Error('V ZIP nelze najit JAR nebo externi manifest pro synchronizaci.')
    }

    const innerJar = new AdmZip(jarEntry.getData())
    const innerManifestEntry = innerJar.getEntry(innerManifestEntryName)
    if (!innerManifestEntry) {
      throw new Error('Vnitrni manifest.json nebyl nalezen v JAR.')
    }

    const innerManifestText = normalizeJsonText(innerManifestEntry.getData().toString('utf8'), 'ZIP/JAR manifest')
    const outerManifestText = normalizeJsonText(outerManifestEntry.getData().toString('utf8'), 'ZIP/outer manifest')

    let syncedText
    if (direction === 'inner-to-outer') {
      syncedText = innerManifestText
      zip.updateFile(outerManifestEntryName, Buffer.from(syncedText, 'utf8'))
    } else {
      syncedText = outerManifestText
      innerJar.updateFile(innerManifestEntryName, Buffer.from(syncedText, 'utf8'))
      zip.updateFile(jarEntryName, innerJar.toBuffer())
    }

    zip.writeZip(filePath)

    return {
      ok: true,
      syncedText,
      innerManifestText: syncedText,
      outerManifestText: syncedText,
      message:
        direction === 'inner-to-outer'
          ? 'Synchronizace dokoncena. Zachovana vnitrni podoba a prekopirovana do vnejsiho manifestu.'
          : 'Synchronizace dokoncena. Zachovana vnejsi podoba a prekopirovana do vnitrniho JAR manifestu.'
    }
  })

  ipcMain.handle('manifest:save', async (_event, payload) => {
    if (!payload || !payload.kind || !payload.filePath || typeof payload.editorText !== 'string') {
      throw new Error('Neplatna data pro ulozeni.')
    }

    const normalizedText = normalizeJsonText(payload.editorText, 'Editor manifest')
    const manifestBuffer = Buffer.from(normalizedText, 'utf8')

    if (payload.kind === 'jar') {
      const jar = new AdmZip(payload.filePath)
      const entry = jar.getEntry(payload.innerManifestEntryName)
      if (!entry) {
        throw new Error('V JAR nelze najit manifest pro ulozeni.')
      }

      jar.updateFile(payload.innerManifestEntryName, manifestBuffer)
      jar.writeZip(payload.filePath)

      return { ok: true, normalizedText, message: 'JAR byl úspěšně uložen.' }
    }

    if (payload.kind === 'zip') {
      const zip = new AdmZip(payload.filePath)
      const jarEntry = zip.getEntry(payload.jarEntryName)
      if (!jarEntry) {
        throw new Error('V ZIP nelze najit JAR pro ulozeni.')
      }

      const innerJar = new AdmZip(jarEntry.getData())
      const innerManifestEntry = innerJar.getEntry(payload.innerManifestEntryName)
      if (!innerManifestEntry) {
        throw new Error('Ve vnitrnim JAR nelze najit manifest pro ulozeni.')
      }

      innerJar.updateFile(payload.innerManifestEntryName, manifestBuffer)
      zip.updateFile(payload.jarEntryName, innerJar.toBuffer())

      // Pri ulozeni ZIP drzi vnejsi manifest synchronizovany s editovanym vnitrnim manifestem.
      if (payload.outerManifestEntryName) {
        zip.updateFile(payload.outerManifestEntryName, manifestBuffer)
      }

      zip.writeZip(payload.filePath)

      const saveMessage = payload.outerManifestEntryName
        ? 'Oba manifesty byly úspěšně uloženy.'
        : 'Vnitrni JAR manifest byl úspěšně uložen.'

      return {
        ok: true,
        normalizedText,
        message: saveMessage
      }
    }

    throw new Error('Neznamy typ souboru pro ulozeni.')
  })

  ipcMain.handle('manifest:export', async (_event, payload) => {
    if (!payload || typeof payload.editorText !== 'string') {
      throw new Error('Neplatna data pro export.')
    }

    const normalizedText = normalizeJsonText(payload.editorText, 'Export manifest')
    const sourceDir = payload.sourceFilePath ? path.dirname(payload.sourceFilePath) : null
    const defaultDir = sourceDir ? path.join(sourceDir, 'dist') : app.getPath('documents')
    const defaultPath = path.join(defaultDir, 'manifest.json')

    const result = await dialog.showSaveDialog({
      title: 'Vyberte cilovy soubor pro export manifest.json',
      defaultPath,
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return {
        ok: false,
        canceled: true,
        message: 'Export byl zrusen.'
      }
    }

    const targetFilePath = result.filePath
    const targetDir = path.dirname(targetFilePath)

    await fs.mkdir(targetDir, { recursive: true })
    await fs.writeFile(targetFilePath, normalizedText, 'utf8')

    return {
      ok: true,
      normalizedText,
      exportedPath: targetFilePath,
      message: `Manifest byl vyexportovan do ${targetFilePath}`
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})