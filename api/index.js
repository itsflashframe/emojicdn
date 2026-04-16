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
  const base    = `https://cdn.jsdelivr.net/npm/fluentui-emoji@1.3.0/icons/${folder}`;

  if (name) {

    urls.push(`${base}/${name}.svg`);
  
    if (name.includes('-face')) urls.push(`${base}/${name.replace('-face', '')}.svg`);
    if (!name.includes('-face') && name.includes('-')) {
      const parts = name.split('-');
      urls.push(`${base}/${parts[parts.length - 1]}.svg`);
    }
  }

  // Try alternate versions from GitHub raw (more up to date than npm)
  if (name) {
    const ghFolder = { modern: '3D', flat: 'Flat', 'high-contrast': 'High Contrast' }[folder];
    const titleName = name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    const fileBase  = name.replace(/-/g, '_');
    urls.push(`https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/${encodeURIComponent(titleName)}/${ghFolder}/${fileBase}_${folder === 'modern' ? '3d' : folder === 'flat' ? 'flat' : 'high_contrast'}.svg`);
    urls.push(`https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/${encodeURIComponent(titleName)}/${ghFolder}/${fileBase}_${folder === 'modern' ? '3d' : folder === 'flat' ? 'flat' : 'high_contrast'}.png`);
  }

  
  urls.push(`https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/color/svg/${hexNoFe.toUpperCase()}.svg`);

  return urls;
}



function buildFallbackUrls(style, resolvedHex, resolvedNoFe, ov) {

  const rrHex   = resolvedNoFe.replace(/-/g, '_');
  const elkStyle = { apple:'apple', google:'google', facebook:'facebook', twitter:'twitter',
                     messenger:'messenger' }[style] || null;
  const elk      = elkStyle ? `https://emojicdn.elk.sh/${encodeURIComponent('?')}?style=${elkStyle}` : null;
 
  const rr       = `https://static.realityripple.com/tools/emoji/emoji/${rrHex}.png`;
  const noto     = `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u${resolvedNoFe.replace(/-/g, '_')}.png`;

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
      const base = `https://cdn.jsdelivr.net/npm/fluentui-emoji@1.3.0/icons/${folder}`;
      const ok   = await proxyImage(`${base}/${ov[style]}.svg`, res);
      if (ok) return;
    }

    
    const fluentCandidates = fluentUrls(hexWithFe0f, folder);
    const ok = await tryUrls(fluentCandidates, res);
    if (ok) return;


    const rrHex = hexNoFe0f.replace(/-/g, '_');
    const ok2 = await tryUrls([
      `https://static.realityripple.com/tools/emoji/emoji/${rrHex}.png`,
      `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u${rrHex}.png`,
    ], res);
    if (ok2) return;

    return res.status(404).send(`Fluent emoji not found: ${hexNoFe0f}`);
  }

  
  const resolvedHex  = ov?.[style] || hexWithFe0f;
  const resolvedNoFe = resolvedHex.replace(/-fe0f/g, '');
  const { rr, noto, elkStyle } = buildFallbackUrls(style, resolvedHex, resolvedNoFe, ov);
  const rrHex = resolvedNoFe.replace(/-/g, '_');

  const primary = {
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

  
  const tier2 = {
    apple:     elkStyle ? `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=apple`     : null,
    google:    elkStyle ? `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=google`    : null,
    facebook:  elkStyle ? `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=facebook`  : null,
    twitter:   elkStyle ? `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=twitter`   : null,
    messenger: elkStyle ? `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=messenger` : null,
    
    blobmoji:  `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u${rrHex}.png`,
    oneui:     null, 
    whatsapp:  null,
    emojitwo:  `https://cdn.jsdelivr.net/gh/joypixels/emoji-assets@master/png/64/${resolvedNoFe}.png`,
    opencolor: `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/color/72x72/${ov?.opencolor || resolvedHex.toUpperCase()}.png`,
    openblack: `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/black/72x72/${ov?.openblack || resolvedHex.toUpperCase()}.png`,
  };

  const chain = [
    primary[style] || primary.google,
    tier2[style],
    `https://static.realityripple.com/tools/emoji/emoji/${rrHex}.png`,   
    `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/png/128/emoji_u${rrHex}.png`, 
  ].filter(Boolean);

  const ok = await tryUrls(chain, res);
  if (!ok) return res.status(404).send(`Emoji not found: ${resolvedHex}`);
};
