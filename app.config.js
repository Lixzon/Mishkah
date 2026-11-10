module.exports = ({ config }) => {
  return {
    ...config,
    name: config.name ?? 'Mishkah',
    slug: config.slug ?? 'mishkah',
    scheme: 'mishkah',
    platforms: ['ios', 'android', 'web'],
    plugins: [
      ...(config.plugins ?? []),
      'expo-audio',
      'expo-asset',
      'expo-web-browser',
      'expo-sharing',
      ['expo-location', { locationWhenInUsePermission: 'Allow Mishkah to use your location to point toward the Qibla.' }],
      ['expo-sensors', { motionPermission: 'Allow Mishkah to use the compass for Qibla direction.' }],
    ],
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
      ...config.extra,
      rafiqApiUrl: process.env.EXPO_PUBLIC_RAFIQ_API_URL ?? '',
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      furqanBaseUrl: process.env.EXPO_PUBLIC_FURQAN_URL?.trim() || 'https://furqan-quran-app.vercel.app',
    },
  };
};
