const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Watch the shared customer-display package for live reload during development
config.watchFolders = [path.resolve(__dirname, 'packages/customer-display')];

// Exclude heavy directories like android, backend, build artifacts from Metro file map
const exclusionList = [
  /.*[\\\/]android[\\\/]app[\\\/]build[\\\/].*/,
  /^[\\\/]dist[\\\/].*/,
  /.*[\\\/]\.expo[\\\/].*/,
  /.*[\\\/]\.git[\\\/].*/,
];

if (Array.isArray(config.resolver.blockList)) {
  config.resolver.blockList.push(...exclusionList);
} else if (config.resolver.blockList) {
  config.resolver.blockList = [config.resolver.blockList, ...exclusionList];
} else {
  config.resolver.blockList = exclusionList;
}

// mssql / express / etc. are Node.js-only packages that use `import.meta`.
// They cannot be bundled by Metro for web/RN → stub them out.
const STUB = path.resolve(__dirname, 'shims/empty-module.js');
config.resolver.sourceExts.push('mjs');

const whatwgFetchPath = path.resolve(__dirname, 'node_modules/whatwg-fetch/fetch.js');
const axiosPath = path.resolve(__dirname, 'node_modules/axios/index.js');

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  mssql: STUB,
  express: STUB,
  'body-parser': STUB,
  cors: STUB,
  dotenv: STUB,
  tedious: STUB,
  'whatwg-fetch': whatwgFetchPath,
  axios: axiosPath,
  '@unipro/customer-display': path.resolve(__dirname, 'packages/customer-display'),
  // Monorepo peer dependency mappings
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  'react-native-web': path.resolve(__dirname, 'node_modules/react-native-web'),
  'react-native-web/dist': path.resolve(__dirname, 'node_modules/react-native-web/dist'),
  'react-native-web/dist/index': path.resolve(__dirname, 'node_modules/react-native-web/dist/index.js'),
  zustand: path.resolve(__dirname, 'node_modules/zustand'),
  'socket.io-client': path.resolve(__dirname, 'node_modules/socket.io-client'),
  'react-native-svg': path.resolve(__dirname, 'node_modules/react-native-svg'),
  'react-native-qrcode-svg': path.resolve(__dirname, 'node_modules/react-native-qrcode-svg'),
  '@expo/vector-icons': path.resolve(__dirname, 'node_modules/@expo/vector-icons'),
  '@react-native-async-storage/async-storage': path.resolve(__dirname, 'node_modules/@react-native-async-storage/async-storage'),
  'expo-router': path.resolve(__dirname, 'node_modules/expo-router'),
};

config.resolver.unstable_enablePackageExports = false;

const rnwIndex = path.resolve(__dirname, 'node_modules/react-native-web/dist/index.js');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-web/dist/index' || moduleName === 'react-native-web/dist') {
    return {
      filePath: rnwIndex,
      type: 'sourceFile',
    };
  }
  if (moduleName === 'whatwg-fetch') {
    return {
      filePath: whatwgFetchPath,
      type: 'sourceFile',
    };
  }
  if (moduleName === 'axios') {
    return {
      filePath: axiosPath,
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
