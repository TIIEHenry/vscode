import fs from 'fs';
import path from 'path';
import {createRequire} from 'module';
const repo='/home/clarence/Projects/Agents/vscode-WorkTrees/merge';
process.chdir(repo);
const require=createRequire(repo+'/package.json');
const {ESLint}=require('eslint');
const pack='/tmp/vscode-d1387-65d-pack';
const manifest=JSON.parse(fs.readFileSync(pack+'/manifest.json','utf8'));
const eslint=new ESLint({cwd:repo});
const results=[];
for(const file of manifest.changedSourcePaths){results.push(...await eslint.lintText(fs.readFileSync(path.join(pack,file),'utf8'),{filePath:path.join(repo,file)}));}
const formatter=await eslint.loadFormatter('stylish');
console.log(formatter.format(results));
const counts=results.reduce((a,r)=>({errors:a.errors+r.errorCount,warnings:a.warnings+r.warningCount}),{errors:0,warnings:0});
fs.writeFileSync('/tmp/vscode-d1387-65d-eslint.json',JSON.stringify({phase:'immutable-overlay-text-lint',themeRef:manifest.themeRef,baseHead:manifest.baseHead,...counts,results},null,2)+'\n');
console.log(JSON.stringify(counts));
process.exitCode=counts.errors?1:0;
