const emojiData   = require('emoji-datasource-apple/emoji.json');
const fluentEmoji = require('fluentui-emoji-js');
const overrides   = require('./overrides');



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

module.exports = async (req, res) => {
  let { emoji } = req.query;
  const style = (req.query.style || 'google').toLowerCase();

  if (!emoji) return res.status(400).send('No emoji provided');
  if (emoji.includes('?')) emoji = emoji.split('?')[0];

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=31536000, stale-while-revalidate');

  const ov = overrides[emoji];

  if (['fluent3d', 'fluentflat', 'fluenthc'].includes(style)) {
    const folder      = { fluent3d: 'modern', fluentflat: 'flat', fluenthc: 'high-contrast' }[style];
    const fluentStyle = { fluent3d: '3D', fluentflat: 'Flat', fluenthc: 'High Contrast' }[style];
    const BASE        = `https://cdn.jsdelivr.net/npm/fluentui-emoji@1.3.0/icons/${folder}`;

    if (ov?.[style]) {
      const ok = await proxyImage(`${BASE}/${ov[style]}.svg`, res);
      if (ok) return;
    }

    const hexNoFe0f = resolveHex(emoji).replace(/-fe0f/g, '');
    for (const h of [hexNoFe0f, hexNoFe0f.split('-')[0]]) {
      try {
        const filePath  = await fluentEmoji.fromCode(h, fluentStyle);
        const emojiName = filePath.split('/').filter(Boolean)[0].toLowerCase().replace(/\s+/g, '-');
        const ok = await proxyImage(`${BASE}/${emojiName}.svg`, res);
        if (ok) return;
      } catch (_) {}
    }
    return res.status(404).send(`Fluent emoji not found: ${hexNoFe0f}`);
  }

  const hexWithFe0f = ov?.[style] || resolveHex(emoji);
  const hexNoFe0f   = hexWithFe0f.replace(/-fe0f/g, '');

  const sources = {
    apple:     `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@latest/img/apple/64/${hexWithFe0f}.png`,
    google:    `https://cdn.jsdelivr.net/npm/emoji-datasource-google@latest/img/google/64/${hexWithFe0f}.png`,
    facebook:  `https://cdn.jsdelivr.net/npm/emoji-datasource-facebook@latest/img/facebook/64/${hexWithFe0f}.png`,
    twitter:   `https://cdn.jsdelivr.net/npm/emoji-datasource-twitter@latest/img/twitter/64/${hexWithFe0f}.png`,
    messenger: `https://cdn.jsdelivr.net/npm/emoji-datasource-messenger@4.1.0/img/messenger/64/${hexWithFe0f}.png`,
    blobmoji:  `https://cdn.jsdelivr.net/gh/DavidBerdik/blobmoji2@blobmoji-master/svg/${ov?.blobmoji || 'emoji_u' + hexNoFe0f.replace(/-/g, '_')}.svg`,
    oneui:     `https://cdn.jsdelivr.net/gh/itsflashframe/emojifonts@main/oneui/${hexNoFe0f}.png`,
    whatsapp:  `https://cdn.jsdelivr.net/gh/itsflashframe/emojifonts@main/whatsapp/${hexNoFe0f}.png`,
    emojitwo:  `https://cdn.jsdelivr.net/gh/EmojiTwo/emojitwo@master/png/128/${hexNoFe0f}.png`,
    opencolor: `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/color/svg/${ov?.opencolor || hexNoFe0f.toUpperCase()}.svg`,
    openblack: `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/black/svg/${ov?.openblack || hexNoFe0f.toUpperCase()}.svg`,
  };

  const url = sources[style] || sources.google;
  const ok  = await proxyImage(url, res);
  if (!ok) return res.status(404).send(`Emoji not found: ${hexWithFe0f}`);
};
