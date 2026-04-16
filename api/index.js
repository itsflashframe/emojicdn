const emojiData     = require('emoji-datasource-apple/emoji.json');
const fluentEmoji   = require('fluentui-emoji-js');
const overrides     = require('./overrides');
const sourceChanges = require('./sourcechange');


const emojiMap     = {};
const emojiMapNoFe = {};

emojiData.forEach(e => {
  if (e.char) {
    const unified = e.unified.toLowerCase();
    emojiMap[e.char] = unified;
    emojiMapNoFe[e.char.replace(/\uFE0F/g, '')] = unified;
  }
});


function resolveHex(emoji) {
  if (emojiMap[emoji])            return emojiMap[emoji];
  const noFe = emoji.replace(/\uFE0F/g, '');
  if (emojiMap[noFe])             return emojiMap[noFe];
  if (emojiMapNoFe[emoji])        return emojiMapNoFe[emoji];
  if (emojiMapNoFe[noFe])         return emojiMapNoFe[noFe];
  if (emojiMap[emoji + '\uFE0F']) return emojiMap[emoji + '\uFE0F'];
  return Array.from(emoji)
    .map(c => c.codePointAt(0).toString(16).toLowerCase())
    .join('-');
}


// Try to fetch a remote image and pipe it to res.
// Returns true and sends the response on success, returns false (without
// touching res) on any non-2xx status or network error.
async function proxyImage(url, res) {
  try {
    const r = await fetch(url);
    if (!r.ok) return false;
    const buf = await r.arrayBuffer();
    const ct  = r.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 's-maxage=31536000, stale-while-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(buf));
    return true;
  } catch (_) {
    return false;
  }
}


// ── Fallback chain ──────────────────────────────────────────────────────────
//
//  1. Primary source (passed in as `primaryUrl`)
//  2. emojicdn.elk.sh  (https://github.com/benborgers/emojicdn)
//  3. RealityRipple    (https://cdn.jsdelivr.net/gh/realityripple/emoji)
//
// Each mapping is null when the vendor simply has no equivalent set.

const ELK_STYLE_MAP = {
  apple:     'apple',
  google:    'google',
  facebook:  'facebook',
  twitter:   'twitter',
  messenger: 'facebook',   // closest available
  blobmoji:  null,          // not in elk
  oneui:     'samsung',
  whatsapp:  'whatsapp',
  emojitwo:  'openmoji',   // closest available
  opencolor: 'openmoji',
  openblack: null,          // not in elk
};

const RR_STYLE_MAP = {
  apple:     'apple',
  google:    'noto',        // Noto = Google's emoji font
  facebook:  'facebook',
  twitter:   'twemoji',
  messenger: 'facebook',
  blobmoji:  'blobmoji',
  oneui:     'oneui',
  whatsapp:  'whatsapp',
  emojitwo:  'openmoji',   // closest available
  opencolor: 'openmoji',
  openblack: 'openmoji',   // closest available (no dedicated black set)
};

async function tryWithFallbacks(primaryUrl, style, emoji, resolvedNoFe, res) {
  // 1. Primary source
  if (await proxyImage(primaryUrl, res)) return true;

  // 2. emojicdn.elk.sh fallback
  const elkStyle = ELK_STYLE_MAP[style];
  if (elkStyle) {
    const elkUrl = `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=${elkStyle}`;
    if (await proxyImage(elkUrl, res)) return true;
  }

  // 3. RealityRipple fallback
  const rrFont = RR_STYLE_MAP[style];
  if (rrFont) {
    const rrUrl = `https://cdn.jsdelivr.net/gh/realityripple/emoji/${rrFont}/${resolvedNoFe}.png`;
    if (await proxyImage(rrUrl, res)) return true;
  }

  return false;
}


function lookupSourceChange(hex, style, emoji) {
  const hexNoFe = hex.replace(/-fe0f/g, '');
  const keysToTry = [hex, hexNoFe, emoji].filter(Boolean);

  for (const key of keysToTry) {
    const entry = sourceChanges[key];
    if (!entry) continue;

    if (typeof entry === 'string') return entry;

    if (typeof entry === 'object') {
      const match = entry[style] ?? entry['*'];
      if (!match) continue;

      if (typeof match === 'function') return match(hex);
      return match;
    }
  }

  return null;
}


