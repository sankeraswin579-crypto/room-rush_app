const { app, BrowserWindow, dialog } = require("electron");
const { startServer } = require("../server");
let serverHandle;
async function createWindow() {
  const remoteUrl = process.env.ROOM_RUSH_SERVER_URL;
  let url = remoteUrl;
  if (!url) {
    serverHandle = await startServer({ port: 0, host: "127.0.0.1" });
    url = `http://127.0.0.1:${serverHandle.port}`;
  }
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 650,
    title: "Room Rush",
    backgroundColor: "#0a0d18",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.loadURL(url);
  win.webContents.setWindowOpenHandler(({url}) => {
    require("electron").shell.openExternal(url);
    return { action: "deny" };
  });
}
app.whenReady().then(createWindow).catch(err => dialog.showErrorBox("Room Rush could not start", err.message));
app.on("window-all-closed", () => { if (serverHandle?.server) serverHandle.server.close(); if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
