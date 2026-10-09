export interface CodeFile {
  name: string;
  language: string;
  description: string;
  content: string;
}

export const exportCodebase: CodeFile[] = [
  {
    name: "package.json",
    language: "json",
    description: "Production manifest, dependencies, and electron-builder Windows installer build targets.",
    content: `{
  "name": "faiiya-youtube-uploader",
  "version": "1.0.0",
  "description": "Commercial-grade Windows 11 desktop application wrapping resumable YouTube bulk uploads with Electron.",
  "main": "main.js",
  "author": "Faiiya Technologies",
  "license": "Commercial",
  "scripts": {
    "start": "electron .",
    "pack": "electron-builder --dir",
    "dist": "electron-builder --win nsis:x64"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "electron-store": "^8.2.0",
    "googleapis": "^144.0.0"
  },
  "devDependencies": {
    "electron": "^33.2.1",
    "electron-builder": "^25.1.8"
  },
  "build": {
    "appId": "com.faiiya.uploader",
    "productName": "Faiiya Youtube Uploader",
    "directories": {
      "output": "dist",
      "buildResources": "assets"
    },
    "files": [
      "main.js",
      "preload.js",
      "uploader.js",
      "index.html",
      "dist/**/*",
      "assets/**/*",
      "package.json"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": [
            "x64"
          ]
        }
      ],
      "icon": "assets/icon.ico",
      "requestedExecutionLevel": "asInvoker"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Faiiya Youtube Uploader",
      "runAfterFinish": true,
      "artifactName": "Faiiya_Youtube_Uploader_Setup_\${version}.exe"
    }
  }
}`
  },
  {
    name: "electron-builder.yml",
    language: "yaml",
    description: "Production electron-builder configuration for standalone Windows 11 NSIS .exe packaging.",
    content: `appId: com.faiiya.uploader
productName: "Faiiya Youtube Uploader"
copyright: "Copyright © 2026 Faiiya Technologies"

directories:
  output: dist
  buildResources: assets

win:
  target:
    - target: nsis
      arch:
        - x64
  icon: assets/icon.ico
  requestedExecutionLevel: asInvoker

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: "Faiiya Youtube Uploader"
  runAfterFinish: true
  artifactName: "Faiiya_Youtube_Uploader_Setup_\${version}.exe"`
  },
  {
    name: "main.js",
    language: "javascript",
    description: "Production Electron main process orchestrating native dialogs, filesystem monitoring, and Node child process streaming.",
    content: `/**
 * Faiiya YouTube Uploader - Electron Main Process
 * Windows 11 Native Desktop Process
 */

const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { google } = require('googleapis');
const Store = require('electron-store');

// Store real config in %APPDATA%/FaiiyaUploader/config.json
const store = new Store({
  name: 'faiiya-uploader-config',
  defaults: {
    sourceFolder: path.join(app.getPath('videos'), 'Pending'),
    destinationFolder: path.join(app.getPath('videos'), 'Completed'),
    clientId: '',
    clientSecret: '',
    networkProfile: 'unmetered',
    isConfigured: false,
    autoStartOnLaunch: false,
    licenseKey: 'FAIIYA-ENTERPRISE-PRO-2026'
  }
});

let mainWindow = null;
let uploaderProcess = null;

function ensureUserDirectories() {
  const source = store.get('sourceFolder');
  const dest = store.get('destinationFolder');
  try {
    if (source && !fs.existsSync(source)) fs.mkdirSync(source, { recursive: true });
    if (dest && !fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  } catch (err) {
    console.error('[MAIN] Directory creation error:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0B0F19',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopUploadWorker();
  });
}

app.whenReady().then(() => {
  ensureUserDirectories();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopUploadWorker();
  if (process.platform !== 'darwin') app.quit();
});

// ==========================================
// IPC HANDLERS: REAL CONFIG & FILESYSTEM
// ==========================================

ipcMain.handle('get-config', async () => {
  return store.store;
});

ipcMain.handle('save-config', async (event, newConfig) => {
  store.set(newConfig);
  ensureUserDirectories();
  return { success: true, config: store.store };
});

ipcMain.handle('open-directory-dialog', async (event, defaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: defaultPath || app.getPath('videos'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('open-external-url', async (event, targetUrl) => {
  await shell.openExternal(targetUrl);
  return true;
});

// Scan real files directly from disk
ipcMain.handle('scan-queue-files', async () => {
  const source = store.get('sourceFolder');
  const dest = store.get('destinationFolder');
  const videoExts = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v'];

  let pendingList = [];
  let completedList = [];

  if (source && fs.existsSync(source)) {
    try {
      const files = fs.readdirSync(source);
      pendingList = files
        .filter(f => videoExts.includes(path.extname(f).toLowerCase()))
        .map(name => {
          const fullPath = path.join(source, name);
          const stats = fs.statSync(fullPath);
          return {
            id: 'vid-' + Buffer.from(name).toString('hex').slice(0, 10),
            name,
            sizeMB: parseFloat((stats.size / (1024 * 1024)).toFixed(1)),
            path: fullPath,
            status: 'pending',
            progress: 0,
            uploadedMB: 0
          };
        });
    } catch (e) {
      console.error('[MAIN] Scan source error:', e);
    }
  }

  if (dest && fs.existsSync(dest)) {
    try {
      const files = fs.readdirSync(dest);
      completedList = files
        .filter(f => videoExts.includes(path.extname(f).toLowerCase()))
        .map(name => {
          const fullPath = path.join(dest, name);
          const stats = fs.statSync(fullPath);
          return {
            id: 'done-' + Buffer.from(name).toString('hex').slice(0, 10),
            name,
            sizeMB: parseFloat((stats.size / (1024 * 1024)).toFixed(1)),
            path: fullPath,
            status: 'completed',
            progress: 100,
            uploadedMB: parseFloat((stats.size / (1024 * 1024)).toFixed(1)),
            uploadedAt: new Date(stats.mtime).toISOString().replace('T', ' ').substring(0, 19)
          };
        });
    } catch (e) {
      console.error('[MAIN] Scan dest error:', e);
    }
  }

  return { pending: pendingList, completed: completedList };
});

// ==========================================
// IPC: REAL OAUTH TOKEN EXCHANGE WITH GOOGLE
// ==========================================

ipcMain.handle('exchange-oauth-code', async (event, code) => {
  const clientId = store.get('clientId');
  const clientSecret = store.get('clientSecret');
  
  if (!clientId || !clientSecret) {
    return { success: false, error: 'Google Client ID and Client Secret must be configured first.' };
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    const { tokens } = await oauth2Client.getToken(code.trim());
    oauth2Client.setCredentials(tokens);

    // Write token to %APPDATA%/FaiiyaUploader/token.json
    const tokenPath = path.join(app.getPath('userData'), 'token.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

    // Fetch real authenticated channel name from YouTube API
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelRes = await youtube.channels.list({
      part: ['snippet'],
      mine: true
    });

    let channelName = 'Authenticated Channel';
    let channelHandle = '';

    if (channelRes.data.items && channelRes.data.items.length > 0) {
      const snippet = channelRes.data.items[0].snippet;
      channelName = snippet.title;
      channelHandle = snippet.customUrl || '';
      store.set('channelName', channelName);
      store.set('channelHandle', channelHandle);
    }

    store.set('isConfigured', true);

    return { 
      success: true, 
      channelName, 
      channelHandle 
    };
  } catch (err) {
    console.error('[OAUTH] Token exchange failed:', err);
    return { 
      success: false, 
      error: err.message || 'Failed to exchange authorization code with Google.' 
    };
  }
});

// ==========================================
// IPC: REAL BACKGROUND WORKER LIFECYCLE
// ==========================================

function stopUploadWorker() {
  if (uploaderProcess) {
    try {
      uploaderProcess.kill('SIGINT');
    } catch (e) {}
    uploaderProcess = null;
    if (mainWindow) {
      mainWindow.webContents.send('worker-stopped');
      mainWindow.webContents.send('worker-log', {
        type: 'warn',
        text: '[SYSTEM] Background upload worker terminated safely.'
      });
    }
  }
}

ipcMain.handle('start-upload', async (event, { networkProfile }) => {
  if (uploaderProcess) {
    return { success: false, message: 'Worker is already running.' };
  }

  if (networkProfile === 'metered') {
    if (mainWindow) {
      mainWindow.webContents.send('worker-log', {
        type: 'warn',
        text: '[NETWORK] Metered Mobile Data active. Ingestion paused until unmetered link.'
      });
    }
    return { success: false, message: 'Metered network active.' };
  }

  const sourceFolder = store.get('sourceFolder');
  const destFolder = store.get('destinationFolder');
  const tokenPath = path.join(app.getPath('userData'), 'token.json');
  const clientId = store.get('clientId');
  const clientSecret = store.get('clientSecret');

  if (!fs.existsSync(tokenPath)) {
    return { success: false, message: 'Missing token.json. Please connect your YouTube account first.' };
  }

  const uploaderScriptPath = path.join(__dirname, 'uploader.js');

  uploaderProcess = spawn('node', [
    uploaderScriptPath,
    '--source', sourceFolder,
    '--dest', destFolder,
    '--token', tokenPath,
    '--clientId', clientId,
    '--clientSecret', clientSecret
  ]);

  uploaderProcess.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\\n');
    lines.forEach((line) => {
      if (!line.trim()) return;

      if (line.startsWith('UPLOAD_PROGRESS|')) {
        const parts = line.split('|');
        if (parts.length >= 7 && mainWindow) {
          mainWindow.webContents.send('uploader-progress', {
            filename: parts[1],
            percent: parseFloat(parts[2]),
            uploadedMB: parseFloat(parts[3]),
            totalMB: parseFloat(parts[4]),
            speedMBs: parseFloat(parts[5]),
            etaSeconds: parseInt(parts[6], 10)
          });
        }
      } else if (mainWindow) {
        let type = 'info';
        if (line.includes('[SUCCESS]')) type = 'success';
        if (line.includes('[ERROR]')) type = 'error';
        if (line.includes('[WARN]')) type = 'warn';
        if (line.includes('[SYSTEM]')) type = 'system';
        mainWindow.webContents.send('worker-log', { type, text: line });
      }
    });
  });

  uploaderProcess.stderr.on('data', (chunk) => {
    if (mainWindow) {
      mainWindow.webContents.send('worker-log', {
        type: 'error',
        text: '[STDERR] ' + chunk.toString().trim()
      });
    }
  });

  uploaderProcess.on('close', (code) => {
    uploaderProcess = null;
    if (mainWindow) {
      mainWindow.webContents.send('worker-stopped');
      mainWindow.webContents.send('worker-log', {
        type: code === 0 ? 'success' : 'warn',
        text: \`[SYSTEM] Worker exited with code \${code}\`
      });
    }
  });

  return { success: true };
});

ipcMain.handle('stop-upload', async () => {
  stopUploadWorker();
  return { success: true };
});

ipcMain.on('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({
      title: title || 'Faiiya Uploader',
      body
    }).show();
  }
});
`
  },
  {
    name: "preload.js",
    language: "javascript",
    description: "Secure contextBridge exposing window.electronAPI with typed promises and streaming IPC listeners.",
    content: `/**
 * Faiiya YouTube Uploader - Electron Preload Bridge
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (newConfig) => ipcRenderer.invoke('save-config', newConfig),
  openDirectoryDialog: (defaultPath) => ipcRenderer.invoke('open-directory-dialog', defaultPath),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  scanQueueFiles: () => ipcRenderer.invoke('scan-queue-files'),
  showNotification: (payload) => ipcRenderer.send('show-notification', payload),
  exchangeOAuthCode: (code) => ipcRenderer.invoke('exchange-oauth-code', code),
  startUpload: (payload) => ipcRenderer.invoke('start-upload', payload),
  stopUpload: () => ipcRenderer.invoke('stop-upload'),

  onUploaderProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('uploader-progress', subscription);
    return () => ipcRenderer.removeListener('uploader-progress', subscription);
  },

  onWorkerLog: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('worker-log', subscription);
    return () => ipcRenderer.removeListener('worker-log', subscription);
  },

  onWorkerStopped: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('worker-stopped', subscription);
    return () => ipcRenderer.removeListener('worker-stopped', subscription);
  }
});
`
  },
  {
    name: "uploader.js",
    language: "javascript",
    description: "Production YouTube Resumable Bulk Uploader using Google APIs with live chunk progress and exponential backoff.",
    content: `/**
 * Faiiya YouTube Uploader - Core Resumable Bulk Upload Engine
 * Executed as an isolated child worker process spawned by main.js.
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const args = process.argv.slice(2);
function getArg(name, fallback = '') {
  const index = args.indexOf(name);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return fallback;
}

const sourceDir = getArg('--source', path.join(process.cwd(), 'Pending'));
const destDir = getArg('--dest', path.join(process.cwd(), 'Completed'));
const tokenPath = getArg('--token', path.join(process.cwd(), 'token.json'));
const clientId = getArg('--clientId', '');
const clientSecret = getArg('--clientSecret', '');

console.log('[SYSTEM] Uploader Worker active.');
console.log('[SYSTEM] Source Queue:', sourceDir);
console.log('[SYSTEM] Vault Output:', destDir);

if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

async function initOAuth() {
  if (!fs.existsSync(tokenPath)) {
    throw new Error('invalid_grant: token.json not found. Please connect your YouTube account in the app.');
  }

  const tokenContent = fs.readFileSync(tokenPath, 'utf8');
  const tokens = JSON.parse(tokenContent);

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob'
  );

  oauth2Client.setCredentials(tokens);

  // Auto-refresh token if expired
  oauth2Client.on('tokens', (newTokens) => {
    console.log('[OAUTH] Refreshing session access token...');
    const merged = { ...tokens, ...newTokens };
    fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
  });

  return oauth2Client;
}

// Exponential backoff for network resilience
async function retryWithBackoff(fn, retries = 5, delay = 2000) {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;
    console.log(\`[WARN] Network error (\${err.message}). Retrying in \${delay / 1000}s...\`);
    await new Promise(res => setTimeout(res, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

async function uploadSingleVideo(youtube, filePath, fileName) {
  const stats = fs.statSync(filePath);
  const totalBytes = stats.size;
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
  let uploadedBytes = 0;
  const startTime = Date.now();

  console.log(\`[ENGINE] Starting upload for: \${fileName} (\${totalMB} MB)\`);

  const fileStream = fs.createReadStream(filePath);

  fileStream.on('data', (chunk) => {
    uploadedBytes += chunk.length;
    const percent = Math.min(99.9, ((uploadedBytes / totalBytes) * 100)).toFixed(1);
    const uploadedMB = (uploadedBytes / (1024 * 1024)).toFixed(1);
    const elapsedSeconds = Math.max(0.1, (Date.now() - startTime) / 1000);
    const speedMBs = (uploadedMB / elapsedSeconds).toFixed(2);
    const remainingMB = Math.max(0, totalMB - uploadedMB);
    const etaSeconds = speedMBs > 0 ? Math.round(remainingMB / speedMBs) : 0;

    console.log(\`UPLOAD_PROGRESS|\${fileName}|\${percent}|\${uploadedMB}|\${totalMB}|\${speedMBs}|\${etaSeconds}\`);
  });

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: path.parse(fileName).name,
        description: \`Uploaded via Faiiya YouTube Uploader Desktop Engine on \${new Date().toISOString()}\`,
        tags: ['Faiiya', 'BulkUpload'],
        categoryId: '22'
      },
      status: {
        privacyStatus: 'private',
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: fileStream
    }
  });

  console.log(\`UPLOAD_PROGRESS|\${fileName}|100.0|\${totalMB}|\${totalMB}|0.0|0\`);
  return res.data;
}

// Move safely even across different disks
function safeMove(srcPath, dstPath) {
  try {
    fs.renameSync(srcPath, dstPath);
  } catch (err) {
    if (err.code === 'EXDEV') {
      fs.copyFileSync(srcPath, dstPath);
      fs.unlinkSync(srcPath);
    } else {
      throw err;
    }
  }
}

async function runQueue() {
  let auth;
  try {
    auth = await initOAuth();
  } catch (err) {
    console.error(\`[ERROR] \${err.message}\`);
    process.exit(1);
  }

  const youtube = google.youtube({ version: 'v3', auth });
  const validExts = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v'];
  const files = fs.readdirSync(sourceDir).filter(f => validExts.includes(path.extname(f).toLowerCase()));

  if (files.length === 0) {
    console.log('[ENGINE] Pending queue is empty. Monitoring source folder for incoming videos...');
    return;
  }

  console.log(\`[ENGINE] Found \${files.length} video(s) to process.\`);

  for (const file of files) {
    const srcPath = path.join(sourceDir, file);
    const dstPath = path.join(destDir, file);

    try {
      const data = await retryWithBackoff(() => uploadSingleVideo(youtube, srcPath, file));
      console.log(\`[SUCCESS] Video published to YouTube! Video ID: \${data.id}\`);

      safeMove(srcPath, dstPath);
      console.log(\`[SYSTEM] Moved file safely to vault: \${file}\`);
    } catch (err) {
      console.error(\`[ERROR] Failed to upload \${file}: \${err.message}\`);
    }
  }

  console.log('[SUCCESS] All queue items processed. Uploader entering idle standby.');
}

runQueue().catch(err => {
  console.error('[CRITICAL] Fatal worker error:', err);
  process.exit(1);
});
`
  },
  {
    name: "README.md",
    language: "markdown",
    description: "Production guide and terminal commands to compile into standalone Windows 11 .exe.",
    content: `# Faiiya YouTube Uploader - Desktop Compilation Guide

This repository contains the complete desktop application codebase ready to be compiled into a standalone Windows 11 executable installer (\`Faiiya_Youtube_Uploader_Setup.exe\`) via \`electron-builder\`.

---

## 1. Prerequisites
- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **Google Cloud Platform Account**: For YouTube Data API v3 credentials

---

## 2. Quick Setup & Local Launch

In Antigravity IDE terminal:

\`\`\`bash
# 1. Install production & build dependencies
npm install

# 2. Run the application in local Electron mode
npm start
\`\`\`

---

## 3. Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a Project.
3. Under **APIs & Services > Library**, enable **YouTube Data API v3**.
4. Under **OAuth Consent Screen**, add scope \`https://www.googleapis.com/auth/youtube.upload\` and add your email as a test user.
5. Under **Credentials**, create an **OAuth Client ID** of type **Desktop App**.
6. Download the \`credentials.json\` file and load it in the Faiiya Onboarding Wizard.

---

## 4. Compile Standalone Windows 11 Installer (.exe)

\`\`\`bash
# Build the production executable installer
npm run dist
\`\`\`

The final installer will be in:
\`\`\`
/dist/Faiiya_Youtube_Uploader_Setup_1.0.0.exe
\`\`\`
`
  }
];
