/*
 * Discord Rich Presence manager.
 * Fails silently if there's no Client ID configured or Discord isn't running,
 * so the app works fine with or without Discord.
 */

const { Client } = require("@xhayper/discord-rpc");
const { DISCORD_CLIENT_ID, LARGE_IMAGE_KEY } = require("./discord-config");

let client = null;
let ready = false;
let connecting = false;
let pending = null; // last activity requested before we were ready

function enabled() {
  return typeof DISCORD_CLIENT_ID === "string" && DISCORD_CLIENT_ID.trim() !== "";
}

async function connect() {
  if (!enabled() || client || connecting) return;
  connecting = true;
  try {
    client = new Client({ clientId: DISCORD_CLIENT_ID.trim() });
    client.on("ready", () => {
      ready = true;
      if (pending) {
        apply(pending);
        pending = null;
      }
    });
    await client.login();
  } catch (e) {
    // Discord not installed / not running — ignore.
    client = null;
    ready = false;
  } finally {
    connecting = false;
  }
}

// Discord ActivityType.Watching → the status reads "Watching <app name>".
const WATCHING = 3;

function formatClock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function presenceState(info) {
  const isTv = info.media === "tv" && info.season && info.episode;
  const watched = Number(info.watched) || 0;
  const duration = Number(info.duration) || 0;
  const hasProgress = duration > 0;

  if (isTv) {
    let state = `Season ${info.season} · Episode ${info.episode}`;
    if (hasProgress) {
      const pct = Math.min(100, Math.round((watched / duration) * 100));
      state += ` · ${pct}% (${formatClock(watched)} / ${formatClock(duration)})`;
    }
    return state.slice(0, 128);
  }

  if (info.media === "movie" && hasProgress) {
    const pct = Math.min(100, Math.round((watched / duration) * 100));
    return `${pct}% · ${formatClock(watched)} / ${formatClock(duration)}`.slice(
      0,
      128
    );
  }

  if (info.media === "movie") return "Watching a movie";
  return undefined;
}

function imageKey(urlOrKey) {
  if (!urlOrKey) return null;
  const s = String(urlOrKey).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return s;
}

function apply(info) {
  if (!client || !ready) return;
  try {
    const title = info.title ? String(info.title).slice(0, 128) : "Browsing";
    const watched = Number(info.watched) || 0;
    const duration = Number(info.duration) || 0;
    const hasProgress = duration > watched && duration > 0;

    const activity = {
      type: WATCHING,
      details: title,
      state: presenceState(info),
      instance: false,
    };

    // Progress bar in Discord (elapsed / total).
    if (hasProgress) {
      const now = Date.now();
      activity.startTimestamp = now - watched * 1000;
      activity.endTimestamp = activity.startTimestamp + duration * 1000;
    } else {
      activity.startTimestamp = Date.now();
    }

    // Poster / backdrop URL (Discord accepts public https URLs as image keys).
    const poster = imageKey(info.poster);
    const fallbackKey = imageKey(LARGE_IMAGE_KEY);
    if (poster) {
      activity.largeImageKey = poster;
      activity.largeImageText = title;
    } else if (fallbackKey && !/^https?:\/\//i.test(fallbackKey)) {
      activity.largeImageKey = fallbackKey;
      activity.largeImageText = title;
    } else if (fallbackKey) {
      activity.largeImageKey = fallbackKey;
      activity.largeImageText = "Club Sandwich Streaming";
    }

  // Small badge: app logo asset if configured (upload "logo" in Dev Portal).
    if (fallbackKey && !/^https?:\/\//i.test(fallbackKey) && poster) {
      activity.smallImageKey = fallbackKey;
      activity.smallImageText = "Club Sandwich";
    }

    const p = client.user?.setActivity(activity);
    if (p && typeof p.catch === "function") {
      p.catch((e) => console.warn("[discord] setActivity failed:", e?.message || e));
    }
  } catch (e) {
    console.warn("[discord] presence error:", e?.message || e);
  }
}

// ---- Public API ----
async function setPresence(info) {
  if (!enabled()) return;
  if (!client) await connect();
  if (ready) apply(info || {});
  else pending = info || {};
}

function clearPresence() {
  if (client && ready) {
    try {
      client.user?.clearActivity();
    } catch (e) {
      /* ignore */
    }
  }
  pending = null;
}

module.exports = { setPresence, clearPresence, enabled };
