const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs/promises')
const AdmZip = require('adm-zip')
const isEqual = require('lodash/isEqual')
const http = require('http')
const Store = require('electron-store')

const store = new Store({ name: 'jaguar-prefs' })

const isDev = process.env.NODE_ENV === 'development'
let mainWindow = null
let currentThemeMode = store.get('themeMode', 'dark') === 'light' ? 'light' : 'dark'
const appIconPath = path.join(__dirname, '..', 'jaguar.ico')

function setThemeMode(mode, options = {}) {
  const nextMode = mode === 'light' ? 'light' : 'dark'
  const changed = currentThemeMode !== nextMode
  currentThemeMode = nextMode
  store.set('themeMode', currentThemeMode)

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
          label: 'Reload',
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
          label: 'Světlý režim',
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
    throw new Error(`${context}: neplatný JSON (${error.message})`)
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
    throw new Error(`${contextLabel}: uvnitř JAR nebyl nalezen soubor manifest.json`)
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

const ZIP_METHOD_STORED = 0

function getEntryCompressionMethod(entry) {
  return typeof entry?.header?.method === 'number' ? entry.header.method : null
}

function updateEntryPreservingCompression(zip, entryName, content, originalMethod = null) {
  const entry = zip.getEntry(entryName)
  if (!entry) {
    return null
  }

  const methodToPreserve = originalMethod ?? getEntryCompressionMethod(entry)

  zip.updateFile(entryName, content)

  const updatedEntry = zip.getEntry(entryName)
  if (updatedEntry) {
    // adm-zip rewrites local headers with inline CRC/sizes and does not emit data descriptors.
    // Clearing this flag prevents future reads from expecting a descriptor that is not there.
    updatedEntry.header.flags_desc = false

    if (typeof methodToPreserve === 'number') {
      updatedEntry.header.method = methodToPreserve
    }
  }

  return updatedEntry
}

function openJarFromMeta(payload) {
  if (payload?.kind === 'jar' && payload.filePath) {
    const jar = new AdmZip(payload.filePath)
    return { jar, save: () => jar.writeZip(payload.filePath) }
  }

  if (payload?.kind === 'folder' && payload.jarFilePath) {
    const jar = new AdmZip(payload.jarFilePath)
    return { jar, save: () => jar.writeZip(payload.jarFilePath) }
  }

  if (payload?.kind === 'zip' && payload.filePath && payload.jarEntryName) {
    const zip = new AdmZip(payload.filePath)
    const jarEntry = zip.getEntry(payload.jarEntryName)
    if (!jarEntry) {
      throw new Error('V ZIP nelze najít vnitřní JAR.')
    }

    const jar = new AdmZip(jarEntry.getData())
    return {
      jar,
      save: () => {
        updateEntryPreservingCompression(zip, payload.jarEntryName, jar.toBuffer(), getEntryCompressionMethod(jarEntry))
        zip.writeZip(payload.filePath)
      }
    }
  }

  throw new Error('Nepodporovaný typ zdrojového archivu.')
}

function getSsoaDirectory(environment) {
  if (environment === 'dev') return 'sSOA-Manifest'
  if (environment === 'prod') return 'sSOA-Manifest-2'
  throw new Error('Neznámé prostředí SSOA.')
}

function findSsoaManifestEntry(jar, environment) {
  const directoryPrefix = `${getSsoaDirectory(environment)}/`.toLowerCase()
  return jar.getEntries()
    .filter((entry) => !entry.isDirectory && entry.entryName.toLowerCase().startsWith(directoryPrefix) && entry.entryName.toLowerCase().endsWith('.mose'))
    .sort((left, right) => left.entryName.localeCompare(right.entryName))[0] || null
}

function getSsoaManifestInfo(jar, environment) {
  const entry = findSsoaManifestEntry(jar, environment)
  if (!entry) return { entryName: null, timestamp: null }

  try {
    const token = entry.getData().toString('utf8').trim()
    const encodedHeader = token.split('.')[0]
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'))
    return { entryName: entry.entryName, timestamp: typeof header.ts === 'string' ? header.ts : null }
  } catch (_error) {
    return { entryName: entry.entryName, timestamp: null }
  }
}

function validateSsoaToken(token) {
  const parts = token.trim().split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    throw new Error('Token musí obsahovat platnou hlavičku, payload a podpis oddělené tečkami.')
  }

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (!header || typeof header !== 'object' || Array.isArray(header) || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Header a payload musí být JSON objekty.')
    }
  } catch (error) {
    throw new Error(`Neplatný SSOA token: ${error.message}`)
  }
}

