/*
 * Lightweight ad / popup blocking for the desktop app.
 *
 * Two layers:
 *   1. Network filter — blocks requests to known ad / popunder / tracker hosts.
 *   2. Popup + navigation guards — stops the embedded players from opening
 *      new windows or hijacking the page via redirect scripts.
 *
 * This mimics what an ad-blocked browser does. It does NOT remove ads that are
 * baked into the video stream itself (those come from the source), but it kills
 * the popup tabs and redirect spam.
 */

const { shell } = require("electron");

// Hosts we consider "ours" / trusted; links to these may open externally.
const ALLOWED_EXTERNAL = [
  "themoviedb.org",
  "www.themoviedb.org",
  "vidlink.pro",
  "discord.com",
  "github.com",
  "netlify.app",
  "vercel.app",
  "youtube.com",
  "youtu.be",
];

// Known ad / popunder / analytics / miner hosts and fragments. Matched as
// substrings against the request hostname. Kept broad on purpose.
const BLOCK_LIST = [
  "doubleclick.net",
  "googlesyndication.com",
  "google-analytics.com",
  "googletagmanager.com",
  "googletagservices.com",
  "adservice.google",
  "amazon-adsystem.com",
  "adnxs.com",
  "adsystem",
  "popads.net",
  "popcash.net",
  "poptm.com",
  "propellerads",
  "propellerclick",
  "onclicka.com",
  "onclckmn.com",
  "clickadu",
  "hilltopads",
  "adsterra",
  "adskeeper",
  "mgid.com",
  "revcontent.com",
  "outbrain.com",
  "taboola.com",
  "exoclick.com",
  "exosrv.com",
  "exdynsrv.com",
  "juicyads.com",
  "trafficjunky",
  "trafficstars",
  "adsco.re",
  "a-ads.com",
  "coinhive",
  "coin-hive",
  "cryptaloot",
  "coinimp",
  "webcoinminer",
  "histats.com",
  "statcounter.com",
  "quantserve.com",
  "scorecardresearch.com",
  "moatads.com",
  "zedo.com",
  "yieldmo.com",
  "bidvertiser",
  "clickaine",
  "adcash",
  "adtng",
  "smartadserver",
  "creativecdn",
  "bttrack.com",
  "pushnami",
  "sendpulse",
  "luckchips",
  "vidplay-ads",
  "cdn-cgi/challenge", // some ad-wall challenges
];

// Never block these — trailers (YouTube) and core media infrastructure must
// always load, even though some share Google domains with ad services.
const NEVER_BLOCK = [
  "youtube.com",
  "youtube-nocookie.com",
  "ytimg.com",
  "googlevideo.com",
  "ggpht.com",
  "gstatic.com",
  "youtubei.googleapis.com",
];

function hostIsBlocked(hostname) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  if (NEVER_BLOCK.some((d) => h === d || h.endsWith("." + d))) return false;
  return BLOCK_LIST.some((frag) => h.includes(frag));
}

function isAllowedExternal(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_EXTERNAL.some(
      (d) => host === d || host.endsWith("." + d)
    );
  } catch {
    return false;
  }
}

// Layer 1: block network requests to ad hosts for the given session.
function installNetworkFilter(session) {
  session.webRequest.onBeforeRequest((details, callback) => {
    let hostname = "";
    try {
      hostname = new URL(details.url).hostname;
    } catch {
      /* non-URL scheme */
    }
    if (hostIsBlocked(hostname)) {
      callback({ cancel: true });
    } else {
      callback({ cancel: false });
    }
  });
}

// Force a youtube.com Referer/Origin on trailer requests. YouTube throws
// "Error 153" when it can't verify the embedding origin (which happens in a
// packaged desktop app); presenting youtube.com as the referrer satisfies it.
function installYouTubeReferer(session) {
  const filter = {
    urls: [
      "*://*.youtube.com/*",
      "*://*.youtube-nocookie.com/*",
    ],
  };
  session.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const headers = details.requestHeaders || {};
    headers["Referer"] = "https://www.youtube.com/";
    headers["Origin"] = "https://www.youtube.com";
    callback({ requestHeaders: headers });
  });
}

// Layer 2: guard a webContents (and any <iframe> / webview inside it) against
// popups and forced top-level navigations.
function guardContents(contents, appOrigin) {
  // Block ALL new windows/popups. Only genuinely trusted links open externally.
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Prevent redirect scripts from navigating the whole app away.
  contents.on("will-navigate", (event, url) => {
    const current = contents.getURL();
    const isLocal =
      url.startsWith("file:") ||
      (appOrigin && url.startsWith(appOrigin));
    // Allow in-app navigation and hash changes; block the rest.
    if (!isLocal && url !== current) {
      event.preventDefault();
    }
  });
}

// Apply guards to the main window and every child frame/webContents created.
function install(app, mainWindow, appOrigin) {
  const { session } = require("electron");
  installNetworkFilter(session.defaultSession);
  installYouTubeReferer(session.defaultSession);
  guardContents(mainWindow.webContents, appOrigin);

  app.on("web-contents-created", (_e, contents) => {
    guardContents(contents, appOrigin);
  });
}

module.exports = { install, hostIsBlocked, isAllowedExternal };
