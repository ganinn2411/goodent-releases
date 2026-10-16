const { app, BrowserWindow, session, shell, Menu, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

// Tek pencere: uygulama ikinci kez açılırsa mevcut pencereyi öne getir
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let win = null

// ---- Otomatik güncelleme (electron-updater) ----
// Güncelleme adresi package.json > build.publish içinde tanımlıdır.
// Yeni sürüm yayınlanınca her bilgisayar açılışta ve her 30 dakikada bir kontrol eder,
// arka planda indirir, sonra "yeniden başlat" diye sorar (sormazsa uygulama kapanınca kurar).
function setupAutoUpdate() {
  if (!app.isPackaged) return // geliştirme modunda çalışmasın
  let autoUpdater
  try {
    ;({ autoUpdater } = require('electron-updater'))
  } catch (e) {
    console.error('electron-updater bulunamadı:', e.message)
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async (info) => {
    const r = await dialog.showMessageBox(win || undefined, {
      type: 'info',
      buttons: ['Şimdi yeniden başlat', 'Sonra'],
      defaultId: 0,
      cancelId: 1,
      title: 'Güncelleme hazır',
      message: `Yeni sürüm (${info.version}) indirildi.`,
      detail: 'Güncellemek için uygulamayı yeniden başlatın. "Sonra" derseniz uygulamayı kapattığınızda otomatik kurulur.',
    })
    if (r.response === 0) autoUpdater.quitAndInstall()
  })
  autoUpdater.on('error', (e) => console.error('Güncelleme hatası:', e && e.message))

  const check = () => autoUpdater.checkForUpdates().catch(() => {})
  check()
  setInterval(check, 30 * 60 * 1000)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    title: 'Goodent Laboratuvar',
    autoHideMenuBar: true,
    backgroundColor: '#0b1220',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  Menu.setApplicationMenu(null)

  // vite build çıktısı: dist/index.html (vite.config.js içinde base: './')
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  // Dış bağlantıları varsayılan tarayıcıda aç
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('closed', () => { win = null })
}

// Etiket yazdırma (50x30 mm): gizli pencerede HTML'i açıp yazdırır
ipcMain.handle('print-html', (_e, html) =>
  new Promise((resolve) => {
    const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    w.webContents.once('did-finish-load', async () => {
      try {
        // QR resmi tamamen çözülsün
        await w.webContents.executeJavaScript(
          'Promise.all([...document.images].map(i => i.decode ? i.decode().catch(() => {}) : Promise.resolve()))'
        )
        await new Promise((r) => setTimeout(r, 300))
        // Sürücü sayfa boyutunu bozmasın diye önce 50x30 mm PDF üret (CSS @page boyutu geçerli)
        const pdf = await w.webContents.printToPDF({
          preferCSSPageSize: true,
          printBackground: true,
          margins: { marginType: 'none' },
        })
        const file = path.join(app.getPath('temp'), `goodent-etiket-${Date.now()}.pdf`)
        fs.writeFileSync(file, pdf)
        // PDF görüntüleyicide açılır: etiketi görürsün, oradan yazıcıya gönderirsin
        const err = await shell.openPath(file)
        resolve({ ok: !err, reason: err || '' })
      } catch (e) {
        resolve({ ok: false, reason: String(e) })
      } finally {
        w.close()
      }
    })
  })
)

if (gotLock) app.whenReady().then(() => {
  // Kamera (barkod/QR okutma) izni
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(['media', 'camera', 'mediaKeySystem'].includes(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    ['media', 'camera'].includes(permission)
  )

  createWindow()
  setupAutoUpdate()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