function toPosixRelative(basePath, targetPath) {
  return path.relative(basePath, targetPath).split(path.sep).join('/')
}

async function collectFilesRecursive(rootDir) {
  const files = []
  const stack = [rootDir]

  while (stack.length > 0) {
    const currentDir = stack.pop()
    // eslint-disable-next-line no-await-in-loop
    const entries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const nextPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        stack.push(nextPath)
      } else if (entry.isFile()) {
        files.push(nextPath)
      }
    }
  }

  files.sort((a, b) => a.localeCompare(b))
  return files
}

async function loadFolderManifest(folderPath) {
  const stats = await fs.stat(folderPath).catch(() => null)
  if (!stats || !stats.isDirectory()) {
    throw new Error('Zadaná cesta není složka.')
  }

  const allFiles = await collectFilesRecursive(folderPath)
  const jarFiles = allFiles.filter((file) => file.toLowerCase().endsWith('.jar'))

  if (!jarFiles.length) {
    throw new Error('Složka neobsahuje žádné JAR.')
  }

  const jarFilePath = jarFiles[0]
  const outerManifestFiles = allFiles.filter((file) => path.basename(file).toLowerCase() === 'manifest.json')

  if (outerManifestFiles.length > 1) {
    throw new Error(
      `Ve složce bylo nalezeno více externích manifestů (${outerManifestFiles.length}). Pokračovat lze pouze s jedním externím manifestem.`
    )
  }

  const outerManifestFilePath = outerManifestFiles[0] || null
  const { manifestEntry: innerManifestEntry, normalizedText: innerManifestText, parsed: innerParsed } = loadJarManifest(
    jarFilePath,
    'SLOŽKA/JAR'
  )

  if (!outerManifestFilePath) {
    return {
      kind: 'folder',
      filePath: folderPath,
      editorText: innerManifestText,
      innerManifestText,
      outerManifestText: null,
      outerManifestEntryName: null,
      outerManifestFilePath: null,
      jarEntryName: toPosixRelative(folderPath, jarFilePath),
      jarFilePath,
      innerManifestEntryName: innerManifestEntry.entryName,
      innerManifestDisplayPath: `${toPosixRelative(folderPath, jarFilePath)} > ${innerManifestEntry.entryName}`,
      needsSync: false,
      message: 'Externí manifest nebyl nalezen. Upravit lze pouze vnitřní manifest v JAR.'
    }
  }

  const outerManifestRaw = await fs.readFile(outerManifestFilePath, 'utf8')
  const outerManifestText = normalizeJsonText(outerManifestRaw, 'SLOŽKA/outer manifest')
  const outerParsed = JSON.parse(outerManifestText)
  const manifestsEqual = isEqual(outerParsed, innerParsed)

  return {
    kind: 'folder',
    filePath: folderPath,
    editorText: innerManifestText,
    innerManifestText,
    outerManifestText,
    outerManifestEntryName: toPosixRelative(folderPath, outerManifestFilePath),
    outerManifestFilePath,
    jarEntryName: toPosixRelative(folderPath, jarFilePath),
    jarFilePath,
    innerManifestEntryName: innerManifestEntry.entryName,
    innerManifestDisplayPath: `${toPosixRelative(folderPath, jarFilePath)} > ${innerManifestEntry.entryName}`,
    needsSync: !manifestsEqual,
    message: manifestsEqual
      ? 'Načteny 2 manifesty'
      : 'Manifesty nejsou shodné. Vyberte, kterou podobu zachovat.'
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#f4f7ff',
    icon: appIconPath,
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
      title: 'Vyberte soubor (JAR, ZIP)',
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

  ipcMain.handle('manifest:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Vyberte složku s rozbaleným obsahem',
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths?.length) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('manifest:getPathType', async (_event, targetPath) => {
    if (!targetPath || typeof targetPath !== 'string') {
      throw new Error('Není zadána cesta.')
    }

    const stats = await fs.stat(targetPath).catch(() => null)
    if (!stats) {
      throw new Error('Zadaná cesta neexistuje.')
    }

    if (stats.isDirectory()) {
      return 'directory'
    }

    if (stats.isFile()) {
      return 'file'
    }

    return 'other'
  })

  ipcMain.handle('manifest:load', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Není zadána cesta k souboru.')
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
        innerManifestDisplayPath: manifestEntry.entryName,
        needsSync: false,
        message: 'Načten manifest.json z JAR.'
      }
    }

    if (ext === '.zip') {
      const zip = new AdmZip(filePath)
      const outerManifestEntries = zip
        .getEntries()
        .filter((entry) => !entry.isDirectory && path.posix.basename(entry.entryName).toLowerCase() === 'manifest.json')
      const jarEntry = findZipJarEntry(zip)

      if (!jarEntry) {
        throw new Error('ZIP neobsahuje žádné JAR.')
      }

      if (outerManifestEntries.length > 1) {
        throw new Error(
          `V ZIP bylo nalezeno více externích manifestů (${outerManifestEntries.length}). Pokračovat lze pouze s jedním externím manifestem.`
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
          innerManifestDisplayPath: `${jarEntry.entryName} > ${innerManifestEntry.entryName}`,
          needsSync: false,
          message: 'Externí manifest nebyl nalezen. Upravit lze pouze vnitřní manifest v JAR.'
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
        innerManifestDisplayPath: `${jarEntry.entryName} > ${innerManifestEntry.entryName}`,
        needsSync: !manifestsEqual,
        message: manifestsEqual
          ? 'Načteny 2 manifesty'
          : 'Manifesty nejsou shodné. Vyberte, kterou podobu zachovat.'
      }
    }

    throw new Error('Podporovány jsou pouze soubory .jar nebo .zip')
  })

  ipcMain.handle('manifest:loadFolder', async (_event, folderPath) => {
    if (!folderPath || typeof folderPath !== 'string') {
      throw new Error('Není zadána cesta ke složce.')
    }

    return loadFolderManifest(folderPath)
  })

  ipcMain.handle('ssoa:list', async (_event, payload) => {
    const { jar } = openJarFromMeta(payload)
    return {
      dev: getSsoaManifestInfo(jar, 'dev'),
      prod: getSsoaManifestInfo(jar, 'prod')
    }
  })

  ipcMain.handle('ssoa:load', async (_event, payload) => {
    const { jar } = openJarFromMeta(payload)
    const directoryPrefix = `${getSsoaDirectory(payload.environment)}/`.toLowerCase()
    const entryName = payload.entryName
    if (typeof entryName !== 'string' || !entryName.toLowerCase().startsWith(directoryPrefix) || !entryName.toLowerCase().endsWith('.mose')) {
      throw new Error('Neplatná cesta k SSOA manifestu.')
    }

    const entry = jar.getEntry(entryName)
    if (!entry || entry.isDirectory) {
      throw new Error('SSOA manifest v archivu nebyl nalezen.')
    }

    return { entryName, token: entry.getData().toString('utf8') }
  })

  ipcMain.handle('ssoa:save', async (_event, payload) => {
    if (typeof payload?.token !== 'string' || !payload.token.trim()) {
      throw new Error('SSOA token je prázdný.')
    }
    validateSsoaToken(payload.token)

    const { jar, save } = openJarFromMeta(payload)
    const directoryPrefix = `${getSsoaDirectory(payload.environment)}/`.toLowerCase()
    const entryName = payload.entryName
    if (typeof entryName !== 'string' || !entryName.toLowerCase().startsWith(directoryPrefix) || !entryName.toLowerCase().endsWith('.mose')) {
      throw new Error('Neplatná cesta k SSOA manifestu.')
    }

    const entry = jar.getEntry(entryName)
    if (!entry || entry.isDirectory) {
      throw new Error('SSOA manifest v archivu nebyl nalezen.')
    }

    updateEntryPreservingCompression(jar, entryName, Buffer.from(payload.token.trim(), 'utf8'), getEntryCompressionMethod(entry))
    save()
    return { ok: true }
  })

  ipcMain.handle('manifest:syncOuterWithInner', async (_event, payload) => {
    if (!payload || (payload.kind !== 'zip' && payload.kind !== 'folder')) {
      throw new Error('Synchronizace je dostupná pouze pro ZIP nebo složku.')
    }

    const direction = payload.direction || 'inner-to-outer'

    if (direction !== 'inner-to-outer' && direction !== 'outer-to-inner') {
      throw new Error('Neznámá volba synchronizace.')
    }

    if (payload.kind === 'folder') {
      const { jarFilePath, innerManifestEntryName, outerManifestFilePath } = payload
      if (!jarFilePath || !innerManifestEntryName || !outerManifestFilePath) {
        throw new Error('Chybí data potřebná pro synchronizaci složky.')
      }

      const innerJar = new AdmZip(jarFilePath)
      const innerManifestEntry = innerJar.getEntry(innerManifestEntryName)
      if (!innerManifestEntry) {
        throw new Error('Vnitřní manifest.json nebyl nalezen v JAR.')
      }

      const innerManifestText = normalizeJsonText(innerManifestEntry.getData().toString('utf8'), 'SLOŽKA/JAR manifest')
      const outerManifestRaw = await fs.readFile(outerManifestFilePath, 'utf8')
      const outerManifestText = normalizeJsonText(outerManifestRaw, 'SLOŽKA/outer manifest')

      let syncedText
      if (direction === 'inner-to-outer') {
        syncedText = innerManifestText
        await fs.writeFile(outerManifestFilePath, syncedText, 'utf8')
      } else {
        syncedText = outerManifestText
        updateEntryPreservingCompression(innerJar, innerManifestEntryName, Buffer.from(syncedText, 'utf8'), ZIP_METHOD_STORED)
        innerJar.writeZip(jarFilePath)
      }

      return {
        ok: true,
        syncedText,
        innerManifestText: syncedText,
        outerManifestText: syncedText,
        message:
          direction === 'inner-to-outer'
            ? 'Synchronizace dokončena. Zachována vnitřní podoba a prekopírována do vnějšího manifestu.'
            : 'Synchronizace dokončena. Zachována vnější podoba a prekopírována do vnitřního JAR manifestu.'
      }
    }

    const { filePath, jarEntryName, innerManifestEntryName, outerManifestEntryName } = payload
    if (!filePath || !jarEntryName || !innerManifestEntryName || !outerManifestEntryName) {
      throw new Error('Chybí data potřebná pro synchronizaci ZIP.')
    }

    const zip = new AdmZip(filePath)
    const jarEntry = zip.getEntry(jarEntryName)
    const outerManifestEntry = zip.getEntry(outerManifestEntryName)

    if (!jarEntry || !outerManifestEntry) {
      throw new Error('V ZIP nelze najít JAR nebo externí manifest pro synchronizaci.')
    }

    const innerJar = new AdmZip(jarEntry.getData())
    const innerManifestEntry = innerJar.getEntry(innerManifestEntryName)
    if (!innerManifestEntry) {
      throw new Error('Vnitřní manifest.json nebyl nalezen v JAR.')
    }

    const innerManifestText = normalizeJsonText(innerManifestEntry.getData().toString('utf8'), 'ZIP/JAR manifest')
    const outerManifestText = normalizeJsonText(outerManifestEntry.getData().toString('utf8'), 'ZIP/outer manifest')

    let syncedText
    if (direction === 'inner-to-outer') {
      syncedText = innerManifestText
      updateEntryPreservingCompression(zip, outerManifestEntryName, Buffer.from(syncedText, 'utf8'), ZIP_METHOD_STORED)
    } else {
      syncedText = outerManifestText
      updateEntryPreservingCompression(innerJar, innerManifestEntryName, Buffer.from(syncedText, 'utf8'), ZIP_METHOD_STORED)
      updateEntryPreservingCompression(zip, jarEntryName, innerJar.toBuffer())
    }

    zip.writeZip(filePath)

    return {
      ok: true,
      syncedText,
      innerManifestText: syncedText,
      outerManifestText: syncedText,
      message:
        direction === 'inner-to-outer'
          ? 'Synchronizace dokončena. Zachována vnitřní podoba a prekopírována do vnějšího manifestu.'
          : 'Synchronizace dokončena. Zachována vnější podoba a prekopírována do vnitřního JAR manifestu.'
    }
  })

  ipcMain.handle('manifest:save', async (_event, payload) => {
    if (!payload || !payload.kind || !payload.filePath || typeof payload.editorText !== 'string') {
      throw new Error('Neplatná data pro uložení.')
    }

    const normalizedText = normalizeJsonText(payload.editorText, 'Editor manifest')
    const manifestBuffer = Buffer.from(normalizedText, 'utf8')

    if (payload.kind === 'jar') {
      const jar = new AdmZip(payload.filePath)
      const entry = jar.getEntry(payload.innerManifestEntryName)
      if (!entry) {
        throw new Error('V JAR nelze najít manifest pro uložení.')
      }

      updateEntryPreservingCompression(jar, payload.innerManifestEntryName, manifestBuffer, ZIP_METHOD_STORED)
      jar.writeZip(payload.filePath)

      return { ok: true, normalizedText, message: 'JAR byl úspěšně uložen.' }
    }

    if (payload.kind === 'zip') {
      const zip = new AdmZip(payload.filePath)
      const jarEntry = zip.getEntry(payload.jarEntryName)
      if (!jarEntry) {
        throw new Error('V ZIP nelze najít JAR pro uložení.')
      }

      const innerJar = new AdmZip(jarEntry.getData())
      const innerManifestEntry = innerJar.getEntry(payload.innerManifestEntryName)
      if (!innerManifestEntry) {
        throw new Error('Ve vnitřním JAR nelze najít manifest pro uložení.')
      }

      updateEntryPreservingCompression(innerJar, payload.innerManifestEntryName, manifestBuffer, ZIP_METHOD_STORED)
      updateEntryPreservingCompression(zip, payload.jarEntryName, innerJar.toBuffer())

      // Při uložení ZIP drží vnější manifest synchronizovaný s editovaným vnitřním manifestem.
      if (payload.outerManifestEntryName) {
        updateEntryPreservingCompression(zip, payload.outerManifestEntryName, manifestBuffer, ZIP_METHOD_STORED)
      }

      zip.writeZip(payload.filePath)

      const saveMessage = payload.outerManifestEntryName
        ? 'Oba manifesty byly úspěšně uloženy.'
        : 'Vnitřní JAR manifest byl úspěšně uložen.'

      return {
        ok: true,
        normalizedText,
        message: saveMessage
      }
    }

    if (payload.kind === 'folder') {
      if (!payload.jarFilePath || !payload.innerManifestEntryName) {
        throw new Error('Neplatná data složky pro uložení.')
      }

      const innerJar = new AdmZip(payload.jarFilePath)
      const innerManifestEntry = innerJar.getEntry(payload.innerManifestEntryName)
      if (!innerManifestEntry) {
        throw new Error('Ve vnitřním JAR nelze najít manifest pro uložení.')
      }

      updateEntryPreservingCompression(innerJar, payload.innerManifestEntryName, manifestBuffer, ZIP_METHOD_STORED)
      innerJar.writeZip(payload.jarFilePath)

      if (payload.outerManifestFilePath) {
        await fs.writeFile(payload.outerManifestFilePath, normalizedText, 'utf8')
      }

      return {
        ok: true,
        normalizedText,
        message: payload.outerManifestFilePath
          ? 'Oba manifesty byly úspěšně uloženy.'
          : 'Vnitřní JAR manifest byl úspěšně uložen.'
      }
    }

    throw new Error('Neznámý typ souboru pro uložení.')
  })

  ipcMain.handle('manifest:export', async (_event, payload) => {
    if (!payload || typeof payload.editorText !== 'string') {
      throw new Error('Neplatná data pro export.')
    }

    const normalizedText = normalizeJsonText(payload.editorText, 'Export manifest')
    const sourceDir = payload.sourceFilePath
      ? payload.kind === 'folder'
        ? payload.sourceFilePath
        : path.dirname(payload.sourceFilePath)
      : null
    const defaultDir = sourceDir || app.getPath('documents')
    const defaultPath = path.join(defaultDir, 'manifest.json')

    const result = await dialog.showSaveDialog({
      title: 'Vyberte cílový soubor pro export manifest.json',
      defaultPath,
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return {
        ok: false,
        canceled: true,
        message: 'Export byl zrušen.'
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
      message: `Manifest byl vyexportován do ${targetFilePath}`
    }
  })

  ipcMain.handle('jar:changeVersion', async (_event, payload) => {
    const {
      kind,
      filePath,
      jarFilePath,
      jarEntryName,
      innerManifestEntryName,
      outerManifestFilePath,
      outerManifestEntryName,
      oldVersion,
      newVersion
    } = payload

    if (!oldVersion || typeof oldVersion !== 'string' || !oldVersion.trim()) {
      throw new Error('Chybí aktuální číslo verze.')
    }
    if (!newVersion || typeof newVersion !== 'string' || !newVersion.trim()) {
      throw new Error('Chybí nové číslo verze.')
    }
    if (oldVersion.trim() === newVersion.trim()) {
      throw new Error('Nová verze je shodná se stávající.')
    }

    const changedFiles = []

    function replaceInBuffer(buf, displayName) {
      // Skip binary files – null bytes are a reliable indicator of binary content
      if (buf.indexOf(0) !== -1) return null
      const text = buf.toString('utf8')
      if (!text.includes(oldVersion)) return null
      const newText = text.split(oldVersion).join(newVersion)
      changedFiles.push(displayName)
      return Buffer.from(newText, 'utf8')
    }

    let newManifestText = null

    if (kind === 'jar') {
      const jar = new AdmZip(filePath)
      for (const entry of jar.getEntries()) {
        if (entry.isDirectory) continue
        const newBuf = replaceInBuffer(entry.getData(), entry.entryName)
        if (newBuf) {
          updateEntryPreservingCompression(jar, entry.entryName, newBuf, getEntryCompressionMethod(entry))
          if (entry.entryName === innerManifestEntryName) {
            try { newManifestText = normalizeJsonText(newBuf.toString('utf8'), 'manifest po změně verze') } catch (_e) { /* ignore */ }
          }
        }
      }
      jar.writeZip(filePath)

      if (!newManifestText) {
        const jar2 = new AdmZip(filePath)
        const mEntry = jar2.getEntry(innerManifestEntryName)
        if (mEntry) {
          try { newManifestText = normalizeJsonText(mEntry.getData().toString('utf8'), 'manifest') } catch (_e) { /* ignore */ }
        }
      }
    } else if (kind === 'zip') {
      const zip = new AdmZip(filePath)

      if (outerManifestEntryName) {
        const outerEntry = zip.getEntry(outerManifestEntryName)
        if (outerEntry) {
          const newBuf = replaceInBuffer(outerEntry.getData(), outerManifestEntryName)
          if (newBuf) updateEntryPreservingCompression(zip, outerManifestEntryName, newBuf, getEntryCompressionMethod(outerEntry))
        }
      }

      const jarEntry = zip.getEntry(jarEntryName)
      if (!jarEntry) throw new Error('V ZIP nelze najít JAR.')

      const innerJar = new AdmZip(jarEntry.getData())
      for (const entry of innerJar.getEntries()) {
        if (entry.isDirectory) continue
        const displayName = `${jarEntryName} > ${entry.entryName}`
        const newBuf = replaceInBuffer(entry.getData(), displayName)
        if (newBuf) {
          updateEntryPreservingCompression(innerJar, entry.entryName, newBuf, getEntryCompressionMethod(entry))
          if (entry.entryName === innerManifestEntryName) {
            try { newManifestText = normalizeJsonText(newBuf.toString('utf8'), 'manifest po změně verze') } catch (_e) { /* ignore */ }
          }
        }
      }

      updateEntryPreservingCompression(zip, jarEntryName, innerJar.toBuffer(), getEntryCompressionMethod(jarEntry))
      zip.writeZip(filePath)
    } else if (kind === 'folder') {
      if (outerManifestFilePath) {
        const raw = await fs.readFile(outerManifestFilePath, 'utf8')
        if (raw.includes(oldVersion)) {
          const newText = raw.split(oldVersion).join(newVersion)
          await fs.writeFile(outerManifestFilePath, newText, 'utf8')
          changedFiles.push(outerManifestFilePath)
        }
      }

      const targetJarPath = jarFilePath
      const innerJar = new AdmZip(targetJarPath)
      for (const entry of innerJar.getEntries()) {
        if (entry.isDirectory) continue
        const newBuf = replaceInBuffer(entry.getData(), entry.entryName)
        if (newBuf) {
          updateEntryPreservingCompression(innerJar, entry.entryName, newBuf, getEntryCompressionMethod(entry))
          if (entry.entryName === innerManifestEntryName) {
            try { newManifestText = normalizeJsonText(newBuf.toString('utf8'), 'manifest po změně verze') } catch (_e) { /* ignore */ }
          }
        }
      }
      innerJar.writeZip(targetJarPath)
    } else {
      throw new Error('Neznámý typ souboru pro změnu verze.')
    }

    return { ok: true, changedFiles, newManifestText }
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