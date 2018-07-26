const path = require('path')
const Bundler = require('parcel-bundler')
const plugin = require('../lib')
const FontPackager = require('../lib/font-packager')

const DIST = path.join(__dirname, 'dist')
const simple = path.join(__dirname, 'fixtures/simple.html')

/* eslint-env jest */

describe('lib/index.js', () => {
  let bundler

  describe('simple case', () => {
    beforeAll(async () => {
      bundler = new Bundler(simple, {
        watch: false,
        logLevel: 0,
        production: true,
        outDir: DIST,
      })

      plugin(bundler)
    })

    it(
      'should eliminate unused glyphs',
      async () => {
        const bundle = await bundler.bundle()
        const assets = FontPackager.collectAllAssets(bundle)
        const ttf = assets.find(asset => asset.name.endsWith('ttf'))
        expect(ttf.bundledSize).toBeLessThan(4000)
      },
      15000,
    )
  })
})
