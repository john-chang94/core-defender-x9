const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('ogg')) {
  config.resolver.assetExts.push('ogg');
}

const defaultEnhanceMiddleware = config.server.enhanceMiddleware;

config.server.enhanceMiddleware = (middleware, server) => {
  const enhancedMiddleware =
    typeof defaultEnhanceMiddleware === 'function' ? defaultEnhanceMiddleware(middleware, server) : middleware;

  return (req, res, next) => {
    if (req.url && req.url.startsWith('/assets/') && req.url.includes('%2F')) {
      req.url = req.url.replace(/%2F/gi, '/');
    }
    return enhancedMiddleware(req, res, next);
  };
};

module.exports = config;
