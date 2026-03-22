import {
  app, BrowserWindow, ipcMain, net, session,
  Menu, dialog, clipboard,
} from 'electron';
import { join, basename } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { autoUpdater } from 'electron-updater';

// Enable Web MIDI API in the Chromium renderer.
// Must be set before app.whenReady() — command-line switches are read at startup.
app.commandLine.appendSwitch('enable-features', 'WebMIDI,WebMIDIInSecureContext');
app.commandLine.appendSwitch('enable-blink-features', 'WebMIDI');

// ─── Window state ──────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let pendingMidiPath: string | null = null;

interface WindowState {
  x?: number; y?: number;
  width: number; height: number;
  isMaximized?: boolean;
}

const stateFile = join(app.getPath('userData'), 'window-state.json');

function loadWindowState(): WindowState {
  try { return JSON.parse(readFileSync(stateFile, 'utf8')); }
  catch { return { width: 1280, height: 900 }; }
}

function saveWindowState(): void {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  writeFileSync(stateFile, JSON.stringify({ ...bounds, isMaximized: mainWindow.isMaximized() }));
}

// ─── File associations ─────────────────────────────────────────────────────

// Mac: fires when user double-clicks a .mid file in Finder
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('open-midi-file', filePath);
  } else {
    pendingMidiPath = filePath;
  }
});

// Windows / Linux: .mid path comes through process.argv
function getMidiFromArgv(): string | null {
  const arg = process.argv.slice(1).find((a) => /\.midi?$/i.test(a));
  return arg && existsSync(arg) ? arg : null;
}

// ─── App menu ──────────────────────────────────────────────────────────────

function buildMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [

    // macOS app menu (required — gives Quit, Hide, About)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),

    // File
    {
      label: 'File',
      submenu: [
        {
          label: 'Open MIDI File\u2026',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (!mainWindow) return;
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'Open MIDI File',
              filters: [{ name: 'MIDI Files', extensions: ['mid', 'midi'] }],
              properties: ['openFile'],
            });
            if (!canceled && filePaths[0]) {
              mainWindow.webContents.send('open-midi-file', filePaths[0]);
            }
          },
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // Edit — gives Cut / Copy / Paste / Select All in text inputs
    { role: 'editMenu' as const },

    // View — Dev Tools in dev, reload, fullscreen
    { role: 'viewMenu' as const },

    // Help
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Setup Guide',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'Keyboard Setup',
              message: 'Connecting your MIDI keyboard',
              detail:
                'Piano Tutor works with Casio, Yamaha, Roland, Korg, and most USB MIDI keyboards.\n\n' +
                '1. Plug your keyboard into a USB port\n' +
                '2. Turn the keyboard on\n' +
                '3. The status indicator at the top of Piano Tutor will turn green\n\n' +
                'If it stays red, click Retry or try a different USB port.',
              buttons: ['OK'],
            });
          },
        },
        {
          label: 'Enable LED Key Lighting (Casio LK-S250)',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'Enable LED Key Lighting',
              message: 'One-time setup for Casio LK-S250 LED lighting',
              detail:
                'Do this once — the setting saves on the keyboard permanently.\n\n' +
                '1. Press the FUNCTION button on your keyboard\n' +
                '2. Press \u25ba until you see "MIDIInNavigate"\n' +
                '3. Press + to change it from "Off" to "Listen"\n' +
                '4. Press \u25ba to go to "MIDIInNavi R Ch"\n' +
                '5. Press + / \u2212 to set it to "4"\n' +
                '6. Press FUNCTION to exit\n\n' +
                'That\'s it. Keys will now light up during lessons.',
              buttons: ['OK'],
            });
          },
        },
        ...(isMac ? [{
          label: 'Fix \u201cApp Can\u2019t Be Opened\u201d (Mac)',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'Mac Security Warning Fix',
              message: 'macOS blocked Piano Tutor from opening?',
              detail:
                'macOS sometimes blocks apps from unidentified developers.\n\n' +
                'To fix it, open Terminal (Applications \u2192 Utilities \u2192 Terminal) and run:\n\n' +
                'xattr -dr com.apple.quarantine "/Applications/Piano Tutor.app"\n\n' +
                'Click "Copy Command" to copy it to your clipboard.',
              buttons: ['Copy Command', 'OK'],
            }).then(({ response }) => {
              if (response === 0) {
                clipboard.writeText('xattr -dr com.apple.quarantine "/Applications/Piano Tutor.app"');
              }
            });
          },
        }] : []),
        { type: 'separator' as const },
        { label: `Version ${app.getVersion()}`, enabled: false },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Window creation ───────────────────────────────────────────────────────

