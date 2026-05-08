import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, protocol, session } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname, "..");
const RENDERER_DIST = path.join(APP_ROOT, "dist");
const ICON_PATH = path.join(APP_ROOT, "build", "icon.png");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

app.setName("Herakoi");

const MIME_BY_EXT: Record<string, string> = {
  html: "text/html",
  js: "text/javascript",
  mjs: "text/javascript",
  css: "text/css",
  json: "application/json",
  wasm: "application/wasm",
  data: "application/octet-stream",
  tflite: "application/octet-stream",
  binarypb: "application/octet-stream",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  map: "application/json",
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

function buildApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const, label: `Informazioni su ${app.name}` },
              { type: "separator" as const },
              { role: "services" as const, label: "Servizi" },
              { type: "separator" as const },
              { role: "hide" as const, label: `Nascondi ${app.name}` },
              { role: "hideOthers" as const, label: "Nascondi altre" },
              { role: "unhide" as const, label: "Mostra tutto" },
              { type: "separator" as const },
              { role: "quit" as const, label: `Esci da ${app.name}` },
            ],
          },
        ]
      : []),
    {
      label: "Modifica",
      submenu: [
        { role: "undo", label: "Annulla" },
        { role: "redo", label: "Ripeti" },
        { type: "separator" },
        { role: "cut", label: "Taglia" },
        { role: "copy", label: "Copia" },
        { role: "paste", label: "Incolla" },
        { role: "selectAll", label: "Seleziona tutto" },
      ],
    },
    {
      label: "Visualizza",
      submenu: [
        { role: "reload", label: "Ricarica" },
        { role: "forceReload", label: "Forza ricarica" },
        ...(VITE_DEV_SERVER_URL
          ? [{ role: "toggleDevTools" as const, label: "Strumenti sviluppatore" }]
          : []),
        { type: "separator" },
        { role: "resetZoom", label: "Zoom predefinito" },
        { role: "zoomIn", label: "Aumenta zoom" },
        { role: "zoomOut", label: "Riduci zoom" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Schermo intero" },
      ],
    },
    {
      label: "Finestra",
      submenu: [
        { role: "minimize", label: "Riduci a icona" },
        { role: "close", label: "Chiudi" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0a0a0a",
    titleBarStyle: isMac ? "hiddenInset" : isWin ? "hidden" : "default",
    titleBarOverlay: isWin ? { color: "#0a0a0a", symbolColor: "#cfcfcf", height: 30 } : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media");
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadURL("app://./index.html");
  }
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: app.name,
    applicationVersion: app.getVersion(),
    copyright: "© Herakoi",
  });

  if (isMac && VITE_DEV_SERVER_URL && app.dock) {
    app.dock.setIcon(ICON_PATH);
  }

  buildApplicationMenu();

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media");
  });

  protocol.handle("app", async (req) => {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const safePath = path.normalize(pathname).replace(/^([/\\])+/, "");
    const filePath = path.join(RENDERER_DIST, safePath);
    if (!filePath.startsWith(RENDERER_DIST)) {
      return new Response("Forbidden", { status: 403 });
    }
    try {
      const data = await readFile(filePath);
      const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
      const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
      return new Response(data, { headers: { "Content-Type": mime } });
    } catch {
      return new Response(`Not found: ${pathname}`, { status: 404 });
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
