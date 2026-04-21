
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: () => 'pong',
  getPathForFile: (file) => {
    if (!file || typeof webUtils?.getPathForFile !== 'function') {
      return null
    }

    const filePath = webUtils.getPathForFile(file)
    return typeof filePath === 'string' && filePath.trim() ? filePath : null
  },
  pickManifestFile: () => ipcRenderer.invoke('manifest:pickFile'),
  pickManifestFolder: () => ipcRenderer.invoke('manifest:pickFolder'),
  getPathType: (targetPath) => ipcRenderer.invoke('manifest:getPathType', targetPath),
  getThemeMode: () => ipcRenderer.invoke('theme:get'),
  setThemeMode: (mode) => ipcRenderer.invoke('theme:set', mode),
  toggleThemeMode: () => ipcRenderer.invoke('theme:toggle'),
  onThemeModeChanged: (listener) => {
    if (typeof listener !== 'function') {
      return () => {}
    }

    const wrappedListener = (_event, mode) => listener(mode)
    ipcRenderer.on('theme:changed', wrappedListener)
    return () => ipcRenderer.removeListener('theme:changed', wrappedListener)
  },
  onAppReset: (listener) => {
    if (typeof listener !== 'function') {
      return () => {}
    }

    const wrappedListener = () => listener()
    ipcRenderer.on('app:reset', wrappedListener)
    return () => ipcRenderer.removeListener('app:reset', wrappedListener)
  },
  loadManifestFile: (filePath) => ipcRenderer.invoke('manifest:load', filePath),
  loadManifestFolder: (folderPath) => ipcRenderer.invoke('manifest:loadFolder', folderPath),
  syncZipManifest: (payload) => ipcRenderer.invoke('manifest:syncOuterWithInner', payload),
  saveManifestFile: (payload) => ipcRenderer.invoke('manifest:save', payload),
  exportManifestFile: (payload) => ipcRenderer.invoke('manifest:export', payload),
  changeVersion: (payload) => ipcRenderer.invoke('jar:changeVersion', payload)
});
