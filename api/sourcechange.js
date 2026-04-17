const TWEMOJI = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg';

const NOTO_U16 = 'https://images.emojiterra.com/google/noto-emoji/unicode-16.0/color/svg';
const NOTO_U17 = 'https://images.emojiterra.com/google/noto-emoji/unicode-17.0/color/svg';

const NOTO_MAIN_SVG = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg';

const FLUENT_GH = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

const FLUENT_NPM_ICONS = 'https://cdn.jsdelivr.net/npm/fluentui-emoji@latest/icons';

function notoUnicode16(dashedHex) {
  return `${NOTO_U16}/${dashedHex}.svg`;
}

function notoUnicode17(dashedHex) {
  return `${NOTO_U17}/${dashedHex}.svg`;
}

function notoMainBranchSvg(dashedHex) {
  return `${NOTO_MAIN_SVG}/emoji_u${dashedHex.replace(/-/g, '_')}.svg`;
}

function fluentGitHub(displayName, slug) {
  const q = encodeURIComponent(displayName);
  return {
    fluent3d:   `${FLUENT_GH}/${q}/3D/${slug}_3d.svg`,
    fluentflat: `${FLUENT_GH}/${q}/Flat/${slug}_flat.svg`,
    fluenthc:   `${FLUENT_GH}/${q}/High%20Contrast/${slug}_high_contrast.svg`,
  };
}

function fluentNpmIcons(kebab) {
  return {
    fluent3d:   `${FLUENT_NPM_ICONS}/modern/${kebab}.svg`,
    fluentflat: `${FLUENT_NPM_ICONS}/flat/${kebab}.svg`,
    fluenthc:   `${FLUENT_NPM_ICONS}/high-contrast/${kebab}.svg`,
  };
}

const sourceChanges = {

  '1faea': {
    google: notoUnicode17('1faea'),
    apple:  'https://em-content.zobj.net/source/apple/453/distorted-face_1faea.png',
    ...fluentGitHub('Distorted Face', 'distorted_face'),
  },

  '1faef': {
    google: notoUnicode17('1faef'),
    ...fluentGitHub('Fight Cloud', 'fight_cloud'),
  },

  '1fac8': {
    google: notoUnicode17('1fac8'),
    ...fluentGitHub('Hairy Creature', 'hairy_creature'),
  },

  '1f9d1-200d-1fa70': {
    google: notoUnicode17('1f9d1-200d-1fa70'),
    ...fluentGitHub('Ballet Dancer', 'ballet_dancer'),
  },

  '1f46f': {
    google: notoMainBranchSvg('1f46f'),
    ...fluentGitHub('People with bunny ears', 'people_with_bunny_ears'),
  },

  '1f93c': {
    google: notoMainBranchSvg('1f93c'),
    ...fluentGitHub('People wrestling', 'people_wrestling'),
  },

  '1facd': {
    google: notoUnicode17('1facd'),
    ...fluentGitHub('Orca', 'orca'),
  },

  '1f6d8': {
    google: notoUnicode17('1f6d8'),
    ...fluentGitHub('Landslide', 'landslide'),
  },

  '1fa8a': {
    google: notoUnicode17('1fa8a'),
    ...fluentGitHub('Trombone', 'trombone'),
  },

  '1fa8e': {
    google: notoUnicode17('1fa8e'),
    ...fluentGitHub('Treasure Chest', 'treasure_chest'),
  },

  '1fae9': {
    google: notoUnicode16('1fae9'),
    ...fluentGitHub('Face with Bags Under Eyes', 'face_with_bags_under_eyes'),
    ...fluentNpmIcons('face-with-bags-under-eyes'),
  },

  '1f426-200d-1f525': {
    google: notoMainBranchSvg('1f426-200d-1f525'),
    ...fluentGitHub('Phoenix', 'phoenix'),
    ...fluentNpmIcons('phoenix'),
  },

  '1f426-200d-2b1b': {
    google: notoMainBranchSvg('1f426-200d-2b1b'),
    ...fluentGitHub('Black Bird', 'black_bird'),
    ...fluentNpmIcons('black-bird'),
  },

  '1f34b-200d-1f7e9': {
    google: notoMainBranchSvg('1f34b-200d-1f7e9'),
    ...fluentGitHub('Lime', 'lime'),
    ...fluentNpmIcons('lime'),
  },

  '1f344-200d-1f7eb': {
    google: notoUnicode16('1f344-200d-1f7eb'),
    ...fluentGitHub('Brown Mushroom', 'brown_mushroom'),
    ...fluentNpmIcons('brown-mushroom'),
  },

  '1fabf': {
    google: notoMainBranchSvg('1fabf'),
    ...fluentGitHub('Goose', 'goose'),
    ...fluentNpmIcons('goose'),
  },

  '1face': {
    google: notoUnicode16('1face'),
    ...fluentGitHub('Moose', 'moose'),
    ...fluentNpmIcons('moose'),
  },

  '1facf': {
    google: notoUnicode16('1facf'),
    ...fluentGitHub('Donkey', 'donkey'),
    ...fluentNpmIcons('donkey'),
  },

  '1fab8': {
    google: notoMainBranchSvg('1fab8'),
    ...fluentGitHub('Jellyfish', 'jellyfish'),
    ...fluentNpmIcons('jellyfish'),
  },

  '1faf7': {
    google: notoMainBranchSvg('1faf7'),
    ...fluentGitHub('Leftwards Pushing Hand', 'leftwards_pushing_hand'),
    ...fluentNpmIcons('leftwards-pushing-hand'),
  },

  '1faf8': {
    google: notoMainBranchSvg('1faf8'),
    ...fluentGitHub('Rightwards Pushing Hand', 'rightwards_pushing_hand'),
    ...fluentNpmIcons('rightwards-pushing-hand'),
  },

  '1f3f4-e0067-e0062-e0065-e006e-e0067-e007f': {
    '*': `${TWEMOJI}/1f3f4-e0067-e0062-e0065-e006e-e0067-e007f.svg`,
  },

  '1f3f4-e0067-e0062-e0073-e0063-e0074-e007f': {
    '*': `${TWEMOJI}/1f3f4-e0067-e0062-e0073-e0063-e0074-e007f.svg`,
  },

  '1f3f4-e0067-e0062-e0077-e006c-e0073-e007f': {
    '*': `${TWEMOJI}/1f3f4-e0067-e0062-e0077-e006c-e0073-e007f.svg`,
  },

};

module.exports = sourceChanges;
