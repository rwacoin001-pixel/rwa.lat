const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');const Module=require('node:module');const path=require('node:path');
const filename=path.join(__dirname,'../apps/admin-frontend/src/lib/product-media.ts');const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const mod=new Module(filename,module);mod._compile(compiled,filename);const normalize=mod.exports.productMediaRefs;
for(const value of [{},null,undefined,'legacy',42])assert.deepEqual(normalize(value),[]);
const original=['rwa-lat-assets/cover.png',null,7,'','rwa-assets/doc.pdf'];assert.deepEqual(normalize(original),['rwa-lat-assets/cover.png','rwa-assets/doc.pdf']);assert.equal(original.length,5);
console.log('Legacy empty JSON object and malformed media entries do not crash the product editor; valid references preserved.');
