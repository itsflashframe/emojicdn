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


// ─── Fallback URL builders ────────────────────────────────────────────────────

/**
 * 1st-tier fallback: emojicdn.elk.sh
 * elkStyle: apple | google | facebook | twitter | messenger | whatsapp
 */
function elkFallbackUrl(emoji, elkStyle) {
  return `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=${elkStyle}`;
}

/**
 * 2nd-tier fallback: RealityRipple emoji mirror (universal fallback for all styles).
 * If RealityRipple changes their CDN path, update the template string here.
 */
function realityRippleUrl(hexNoFe, rrStyle) {
  return `https://realityripple.com/Tools/Articles/Emoji/img/${rrStyle}/${hexNoFe}.png`;
}

// Maps each CDN style to its RealityRipple platform name
const RR_STYLE = {
  apple:      'apple',
  google:     'google',
  facebook:   'facebook',
  twitter:    'twitter',
  messenger:  'messenger',
  blobmoji:   'blob',
  oneui:      'samsung',
  whatsapp:   'whatsapp',
  emojitwo:   'emojione',
  opencolor:  'openmoji',
  openblack:  'openmoji',
  fluent3d:   'fluent',
  fluentflat: 'fluent',
  fluenthc:   'fluent',
};

// Maps each CDN style to emojicdn.elk.sh style name (null = not supported there)
const ELK_STYLE = {
  apple:      'apple',
  google:     'google',
  facebook:   'facebook',
  twitter:    'twitter',
  messenger:  'messenger',
  whatsapp:   'whatsapp',
  blobmoji:   null,
  oneui:      null,
  emojitwo:   null,
  opencolor:  null,
  openblack:  null,
};

// Skin-tone modifier codepoint → label
const SKIN_LABELS = {
  '1f3fb': 'light',
  '1f3fc': 'medium-light',
  '1f3fd': 'medium',
  '1f3fe': 'medium-dark',
  '1f3ff': 'dark',
};


// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  let { emoji } = req.query;
  const style = (req.query.style || 'google').toLowerCase();

  if (!emoji) return res.status(400).send('No emoji provided');
  if (emoji.includes('?')) emoji = emoji.split('?')[0];

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=31536000, stale-while-revalidate');

  const hexWithFe0f = resolveHex(emoji);
  const hexNoFe0f   = hexWithFe0f.replace(/-fe0f/g, '');

  // ── Source-change overrides (brand-new / missing emojis with known URLs) ──
  const customUrl = lookupSourceChange(hexWithFe0f, style, emoji);
  if (customUrl) {
    const ok = await proxyImage(customUrl, res);
    if (ok) return;
    // fall through if the custom URL itself is broken
  }


  // ══════════════════════════════════════════════════════════════════════════
  // FLUENT STYLES  (fluent3d / fluentflat / fluenthc)
  // ══════════════════════════════════════════════════════════════════════════
  if (['fluent3d', 'fluentflat', 'fluenthc'].includes(style)) {
    const folder      = { fluent3d: 'modern', fluentflat: 'flat', fluenthc: 'high-contrast' }[style];
    const fluentStyle = { fluent3d: '3D',     fluentflat: 'Flat', fluenthc: 'High Contrast' }[style];
    const NPM_BASE    = `https://cdn.jsdelivr.net/npm/fluentui-emoji@1.3.0/icons/${folder}`;
    const GH_BASE     = `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets`;
    const ov          = overrides[emoji];

    // 1. Named override in overrides.js
    if (ov?.[style]) {
      if (await proxyImage(`${NPM_BASE}/${ov[style]}.svg`, res)) return;
    }

    // Build a de-duped set of hex variants to try resolution with:
    //   – exact hex (may include skin-tone modifier)
    //   – skin-tone stripped (e.g. 1f44b-1f3ff → 1f44b)
    //   – first codepoint only (catches ZWJ sequences whose base exists)
    const skinStripped = hexNoFe0f.replace(/-1f3f[b-f]$/g, '');
    const baseOnly     = hexNoFe0f.split('-')[0];
    const hexVariants  = [...new Set([hexNoFe0f, skinStripped, baseOnly])];

    for (const h of hexVariants) {
      try {
        const filePath  = await fluentEmoji.fromCode(h, fluentStyle);
        // filePath looks like "Grinning Face/3D/grinning_face_3d.svg"
        //                  or "Waving Hand/3D/Color/waving_hand_light_3d.svg" for skin tones
        const parts      = filePath.split('/').filter(Boolean);
        const rawName    = parts[0];                                          // "Grinning Face"
        const fileName   = parts[parts.length - 1];                          // "grinning_face_3d.svg"
        const kebabName  = rawName.toLowerCase().replace(/\s+/g, '-');       // "grinning-face"

        // ── Attempt A: npm CDN – kebab-case (most emojis) ──────────────────
        if (await proxyImage(`${NPM_BASE}/${kebabName}.svg`, res)) return;

        // ── Attempt B: GitHub CDN – exact repo path from fromCode() ────────
        const ghPath = parts.slice(0, -1).map(encodeURIComponent).join('/');
        if (await proxyImage(`${GH_BASE}/${ghPath}/${encodeURIComponent(fileName)}`, res)) return;

        // ── Attempt C: npm CDN with skin-tone label suffix ─────────────────
        //    e.g. "waving-hand-dark.svg" for the dark skin variant
        if (h !== hexNoFe0f) {
          const skinMatch = hexNoFe0f.match(/-(1f3f[b-f])$/);
          if (skinMatch) {
            const skinLabel = SKIN_LABELS[skinMatch[1]];
            if (skinLabel) {
              if (await proxyImage(`${NPM_BASE}/${kebabName}-${skinLabel}.svg`, res)) return;
              // Also try GitHub Color subfolder
              const skinFile = `${rawName.toLowerCase().replace(/\s+/g, '_')}_${skinLabel.replace('-', '_')}_${fluentStyle.toLowerCase().replace(/\s+/g, '_')}.svg`;
              if (await proxyImage(`${GH_BASE}/${encodeURIComponent(rawName)}/${encodeURIComponent(fluentStyle)}/Color/${skinFile}`, res)) return;
            }
          }
        }

        // ── Attempt D: file name minus style suffix (underscore variant) ───
        //    "grinning_face_3d.svg" → "grinning-face.svg" (already tried)
        //    try the raw filename on npm CDN just in case
        const fileOnNpm = fileName.replace(/_/g, '-');
        if (fileOnNpm !== `${kebabName}.svg`) {
          if (await proxyImage(`${NPM_BASE}/${fileOnNpm}`, res)) return;
        }

      } catch (_) {
        // fromCode() throws for emojis it doesn't know – continue to next variant
      }
    }

    // ── Fluent 2nd fallback: RealityRipple ──────────────────────────────────
    if (await proxyImage(realityRippleUrl(hexNoFe0f, 'fluent'), res)) return;

    return res.status(404).send(`Fluent emoji not found: ${hexNoFe0f}`);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // ALL OTHER STYLES
  // ══════════════════════════════════════════════════════════════════════════
  const ov          = overrides[emoji];
  const resolvedHex  = ov?.[style] || hexWithFe0f;
  const resolvedNoFe = resolvedHex.replace(/-fe0f/g, '');

  const primaryUrl = {
    apple:     `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@latest/img/apple/64/${resolvedHex}.png`,
    google:    `https://cdn.jsdelivr.net/npm/emoji-datasource-google@latest/img/google/64/${resolvedHex}.png`,
    facebook:  `https://cdn.jsdelivr.net/npm/emoji-datasource-facebook@latest/img/facebook/64/${resolvedHex}.png`,
    twitter:   `https://cdn.jsdelivr.net/npm/emoji-datasource-twitter@latest/img/twitter/64/${resolvedHex}.png`,
    messenger: `https://cdn.jsdelivr.net/npm/emoji-datasource-messenger@4.1.0/img/messenger/64/${resolvedHex}.png`,
    blobmoji:  `https://cdn.jsdelivr.net/gh/DavidBerdik/blobmoji2@blobmoji-master/svg/${ov?.blobmoji || 'emoji_u' + resolvedHex.replace(/-/g, '_')}.svg`,
    oneui:     `https://cdn.jsdelivr.net/gh/itsflashframe/emojifonts@main/oneui/${resolvedHex}.png`,
    whatsapp:  `https://cdn.jsdelivr.net/gh/itsflashframe/emojifonts@main/whatsapp/${resolvedHex}.png`,
    emojitwo:  `https://cdn.jsdelivr.net/gh/EmojiTwo/emojitwo@master/png/128/${resolvedHex}.png`,
    opencolor: `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/color/svg/${ov?.opencolor || resolvedHex.toUpperCase()}.svg`,
    openblack: `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/black/svg/${ov?.openblack || resolvedHex.toUpperCase()}.svg`,
  }[style] || `https://cdn.jsdelivr.net/npm/emoji-datasource-google@latest/img/google/64/${resolvedHex}.png`;

  // ── Primary source ────────────────────────────────────────────────────────
  if (await proxyImage(primaryUrl, res)) return;

  // ── 1st fallback: emojicdn.elk.sh (apple / google / facebook / twitter /
  //                                   messenger / whatsapp only) ────────────
  const elkStyle = ELK_STYLE[style];
  if (elkStyle) {
    if (await proxyImage(elkFallbackUrl(emoji, elkStyle), res)) return;
  }

  // ── 2nd fallback: RealityRipple (universal) ───────────────────────────────
  const rrStyle = RR_STYLE[style];
  if (rrStyle) {
    if (await proxyImage(realityRippleUrl(resolvedNoFe, rrStyle), res)) return;
  }

  return res.status(404).send(`Emoji not found: ${resolvedHex}`);
};
