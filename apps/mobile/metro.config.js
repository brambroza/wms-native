// Metro config: apps/mobile is NOT an npm workspace member, so we wire the shared
// domain package (packages/shared/src, no runtime deps) in by hand.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');
const sharedSrc = path.resolve(repoRoot, 'packages/shared/src');
const sharedEntry = path.join(sharedSrc, 'index.ts');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), sharedSrc];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@wms/shared': sharedSrc,
};

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@wms/shared') {
    return { type: 'sourceFile', filePath: sharedEntry };
  }
  return upstreamResolve
    ? upstreamResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
