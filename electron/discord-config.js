/*
 * ============================================================
 *  DISCORD RICH PRESENCE — paste your Client ID below.
 * ============================================================
 *  This makes your Discord profile show "Watching <title>".
 *
 *  How to get a Client ID (free, ~2 min) — see the README section
 *  "Discord Rich Presence setup", or in short:
 *    1. Go to https://discord.com/developers/applications
 *    2. New Application  ->  name it "Club Sandwich Streaming"
 *    3. Copy the "Application ID" (that's your Client ID)
 *    4. (optional) Rich Presence -> Art Assets -> upload an image
 *       named exactly "logo" for a small badge on poster art.
 *
 *  Poster/backdrop art is sent automatically from TMDB while you watch.
 *  Leave LARGE_IMAGE_KEY as "logo" for the optional small badge, or "" to skip.
 * ============================================================
 */

module.exports = {
  DISCORD_CLIENT_ID: "1522374501931683923",

  // Asset key you uploaded under Rich Presence -> Art Assets (optional).
  // If you don't upload one, the status still works without an image.
  LARGE_IMAGE_KEY: "logo",
};
