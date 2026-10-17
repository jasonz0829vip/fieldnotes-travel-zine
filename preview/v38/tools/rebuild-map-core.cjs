// Identical build command on QLS or RTX3070: npm ci && npm run build:core.
// The generated browser file is self-contained and requires no npm/runtime install.
const fs=require('fs'),path=require('path'),esbuild=require('esbuild');
const source=path.join(__dirname,'map-core-source.mjs');
esbuild.buildSync({entryPoints:[source],bundle:true,platform:'browser',format:'iife',target:['es2020'],minify:true,
 outfile:path.join(__dirname,'..','v38-map-core.js')});
console.log('BUILT',fs.statSync(path.join(__dirname,'..','v38-map-core.js')).size);