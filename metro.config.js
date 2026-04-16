const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaultRewriteRequestUrl = config.server.rewriteRequestUrl;

if (!config.resolver.assetExts.includes('ogg')) {
  config.resolver.assetExts.push('ogg');
}

config.server.rewriteRequestUrl = (requestUrl) => {
  const rewrittenUrl =
    typeof defaultRewriteRequestUrl === 'function' ? defaultRewriteRequestUrl(requestUrl) : requestUrl;

  try {
    const parsedUrl = new URL(rewrittenUrl, 'resolve://metro');
    const assetPathPrefix = '/assets/.';
    if (!parsedUrl.pathname.startsWith(assetPathPrefix)) {
      return rewrittenUrl;
    }

    const encodedAssetPath = parsedUrl.pathname.slice('/assets/'.length);
    const onceDecodedPath = decodeURIComponent(encodedAssetPath);
    const assetPath = decodeURIComponent(onceDecodedPath);
    if (!assetPath.startsWith('./')) {
      return rewrittenUrl;
    }

    parsedUrl.pathname = '/assets/';
    parsedUrl.searchParams.set('unstable_path', assetPath);
    return `${parsedUrl.pathname}${parsedUrl.search}`;
  } catch {
    return rewrittenUrl;
  }
};

module.exports = config;
