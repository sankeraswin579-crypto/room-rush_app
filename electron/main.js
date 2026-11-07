
const {
  app,
  BrowserWindow,
  dialog,
  shell
} = require("electron");

const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { URL } = require("url");

const GITHUB_OWNER = "sankeraswin579-crypto";
const GITHUB_REPO = "room-rush_app";

let mainWindow = null;
let updateCheckStarted = false;

async function createWindow() {
  const serverUrl =
    process.env.ROOM_RUSH_SERVER_URL ||
    "https://room-rush-app.onrender.com";

  let parsedUrl;

  try {
    parsedUrl = new URL(serverUrl);
  } catch {
    throw new Error(
      "ROOM_RUSH_SERVER_URL must be a valid HTTP or HTTPS URL."
    );
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Room Rush server URL must use HTTP or HTTPS.");
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 650,
    title: "Room Rush",
    backgroundColor: "#0a0d18",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const externalUrl = new URL(url);

      if (["http:", "https:"].includes(externalUrl.protocol)) {
        shell.openExternal(url);
      }
    } catch {
      // Ignore malformed or unsupported external URLs.
    }

    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(parsedUrl.toString());
}

// Request JSON from GitHub.
function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Room-Rush-Desktop",
        "Accept": "application/vnd.github+json"
      }
    }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`GitHub API returned HTTP ${response.statusCode}`));
        return;
      }

      let data = "";

      response.setEncoding("utf8");
      response.on("data", chunk => data += chunk);

      response.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Could not read the GitHub release response."));
        }
      });
    }).on("error", reject);
  });
}

// Compare numeric version components.
function compareVersions(first, second) {
  const a = first.replace(/^v/, "").split(".").map(Number);
  const b = second.replace(/^v/, "").split(".").map(Number);

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;

    if (x > y) return 1;
    if (x < y) return -1;
  }

  return 0;
}

// Download a GitHub release asset, following HTTPS redirects.
function downloadFile(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error("Too many download redirects."));
      return;
    }

    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      reject(new Error("Update downloads must use HTTPS."));
      return;
    }

    https.get(parsed, {
      headers: {
        "User-Agent": "Room-Rush-Desktop"
      }
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        response.resume();

        if (!location) {
          reject(new Error("GitHub returned an invalid download redirect."));
          return;
        }

        downloadFile(
          new URL(location, parsed).toString(),
          destination,
          redirects + 1
        ).then(resolve, reject);

        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Update download failed: HTTP ${response.statusCode}`));
        return;
      }

      const output = fs.createWriteStream(destination);

      response.pipe(output);

      output.on("finish", () => {
        output.close(resolve);
      });

      output.on("error", error => {
        fs.rmSync(destination, { force: true });
        reject(error);
      });

      response.on("error", error => {
        output.destroy(error);
        fs.rmSync(destination, { force: true });
        reject(error);
      });
    }).on("error", reject);
  });
}

// Calculate SHA-256 for downloaded update verification.
function calculateSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const input = fs.createReadStream(filePath);

    input.on("data", chunk => hash.update(chunk));
    input.on("error", reject);
    input.on("end", () => resolve(hash.digest("hex")));
  });
}

async function checkForUpdates() {
  if (!app.isPackaged || updateCheckStarted) return;

  updateCheckStarted = true;

  try {
    console.log("Checking Room Rush GitHub releases...");

    const releaseUrl =
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

    const release = await getJson(releaseUrl);

    if (release.draft || release.prerelease) return;

    const latestVersion = String(release.tag_name || "")
      .replace(/^v/, "");

    const currentVersion = app.getVersion();

    if (!/^\d+\.\d+\.\d+$/.test(latestVersion)) {
      console.log("Invalid release version:", latestVersion);
      return;
    }

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      console.log("Room Rush is up to date.");
      return;
    }

    const asset = (release.assets || []).find(item =>
      item.name.toLowerCase().endsWith(".exe")
    );

    if (!asset || !asset.browser_download_url) {
      console.log("No Windows executable found in the latest release.");
      return;
    }

    const answer = await dialog.showMessageBox({
      type: "info",
      title: "Room Rush Update Available",
      message: `Version ${latestVersion} is available.`,
      detail: `You are currently using version ${currentVersion}. Download the update now?`,
      buttons: ["Download Update", "Later"],
      defaultId: 0,
      cancelId: 1
    });

    if (answer.response !== 0) return;

    const updatePath = path.join(
      os.tmpdir(),
      `Room-Rush-${latestVersion}-update.exe`
    );

    await downloadFile(asset.browser_download_url, updatePath);

    if (!fs.existsSync(updatePath) || fs.statSync(updatePath).size < 1024 * 1024) {
      throw new Error("The downloaded update file is missing or incomplete.");
    }

    if (asset.digest && asset.digest.startsWith("sha256:")) {
      const actualDigest = await calculateSha256(updatePath);
      const expectedDigest = asset.digest.substring("sha256:".length);

      if (actualDigest.toLowerCase() !== expectedDigest.toLowerCase()) {
        fs.rmSync(updatePath, { force: true });
        throw new Error("Update verification failed. The downloaded file was not installed.");
      }
    }

    const installAnswer = await dialog.showMessageBox({
      type: "info",
      title: "Room Rush Update Downloaded",
      message: `Version ${latestVersion} is ready.`,
      detail: "Room Rush will close, replace the old executable, and restart.",
      buttons: ["Install and Restart", "Later"],
      defaultId: 0,
      cancelId: 1
    });

    if (installAnswer.response !== 0) return;

    launchPortableUpdater(updatePath);
  } catch (error) {
    console.error("Room Rush update check failed:", error);

    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: "Update Not Completed",
        message: "Room Rush could not complete the update.",
        detail: error.message,
        buttons: ["OK"]
      });
    }
  } finally {
    updateCheckStarted = false;
  }
}

// Replace the portable executable only after Room Rush has exited.
function launchPortableUpdater(updatePath) {
  
  const executablePath = path.resolve(
  process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
);

  const scriptPath = path.join(
    os.tmpdir(),
    `room-rush-update-${process.pid}.ps1`
  );

  const escapePowerShell = value =>
    String(value).replace(/'/g, "''");

  const script = `
$processId = ${process.pid}
$source = '${escapePowerShell(updatePath)}'
$target = '${escapePowerShell(executablePath)}'
$scriptPath = $PSCommandPath

try {
    while (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
        Start-Sleep -Seconds 1
    }

    Copy-Item -LiteralPath $source -Destination $target -Force
    Start-Process -FilePath $target
    Remove-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue
}
catch {
    $_ | Out-File -FilePath (Join-Path $env:TEMP 'room-rush-update-error.txt')
}
finally {
    Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue
}
`;

  fs.writeFileSync(scriptPath, script, "utf8");

  const helper = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-WindowStyle",
      "Hidden",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    }
  );

  helper.on("error", error => {
    console.error("Could not start update helper:", error);
  });

  helper.unref();

  app.quit();
}

app.whenReady().then(async () => {
  await createWindow();

  if (app.isPackaged) {
    setTimeout(checkForUpdates, 8000);
  }
}).catch(error => {
  dialog.showErrorBox(
    "Room Rush could not connect",
    `${error.message}\n\nCheck your internet connection and ROOM_RUSH_SERVER_URL configuration.`
  );
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch(error => {
      dialog.showErrorBox(
        "Room Rush could not connect",
        error.message
      );
    });
  }
});
