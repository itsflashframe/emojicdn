const GH_FLUENT = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';
const TWEMOJI   = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg';

function fluent(name, slug) {
  return {
    fluent3d:   `${GH_FLUENT}/${encodeURIComponent(name)}/3D/${slug}_3d.svg`,
    fluentflat: `${GH_FLUENT}/${encodeURIComponent(name)}/Flat/${slug}_flat.svg`,
    fluenthc:   `${GH_FLUENT}/${encodeURIComponent(name)}/High%20Contrast/${slug}_high_contrast.svg`,
  };
}

const sourceChanges = {

  '1faea': {
    google: 'https://images.emojiterra.com/google/noto-emoji/unicode-17.0/color/svg/1faea.svg',
    apple:  'https://em-content.zobj.net/source/apple/453/distorted-face_1faea.png',
  },

  '1fae9': fluent('Face with Bags Under Eyes', 'face_with_bags_under_eyes'),

  '1f426-200d-1f525': fluent('Phoenix', 'phoenix'),

  '1f426-200d-2b1b': fluent('Black Bird', 'black_bird'),

  '1f34b-200d-1f7e9': fluent('Lime', 'lime'),

  '1f344-200d-1f7eb': fluent('Brown Mushroom', 'brown_mushroom'),

  '1fabf': fluent('Goose', 'goose'),

  '1face': fluent('Moose', 'moose'),

  '1facf': fluent('Donkey', 'donkey'),

  '1fab8': fluent('Jellyfish', 'jellyfish'),

  '1faf7': fluent('Leftwards Pushing Hand', 'leftwards_pushing_hand'),

  '1faf8': fluent('Rightwards Pushing Hand', 'rightwards_pushing_hand'),

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