module.exports = async (req, res) => {
  let { emoji } = req.query;
  const style = (req.query.style || 'google').toLowerCase();

  if (!emoji) return res.status(400).send('No emoji provided');
  if (emoji.includes('?')) emoji = emoji.split('?')[0];

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=31536000, stale-while-revalidate');

  const hexWithFe0f = resolveHex(emoji);
  const hexNoFe0f   = hexWithFe0f.replace(/-fe0f/g, '');

  // sourcechange override — also goes through the fallback chain
  const customUrl = lookupSourceChange(hexWithFe0f, style, emoji);
  if (customUrl) {
    const ok = await tryWithFallbacks(customUrl, style, emoji, hexNoFe0f, res);
    if (ok) return;
    // fall through to normal handling if the custom URL also failed
  }


  // ── Microsoft Fluent emoji ────────────────────────────────────────────────
  //
  // Fix: `fluentui-emoji-js` fromCode() returns a path relative to the
  // `assets/` folder in microsoft/fluentui-emoji, e.g.:
  //   /Waving Hand/Default/3D/waving_hand_3d.png
  //
  // We URL-encode each path segment (spaces → %20) and construct the
  // jsDelivr GitHub CDN URL directly.  The previous approach (npm package
  // icons/ folder) was incorrect and caused most Fluent emojis to 404.

  if (['fluent3d', 'fluentflat', 'fluenthc'].includes(style)) {
    const fluentStyle = {
      fluent3d:   '3D',
      fluentflat: 'Flat',
      fluenthc:   'High Contrast',
    }[style];

    const BASE_GH = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets';

    // Try the canonical hex first, then fall back to just the base codepoint
    // (strips skin-tone modifiers and selectors).
    for (const h of [hexNoFe0f, hexNoFe0f.split('-')[0]]) {
      try {
        const filePath    = await fluentEmoji.fromCode(h, fluentStyle);
        // filePath begins with '/', e.g. "/Waving Hand/Default/3D/..."
        // Encode each segment individually to handle spaces and special chars.
        const encodedPath = filePath
          .split('/')
          .map(p => encodeURIComponent(p))
          .join('/');

        const ok = await proxyImage(`${BASE_GH}${encodedPath}`, res);
        if (ok) return;
      } catch (_) {
        // fromCode() throws when the emoji isn't in its database — continue.
      }
    }

    return res.status(404).send(`Fluent emoji not found: ${hexNoFe0f}`);
  }


  // ── Standard raster/vector styles ────────────────────────────────────────

  const ov          = overrides[emoji];
  const resolvedHex = ov?.[style] || hexWithFe0f;
  const resolvedNoFe = resolvedHex.replace(/-fe0f/g, '');

  const sources = {
    apple:     `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@latest/img/apple/64/${resolvedHex}.png`,
    google:    `https://cdn.jsdelivr.net/npm/emoji-datasource-google@latest/img/google/64/${resolvedHex}.png`,
    facebook:  `https://cdn.jsdelivr.net/npm/emoji-datasource-facebook@latest/img/facebook/64/${resolvedHex}.png`,
    twitter:   `https://cdn.jsdelivr.net/npm/emoji-datasource-twitter@latest/img/twitter/64/${resolvedHex}.png`,
    messenger: `https://cdn.jsdelivr.net/npm/emoji-datasource-messenger@4.1.0/img/messenger/64/${resolvedHex}.png`,
    blobmoji:  `https://cdn.jsdelivr.net/gh/DavidBerdik/blobmoji2@blobmoji-master/svg/${ov?.blobmoji || 'emoji_u' + resolvedNoFe.replace(/-/g, '_')}.svg`,
    oneui:     `https://cdn.jsdelivr.net/gh/itsflashframe/emojifonts@main/oneui/${resolvedNoFe}.png`,
    whatsapp:  `https://cdn.jsdelivr.net/gh/itsflashframe/emojifonts@main/whatsapp/${resolvedNoFe}.png`,
    emojitwo:  `https://cdn.jsdelivr.net/gh/EmojiTwo/emojitwo@master/png/128/${resolvedNoFe}.png`,
    opencolor: `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/color/svg/${ov?.opencolor || resolvedHex.toUpperCase()}.svg`,
    openblack: `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/black/svg/${ov?.openblack || resolvedHex.toUpperCase()}.svg`,
  };

  const url = sources[style] || sources.google;
  const ok  = await tryWithFallbacks(url, style, emoji, resolvedNoFe, res);
  if (!ok) return res.status(404).send(`Emoji not found: ${resolvedHex}`);
};
