const emojiData     = require('emoji-datasource-apple/emoji.json');
const overrides     = require('./overrides');
const sourceChanges = require('./sourcechange');

const emojiMap     = {};
const emojiMapNoFe = {};
const hexToEntry   = {}; 

emojiData.forEach(e => {
  if (e.char) {
    const unified = e.unified.toLowerCase();
    emojiMap[e.char] = unified;
    emojiMapNoFe[e.char.replace(/\uFE0F/g, '')] = unified;
  }
  if (e.unified) {
    hexToEntry[e.unified.toLowerCase()] = e;
    hexToEntry[e.unified.toLowerCase().replace(/-fe0f/g, '')] = e;
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
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
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

async function tryUrls(urls, res) {
  for (const url of urls) {
    if (!url) continue;
    const ok = await proxyImage(url, res);
    if (ok) return true;
  }
  return false;
}

function lookupSourceChange(hex, style, emoji) {
  const hexNoFe = hex.replace(/-fe0f/g, '');
  for (const key of [hex, hexNoFe, emoji].filter(Boolean)) {
    const entry = sourceChanges[key];
    if (!entry) continue;
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object') {
      const match = entry[style] ?? entry['*'];
      if (!match) continue;
      return typeof match === 'function' ? match(hex) : match;
    }
  }
  return null;
}

function fluentName(hex) {
  const entry = hexToEntry[hex] || hexToEntry[hex.replace(/-fe0f/g, '')];
  if (!entry) return null;
  const raw = (entry.name || entry.short_name || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return raw || null;
}

function fluentUrls(hex, folder) {
  const hexNoFe = hex.replace(/-fe0f/g, '');
  const name    = fluentName(hex);
  const urls    = [];
  const base    = `https:

  if (name) {
    urls.push(`${base}/${name}.svg`);
    if (name.includes('-face')) urls.push(`${base}/${name.replace('-face', '')}.svg`);
    if (!name.includes('-face') && name.includes('-')) {
      const parts = name.split('-');
      urls.push(`${base}/${parts[parts.length - 1]}.svg`);
    }
  }

  if (name) {
    const ghFolder = { modern: '3D', flat: 'Flat', 'high-contrast': 'High Contrast' }[folder];
    const titleName = name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    const fileBase  = name.replace(/-/g, '_');
    urls.push(`https:
    urls.push(`https:
  }

  urls.push(`https:

  return urls;
}


function buildFallbackUrls(style, resolvedHex, resolvedNoFe, ov) {
  const rrHex   = resolvedNoFe.replace(/-/g, '_');
  const elkStyle = { apple:'apple', google:'google', facebook:'facebook', twitter:'twitter',
                     messenger:'messenger' }[style] || null;
  const elk      = elkStyle ? `https:
  const rr       = `https:
  const noto     = `https:

  return { elk, rr, noto, elkStyle };
}


module.exports = async (req, res) => {
  let { emoji } = req.query;
  const style = (req.query.style || 'google').toLowerCase();

  if (!emoji) return res.status(400).send('No emoji provided');
  if (emoji.includes('?')) emoji = emoji.split('?')[0];

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=31536000, stale-while-revalidate');

  const hexWithFe0f  = resolveHex(emoji);
  const hexNoFe0f    = hexWithFe0f.replace(/-fe0f/g, '');
  const ov           = overrides[emoji] || overrides[emoji.replace(/\uFE0F/g, '')];

  const customUrl = lookupSourceChange(hexWithFe0f, style, emoji);
  if (customUrl) {
    const ok = await proxyImage(customUrl, res);
    if (ok) return;
  }

  if (['fluent3d', 'fluentflat', 'fluenthc'].includes(style)) {
    const folder = { fluent3d: 'modern', fluentflat: 'flat', fluenthc: 'high-contrast' }[style];

    if (ov?.[style]) {
      const base = `https:
      const ok   = await proxyImage(`${base}/${ov[style]}.svg`, res);
      if (ok) return;
    }

    const fluentCandidates = fluentUrls(hexWithFe0f, folder);
    const ok = await tryUrls(fluentCandidates, res);
    if (ok) return;

    const rrHex = hexNoFe0f.replace(/-/g, '_');
    const ok2 = await tryUrls([
      `https:
      `https:
    ], res);
    if (ok2) return;

    return res.status(404).send(`Fluent emoji not found: ${hexNoFe0f}`);
  }

  const resolvedHex  = ov?.[style] || hexWithFe0f;
  const resolvedNoFe = resolvedHex.replace(/-fe0f/g, '');
  const { rr, noto, elkStyle } = buildFallbackUrls(style, resolvedHex, resolvedNoFe, ov);
  const rrHex = resolvedNoFe.replace(/-/g, '_');

  const primary = {
    apple:     `https:
    google:    `https:
    facebook:  `https:
    twitter:   `https:
    messenger: `https:
    blobmoji:  `https:
    oneui:     `https:
    whatsapp:  `https:
    emojitwo:  `https:
    opencolor: `https:
    openblack: `https:
  };

  const tier2 = {
    apple:     elkStyle ? `https:
    google:    elkStyle ? `https:
    facebook:  elkStyle ? `https:
    twitter:   elkStyle ? `https:
    messenger: elkStyle ? `https:
    blobmoji:  `https:
    oneui:     null, 
    whatsapp:  null,
    emojitwo:  `https:
    opencolor: `https:
    openblack: `https:
  };

  const chain = [
    primary[style] || primary.google,
    tier2[style],
    `https:
    `https:
  ].filter(Boolean);

  const ok = await tryUrls(chain, res);
  if (!ok) return res.status(404).send(`Emoji not found: ${resolvedHex}`);
};
