import {createHash} from 'node:crypto'
import {readdirSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
/** Hash every deployable byte, including server chunks and assets, in stable path order. */
export function artifactDigest(root) {
  if(root instanceof URL)root=fileURLToPath(root)
  const hash=createHash('sha256')
  function walk(dir,prefix='') {
    for(const entry of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
      const relative=prefix+entry.name,path=join(dir,entry.name)
      if(relative==='brand-build.json')continue
      // OpenNext's handler.mjs is already bundled. Its copied compiler dependency
      // tree is not shipped and on Windows retains junctions to the source store.
      if(/^server-functions\/[^/]+\/node_modules$/.test(relative))continue
      if(entry.isDirectory()){walk(path,relative+'/');continue}
      if(entry.isSymbolicLink())throw new Error(`Artifact contains an unresolved link: ${relative}`)
      hash.update(relative+'\0').update(createHash('sha256').update(readFileSync(path)).digest()).update('\0')
    }
  }
  walk(root);return hash.digest('hex')
}
