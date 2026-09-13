const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for Windows: ensure Metro watches all files properly
config.watchFolders = [__dirname];

config.resolver.sourceExts = [
  'js', 'jsx', 'ts', 'tsx', 'json', 'svg'
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'idb') {
    return {
      filePath: require.resolve('./src/utils/idb-stub.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
