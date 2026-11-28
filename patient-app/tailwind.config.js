/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: require('./src/theme/colors.js'),
      fontFamily: {
        // React Native picks a face by family name, not by font weight.
        pj: ['PlusJakartaSans_400Regular'],
        'pj-md': ['PlusJakartaSans_500Medium'],
        'pj-sb': ['PlusJakartaSans_600SemiBold'],
        'pj-bd': ['PlusJakartaSans_700Bold'],
        'pj-xb': ['PlusJakartaSans_800ExtraBold'],
      },
    },
  },
};
