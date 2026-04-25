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

function elkFallbackUrl(emoji, elkStyle) {
  return `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=${elkStyle}`;
}

function realityRippleUrl(hexNoFe, rrStyle) {
  return `https://realityripple.com/Tools/Articles/Emoji/img/${rrStyle}/${hexNoFe}.png`;
}

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
  tossface:   null,
};

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
  tossface:   null,
};

const SKIN_LABELS = {
  '1f3fb': 'light',
  '1f3fc': 'medium-light',
  '1f3fd': 'medium',
  '1f3fe': 'medium-dark',
  '1f3ff': 'dark',
};

module.exports = async (req, res) => {
  let { emoji } = req.query;
  const style = (req.query.style || 'google').toLowerCase();

  if (!emoji) return res.status(400).send('No emoji provided');
  if (emoji.includes('?')) emoji = emoji.split('?')[0];

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=31536000, stale-while-revalidate');

  const hexWithFe0f = resolveHex(emoji);
  const hexNoFe0f   = hexWithFe0f.replace(/-fe0f/g, '');

  const customUrl = lookupSourceChange(hexWithFe0f, style, emoji);
  if (customUrl) {
    const ok = await proxyImage(customUrl, res);
    if (ok) return;
  }

  if (['fluent3d', 'fluentflat', 'fluenthc'].includes(style)) {
    const folder      = { fluent3d: 'modern', fluentflat: 'flat', fluenthc: 'high-contrast' }[style];
    const fluentStyle = { fluent3d: '3D',     fluentflat: 'Flat', fluenthc: 'High Contrast' }[style];
    const NPM_BASE    = `https://cdn.jsdelivr.net/npm/fluentui-emoji@latest/icons/${folder}`;
    const GH_BASE     = `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets`;
    const ov          = overrides[emoji];

    if (ov?.[style]) {
      if (await proxyImage(`${NPM_BASE}/${ov[style]}.svg`, res)) return;
    }

    const skinMatch    = hexNoFe0f.match(/-(1f3f[b-f])$/);
    const skinStripped = hexNoFe0f.replace(/-1f3f[b-f]$/, '');
    const baseOnly     = hexNoFe0f.split('-')[0];
    const hexVariants  = [...new Set([hexNoFe0f, skinStripped, baseOnly])];

    
    async function tryFluentFilePath(filePath) {
      if (!filePath || typeof filePath !== 'string') return false;
      const parts     = filePath.split('/').filter(Boolean);
      const rawName   = parts[0];
      const fileName  = parts[parts.length - 1];
      const kebabName = rawName.toLowerCase().replace(/\s+/g, '-');
      const ghPath    = parts.slice(0, -1).map(encodeURIComponent).join('/');

      if (await proxyImage(`${GH_BASE}/${ghPath}/${encodeURIComponent(fileName)}`, res)) return true;

      if (skinMatch) {
        const skinLabel = SKIN_LABELS[skinMatch[1]];
        if (skinLabel) {
          if (await proxyImage(`${NPM_BASE}/${kebabName}-${skinLabel}.svg`, res)) return true;
          const skinFile = `${rawName.toLowerCase().replace(/\s+/g, '_')}_${skinLabel.replace('-', '_')}_${fluentStyle.toLowerCase().replace(/\s+/g, '_')}.svg`;
          if (await proxyImage(`${GH_BASE}/${encodeURIComponent(rawName)}/${encodeURIComponent(fluentStyle)}/Color/${skinFile}`, res)) return true;
        }
      }

      if (await proxyImage(`${NPM_BASE}/${kebabName}.svg`, res)) return true;

      const fileOnNpm = fileName.replace(/_/g, '-');
      if (fileOnNpm !== `${kebabName}.svg`) {
        if (await proxyImage(`${NPM_BASE}/${fileOnNpm}`, res)) return true;
      }

      return false;
    }

    try {
      if (typeof fluentEmoji.fromGlyph === 'function') {
        const byGlyph = await fluentEmoji.fromGlyph(emoji, fluentStyle);
        if (await tryFluentFilePath(byGlyph)) return;
      }
    } catch (_) {}

    for (const h of hexVariants) {
      try {
        const filePath = await fluentEmoji.fromCode(h, fluentStyle);
        if (await tryFluentFilePath(filePath)) return;
      } catch (_) {}
    }

    if (await proxyImage(realityRippleUrl(hexNoFe0f, 'fluent'), res)) return;
    return res.status(404).send(`Fluent emoji not found: ${hexNoFe0f}`);
  }

  const ov           = overrides[emoji];
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
    tossface:  `https://cdn.jsdelivr.net/gh/itsflashframe/emojifonts@main/TossFace-Svg-v1-6/${resolvedNoFe.split('-').map(p => 'u' + p.toUpperCase()).join('_')}.svg`,
  }[style] || `https://cdn.jsdelivr.net/npm/emoji-datasource-google@latest/img/google/64/${resolvedHex}.png`;

  if (await proxyImage(primaryUrl, res)) return;

  const elkStyle = ELK_STYLE[style];
  if (elkStyle) {
    if (await proxyImage(elkFallbackUrl(emoji, elkStyle), res)) return;
  }

  const rrStyle = RR_STYLE[style];
  if (rrStyle) {
    if (await proxyImage(realityRippleUrl(resolvedNoFe, rrStyle), res)) return;
  }

  return res.status(404).send(`Emoji not found: ${resolvedHex}`);
};
