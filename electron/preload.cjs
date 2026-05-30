const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('noExif', {
  selectImages: () => ipcRenderer.invoke('images:select'),
  inspectImages: paths => ipcRenderer.invoke('bridge:inspect', paths),
  loadPreview: path => ipcRenderer.invoke('bridge:preview', path),
  chooseExportPath: format => ipcRenderer.invoke('export:saveDialog', format),
  chooseExifOutputDirectory: () => ipcRenderer.invoke('exif:outputDirectory'),
  removeExifBatch: payload => ipcRenderer.invoke('bridge:removeExif', payload),
  exportGrid: payload => ipcRenderer.invoke('bridge:export', payload),
  openPath: targetPath => ipcRenderer.invoke('shell:openPath', targetPath),
  showItemInFolder: targetPath => ipcRenderer.invoke('shell:showItemInFolder', targetPath),
  saveMetadataJson: payload => ipcRenderer.invoke('metadata:saveJson', payload),
  savePromptCardPng: payload => ipcRenderer.invoke('prompt-card:savePng', payload),
  choosePixivOutputDirectory: () => ipcRenderer.invoke('pixiv:chooseOutputDirectory'),
  listPixivWorks: payload => ipcRenderer.invoke('pixiv:list', payload),
  downloadPixivWorks: payload => ipcRenderer.invoke('pixiv:download', payload),
  saveTemplate: payload => ipcRenderer.invoke('template:save', payload),
  loadTemplate: () => ipcRenderer.invoke('template:load'),
  getDroppedFilePaths: files => Array.from(files || [])
    .map(file => webUtils.getPathForFile(file))
    .filter(Boolean),
});
