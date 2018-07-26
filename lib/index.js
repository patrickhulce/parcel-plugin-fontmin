module.exports = function(bundler) {
  bundler.addPackager('ttf', require.resolve('./font-packager'))
  bundler.addPackager('woff', require.resolve('./font-packager'))
  bundler.addPackager('woff2', require.resolve('./font-packager'))
  bundler.addPackager('eot', require.resolve('./font-packager'))
  bundler.addPackager('svg', require.resolve('./font-packager'))
}
