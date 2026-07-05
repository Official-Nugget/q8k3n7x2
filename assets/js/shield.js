/*
 * Lightweight popup / redirect shield for the web & Fire TV builds.
 *
 * Browsers can't filter network requests inside a cross-origin embed the way
 * Electron's session.webRequest can (see electron/adblock.js), but we can:
 *   1. Sandbox player iframes (no allow-popups) so embeds can't spawn tabs.
 *   2. Guard window.open against known ad hosts and unsolicited popups.
 *   3. Block clicks to known ad hosts that open in a new tab.
 *
 * Dormant in the Electron desktop app — that build uses electron/adblock.js.
 */

(() => {
  if (window.desktop?.isElectron) return;

  // Keep in sync with electron/adblock.js
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
    "cdn-cgi/challenge",
  ];

  const NEVER_BLOCK = [
    "youtube.com",
    "youtube-nocookie.com",
    "ytimg.com",
    "googlevideo.com",
    "ggpht.com",
    "gstatic.com",
    "youtubei.googleapis.com",
    "accounts.google.com",
    "club-sandwich-65378.firebaseapp.com",
  ];

  const TRUSTED = [
    "themoviedb.org",
    "vidlink.pro",
    "discord.com",
    "github.com",
    "netlify.app",
    "vercel.app",
    "youtube.com",
    "youtu.be",
    "google.com",
    "firebaseapp.com",
    "googleapis.com",
  ];

  function hostOf(url) {
    try {
      return new URL(url, location.href).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  function hostIsBlocked(hostname) {
    if (!hostname) return false;
    const h = hostname.toLowerCase();
    if (NEVER_BLOCK.some((d) => h === d || h.endsWith("." + d))) return false;
    return BLOCK_LIST.some((frag) => h.includes(frag));
  }

  function hostTrusted(hostname) {
    if (!hostname) return false;
    const h = hostname.toLowerCase();
    return TRUSTED.some((d) => h === d || h.endsWith("." + d));
  }

  // Track recent user gestures so legitimate sign-in / trailer popups still work.
  let gestureUntil = 0;
  ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
    document.addEventListener(evt, () => (gestureUntil = Date.now() + 2000), true);
  });

  const nativeOpen = window.open.bind(window);
  window.open = function shieldedOpen(url, target, features) {
    if (!url || url === "about:blank") {
      return nativeOpen(url, target, features);
    }
    const host = hostOf(url);
    if (hostIsBlocked(host)) return null;
    if (!hostTrusted(host) && Date.now() > gestureUntil) return null;
    return nativeOpen(url, target, features);
  };

  // Block suspicious target=_blank links in our own UI.
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest('a[target="_blank"], a[target="_new"]');
      if (!a || a.dataset.externalIgnore != null) return;
      const host = hostOf(a.href);
      if (hostIsBlocked(host)) e.preventDefault();
    },
    true
  );

  // Sandbox embeds: scripts + playback yes, popups no.
  function hardenIframes() {
    const sandbox =
      "allow-scripts allow-same-origin allow-presentation allow-forms";
    ["playerFrame", "trailerFrame"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.getAttribute("sandbox")) el.setAttribute("sandbox", sandbox);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hardenIframes);
  } else {
    hardenIframes();
  }
})();
