/*
 * Auto-update via electron-updater + GitHub Releases.
 * Completely dormant unless electron/update-config.js has OWNER + REPO set,
 * and only runs in the packaged app (never during `npm start`).
 */

const { OWNER, REPO } = require("./update-config");

// Kept at module scope so main.js can trigger an install (Restart & update now).
let au = null;
let downloaded = false;

function configured() {
  return (
    typeof OWNER === "string" &&
    OWNER.trim() &&
    typeof REPO === "string" &&
    REPO.trim()
  );
}

function init(app, mainWindow) {
  if (!configured()) return;
  if (!app.isPackaged) return; // don't check while developing

  try {
    au = require("electron-updater").autoUpdater;
  } catch {
    return;
  }

  try {
    au.setFeedURL({
      provider: "github",
      owner: OWNER.trim(),
      repo: REPO.trim(),
    });
  } catch {
    return;
  }

  au.autoDownload = true;
  au.autoInstallOnAppQuit = true;

  const notify = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  au.on("update-available", (info) =>
    notify("update:available", { version: info?.version })
  );
  au.on("download-progress", (p) =>
    notify("update:progress", {
      percent: Math.max(0, Math.min(100, p?.percent || 0)),
      bytesPerSecond: p?.bytesPerSecond || 0,
      transferred: p?.transferred || 0,
      total: p?.total || 0,
    })
  );
  au.on("update-downloaded", (info) => {
    downloaded = true;
    notify("update:downloaded", { version: info?.version });
  });
  au.on("error", () => {
    notify("update:error", {});
  });

  // Check shortly after launch, then every 6 hours.
  setTimeout(() => au.checkForUpdates().catch(() => {}), 4000);
  setInterval(() => au.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}

// Called from the renderer (Restart & update now). Installs the downloaded
// update and relaunches. Safe no-op if nothing is ready yet.
function installNow() {
  if (!au || !downloaded) return false;
  try {
    setImmediate(() => au.quitAndInstall(false, true));
    return true;
  } catch {
    return false;
  }
}

module.exports = { init, configured, installNow };
