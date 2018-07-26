const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const Fontmin = require('fontmin')
const woff2 = require('wawoff2')
const RawPackager = require('parcel-bundler/src/packagers/RawPackager')

let CSSPackager
try {
  CSSPackager = require('parcel-plugin-nukecss').CSSPackager
} catch (e) {}

const SYMBOL = Symbol('parcel-plugin-fontmin')

const FONT_REGEX = /\.(eot|ttf|svg|woff|woff2)$/
const CSS_GLYPH_REGEX = /content\s*:[^};]*?('|")(.*?)\s*('|"|;)/g
const UNICODE_REGEX = /\\(\w{4})/

function setupFontmin(glyphs) {
  return new Fontmin()
    .use(Fontmin.glyph({text: glyphs.join(' ')}))
    .use(Fontmin.ttf2woff())
    .use(Fontmin.ttf2eot())
    .use(Fontmin.ttf2svg())
}

function runFontmin(fontmin, buffer) {
  return new Promise((resolve, reject) => {
    fontmin.src(buffer).run((err, files) => {
      if (err) reject(err)
      else resolve(files)
    })
  })
}

class FontPackager extends RawPackager {
  static findGlyphs(mainBundle) {
    if (mainBundle[SYMBOL] && mainBundle[SYMBOL].glyphs) return mainBundle[SYMBOL].glyphs

    const assets = FontPackager.collectAllAssets(mainBundle)

    return _(assets)
      .flatMap(asset => [asset.generated.css, asset.generated.js, asset.generated.html])
      .flatMap(content => (content && content.match(CSS_GLYPH_REGEX)) || [])
      .map(cssMatch => cssMatch.match(UNICODE_REGEX))
      .filter(Boolean)
      .map(glyphMatch => String.fromCharCode(parseInt(glyphMatch[1], 16)))
      .value()
  }

  static findFontGroups(mainBundle) {
    const assets = FontPackager.collectAllAssets(mainBundle)
    const fontAssets = assets.filter(asset => FONT_REGEX.test(asset.name)).map(asset => {
      const extension = path.extname(asset.name)
      const fontName = path.basename(asset.name, extension)

      let buffer = asset.generated[extension.slice(1)]
      if (!buffer || (buffer && buffer.path)) {
        buffer = fs.readFileSync(buffer ? buffer.path : asset.name)
      }

      return {asset, extension, fontName, buffer}
    })

    return _.values(_.groupBy(fontAssets, 'fontName'))
  }

  static async traverseAndMinify(mainBundle) {
    if (mainBundle[SYMBOL] && mainBundle[SYMBOL].minifiedFonts)
      return mainBundle[SYMBOL].minifiedFonts

    const glyphs = FontPackager.findGlyphs(mainBundle)

    const minifiedFonts = new Map()
    for (const fontGroup of FontPackager.findFontGroups(mainBundle)) {
      const ttfFontAsset = fontGroup.find(font => font.extension === '.ttf')
      if (!ttfFontAsset) continue

      const fontmin = setupFontmin(glyphs)
      const minifiedGroup = await runFontmin(fontmin, ttfFontAsset.buffer)
      const ttfMinified = minifiedGroup.find(el => el.extname === '.ttf').contents
      for (const {asset, extension} of fontGroup) {
        let minified = minifiedGroup.find(el => el.extname === extension)
        if (extension === '.woff2') minified = Buffer.from(await woff2.compress(ttfMinified))
        if (minified) minifiedFonts.set(asset.id, minified.contents)
        if (Buffer.isBuffer(minified)) minifiedFonts.set(asset.id, minified)
      }
    }

    mainBundle[SYMBOL].minifiedFonts = minifiedFonts
    return minifiedFonts
  }

  static collectAllAssets(mainBundle) {
    if (mainBundle[SYMBOL] && mainBundle[SYMBOL].allAssets) return mainBundle[SYMBOL].allAssets

    const collection = new Set()

    function recurse(bundle) {
      for (const asset of bundle.assets) {
        collection.add(asset)
      }

      for (const child of bundle.childBundles) {
        if (collection.has(child.entryAsset)) continue
        recurse(child, collection)
      }
    }

    recurse(mainBundle)
    mainBundle[SYMBOL] = mainBundle[SYMBOL] || {}
    mainBundle[SYMBOL].allAssets = Array.from(collection)
    return mainBundle[SYMBOL].allAssets
  }

  async addAsset(asset) {
    if (this.options.production) {
      const mainBundle = this.bundler.mainBundle
      if (CSSPackager) CSSPackager.traverseAndNuke(mainBundle, {mutate: true})

      const fonts = await FontPackager.traverseAndMinify(mainBundle)
      if (fonts.has(asset.id)) {
        asset.generated[this.bundle.type] = fonts.get(asset.id)
      }
    }

    return super.addAsset(asset)
  }
}

module.exports = FontPackager
