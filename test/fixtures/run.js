const Bundler = require('parcel-bundler')
const FontminPlugin = require('../../lib')

const bundle = new Bundler(`${__dirname}/simple.html`, {
  minify: true,
  production: true,
})

FontminPlugin(bundle)

bundle.bundle()