function createWindow(): void {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 960,
    minHeight: 700,
    title: 'Piano Tutor',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox must be off for Web MIDI hardware access to work in Electron 20+
      sandbox: false,
    },
  });

  if (state.isMaximized) mainWindow.maximize();

  // Persist window bounds on every close
  mainWindow.on('close', saveWindowState);

  // Auto-approve MIDI permissions — no prompt on every launch.
  // Both handlers are required in Electron 20+:
  //   setPermissionCheckHandler  → answers "do I have permission?" (sync)
  //   setPermissionRequestHandler → answers the explicit request prompt (async)
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'midi' || permission === 'midiSysex';
  });
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'midi' || permission === 'midiSysex');
  });

  // Load app
  const isDev = !app.isPackaged;
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Dispatch any pending file-open (opened from Finder before window was ready)
  mainWindow.webContents.once('did-finish-load', () => {
    const path = pendingMidiPath ?? getMidiFromArgv();
    if (path) {
      mainWindow!.webContents.send('open-midi-file', path);
      pendingMidiPath = null;
    }
  });
}

// ─── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  // Auto-updater — only runs in packaged builds.
  // autoDownload is disabled so the user is prompted before anything is downloaded.
  if (app.isPackaged) {
    autoUpdater.autoDownload = false;

    autoUpdater.on('update-available', () => {
      dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Update Available',
        message: 'A new version of Piano Tutor is available.',
        detail: 'Would you like to download and install it now?',
        buttons: ['Download', 'Later'],
      }).then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate();
      });
    });

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Update Ready',
        message: 'Piano Tutor has been updated.',
        detail: 'Restart the app to apply the update.',
        buttons: ['Restart Now', 'Later'],
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });

    autoUpdater.checkForUpdates();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC: read local MIDI file ─────────────────────────────────────────────
// Used when a .mid file is opened via file association or File > Open.
// Path is validated to .mid/.midi only — prevents arbitrary file reads.

ipcMain.handle(
  'read-midi-file',
  (_event, filePath: string): { data: string; name: string } | { error: string } => {
    if (!/\.midi?$/i.test(filePath)) {
      return { error: 'Only .mid and .midi files are supported.' };
    }
    try {
      const buf = readFileSync(filePath);
      return { data: buf.toString('base64'), name: basename(filePath) };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }
);

// ─── IPC: BitMidi proxy ────────────────────────────────────────────────────
// Main process has no CORS restrictions — fetches on behalf of the renderer.
// URL is validated against an allowlist to prevent SSRF.

const BITMIDI_ALLOWED_HOSTS = new Set(['bitmidi.com', 'www.bitmidi.com']);

ipcMain.handle(
  'fetch-bitmidi',
  async (
    _event,
    url: string
  ): Promise<
    | { type: 'json'; data: unknown }
    | { type: 'binary'; data: string }
    | { type: 'error'; message: string }
  > => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !BITMIDI_ALLOWED_HOSTS.has(parsed.hostname)) {
        return { type: 'error', message: 'URL not allowed.' };
      }
      const response = await net.fetch(url);
      if (!response.ok) return { type: 'error', message: `HTTP ${response.status}` };
      const ct = response.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        return { type: 'json', data: await response.json() };
      }
      const buffer = await response.arrayBuffer();
      return { type: 'binary', data: Buffer.from(buffer).toString('base64') };
    } catch (err) {
      return { type: 'error', message: (err as Error).message };
    }
  }
);
