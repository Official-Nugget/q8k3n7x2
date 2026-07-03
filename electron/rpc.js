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

function apply(info) {
  if (!client || !ready) return;
  try {
    const isTv = info.media === "tv" && info.season && info.episode;
    const title = info.title ? String(info.title).slice(0, 128) : "Browsing";
    const activity = {
      type: WATCHING,
      details: title,
      state: isTv
        ? `Season ${info.season} · Episode ${info.episode}`.slice(0, 128)
        : info.media === "movie"
        ? "Watching a movie"
        : undefined,
      startTimestamp: info.startTimestamp || Date.now(),
      instance: false,
    };

    // IMPORTANT: Discord's `large_image` must be an uploaded Art Asset KEY
    // (e.g. "logo"), NOT a raw image URL. Passing a URL makes Discord reject
    // the whole presence, so nothing shows at all. We only attach an image if
    // a real asset key is configured in discord-config.js.
    const key = (LARGE_IMAGE_KEY || "").trim();
    if (key) {
      activity.largeImageKey = key;
      activity.largeImageText = info.title || "Club Sandwich Streaming";
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
