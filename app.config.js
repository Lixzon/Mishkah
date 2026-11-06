const { createHash } = require('node:crypto');

module.exports = ({ config }) => {
  const masterKey = process.env.LIXZON_MASTER_KEY;
  if (masterKey && Buffer.byteLength(masterKey, 'utf8') < 32) {
    throw new Error('LIXZON_MASTER_KEY must be at least 32 bytes; generate a strong random key.');
  }

  const extra = { ...config.extra };
  if (masterKey) {
    extra.developerKeyDigest = createHash('sha256').update(masterKey, 'utf8').digest('hex');
  } else {
    delete extra.developerKeyDigest;
  }

  return {
    ...config,
    name: config.name ?? 'Mishkah',
    slug: config.slug ?? 'mishkah',
    scheme: 'mishkah',
    platforms: ['ios', 'android', 'web'],
    web: {
      bundler: 'metro',
      output: 'single',
      meta: {
        'theme-color': '#145B50',
        viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
    },
    experiments: {
      ...config.experiments,
      ...(process.env.GITHUB_PAGES === 'true' ? { baseUrl: '/Mishkah/' } : {}),
    },
    extra: {
      ...extra,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
      syncApiUrl: process.env.EXPO_PUBLIC_SYNC_API_URL ?? '',
    },
  };
};
