const emojiData = require('emoji-datasource-apple/emoji.json');
const fluentEmoji = require('fluentui-emoji-js');
const overrides = require('./overrides');
const sourceChanges = require('./sourcechange');

const emojiMap = {};
const emojiMapNoFe = {};

emojiData.forEach(e => {
  if (e.char) {
    const unified = e.unified.toLowerCase();
    emojiMap[e.char] = unified;
    emojiMapNoFe[e.char.replace(/\uFE0F/g, '')] = unified;
  }
});

function resolveHex(emoji) {
  if (emojiMap[emoji]) return emojiMap[emoji];
  const noFe = emoji.replace(/\uFE0F/g, '');
  if (emojiMap[noFe]) return emojiMap[noFe];
  if (emojiMapNoFe[emoji]) return emojiMapNoFe[emoji];
  if (emojiMapNoFe[noFe]) return emojiMapNoFe[noFe];
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
    const ct = r.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 's-maxage=31536000, stale-while-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(buf));
    return true;
  } catch (_) {
    return false;
  }
}

const ELK_STYLE_MAP = {
  apple: 'apple',
  google: 'google',
  facebook: 'facebook',
  twitter: 'twitter',
  messenger: 'facebook',
  blobmoji: null,
  oneui: 'samsung',
  whatsapp: 'whatsapp',
  emojitwo: 'openmoji',
  opencolor: 'openmoji',
  openblack: null,
};

const RR_STYLE_MAP = {
  apple: 'apple',
  google: 'noto',
  facebook: 'facebook',
  twitter: 'twemoji',
  messenger: 'facebook',
  blobmoji: 'blobmoji',
  oneui: 'oneui',
  whatsapp: 'whatsapp',
  emojitwo: 'openmoji',
  opencolor: 'openmoji',
  openblack: 'openmoji',
};

async function tryWithFallbacks(primaryUrl, style, emoji, resolvedNoFe, res) {
  if (await proxyImage(primaryUrl, res)) return true;

  const elkStyle = ELK_STYLE_MAP[style];
  if (elkStyle) {
    const elkUrl = `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=${elkStyle}`;
    if (await proxyImage(elkUrl, res)) return true;
  }

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
  const hexNoFe0f = hexWithFe0f.replace(/-fe0f/g, '');

  const customUrl = lookupSourceChange(hexWithFe0f, style, emoji);
  if (customUrl) {
    const ok = await tryWithFallbacks(customUrl, style, emoji, hexNoFe0f, res);
    if (ok) return;
  }

  if (['fluent3d', 'fluentflat', 'fluenthc'].includes(style)) {
    const fluentStyle = {
      fluent3d: '3D',
      fluentflat: 'Flat',
      fluenthc: 'High Contrast',
    }[style];

    const basePath = {
      fluent3d: 'modern',
      fluentflat: 'flat',
      fluenthc: 'high-contrast',
    }[style];

    const BASE_CDN = `https://cdn.jsdelivr.net/npm/fluentui-emoji@1.3.0/icons/${basePath}`;

    for (const h of [hexNoFe0f, hexNoFe0f.split('-')[0]]) {
      try {
        const filePath = await fluentEmoji.fromCode(h, fluentStyle);
        const encodedPath = filePath
          .split('/')
          .map(p => encodeURIComponent(p))
          .join('/');

        const ok = await proxyImage(`${BASE_CDN}${encodedPath}`, res);
        if (ok) return;
      } catch (_) {}
    }

    return res.status(404).send(`Fluent emoji not found: ${hexNoFe0f}`);
  }

  const ov = overrides[emoji];
  const resolvedHex = ov?.[style] || hexWithFe0f;
  const resolvedNoFe = resolvedHex.replace(/-fe0f/g, '');

  const sources = {
    apple: `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@latest/img/apple/64/${resolvedHex}.png`,
    google: `https://cdn.jsdelivr.net/npm/emoji-datasource-google@latest/img/google/64/${resolvedHex}.png`,
    facebook: `https://cdn.jsdelivr.net/npm/emoji-datasource-facebook@latest/img/facebook/64/${resolvedHex}.png`,
    twitter: `https://cdn.jsdelivr.net/npm/emoji-datasource-twitter@latest/img/twitter/64/${resolvedHex}.png`,
    messenger: `https://cdn.jsdelivr.net/npm/emoji-datasource-messenger@4.1.0/img/messenger/64/${resolvedHex}.png`,
    blobmoji: `https://cdn.jsdelivr.net/gh/DavidBerdik/blobmoji2@blobmoji-master/svg/${ov?.blobmoji || 'emoji_u' + resolvedNoFe.replace(/-/g, '_')}.svg`,
    oneui: `https://cdn.jsdelivr.net/gh/itsflashframe/emojifonts@main/oneui/${resolvedNoFe}.png`,
    whatsapp: `https://cdn.jsdelivr.net/gh/itsflashframe/emojifonts@main/whatsapp/${resolvedNoFe}.png`,
    emojitwo: `https://cdn.jsdelivr.net/gh/EmojiTwo/emojitwo@master/png/128/${resolvedNoFe}.png`,
    opencolor: `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/color/svg/${ov?.opencolor || resolvedHex.toUpperCase()}.svg`,
    openblack: `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/black/svg/${ov?.openblack || resolvedHex.toUpperCase()}.svg`,
  };

  const url = sources[style] || sources.google;
  const ok = await tryWithFallbacks(url, style, emoji, resolvedNoFe, res);
  if (!ok) return res.status(404).send(`Emoji not found: ${resolvedHex}`);
};
