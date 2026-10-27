import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const scratch=path.dirname(import.meta.filename), manifest=JSON.parse(fs.readFileSync(path.join(scratch,'input-manifest.json'),'utf8'));
const repo=process.cwd();if(repo!==manifest.repo)throw Error('Wrong repository cwd');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const require=createRequire(path.join(repo,'package.json')), ts=require('typescript'),gulp=require('gulp'),es=require('event-stream');
const compilationPath=path.join(repo,'build/lib/compilation.ts');
const {createCompile}=await import(pathToFileURL(compilationPath).href);
const util=await import(pathToFileURL(path.join(repo,'build/lib/util.ts')).href);
const {ESBuildTranspiler}=await import(pathToFileURL(path.join(repo,'build/lib/tsb/transpiler.ts')).href);
const rootDir=path.join(repo,'src'),projectPath=path.join(rootDir,'tsconfig.json');
const read=ts.readConfigFile(projectPath,ts.sys.readFile);if(read.error)throw Error(ts.flattenDiagnosticMessageText(read.error.messageText,'\n'));
const override={verbose:false,sourceMap:!process.env.VSCODE_NO_SOURCEMAP,rootDir,baseUrl:rootDir,sourceRoot:util.toFileUri(rootDir),newLine:/\r\n/.test(fs.readFileSync(compilationPath,'utf8'))?0:1,inlineSources:false,inlineSourceMap:true};
const parsed=ts.parseJsonConfigFileContent(read.config,ts.sys,rootDir,override);if(parsed.errors.length)throw Error('Invalid actual src configuration');
const transpiler=new ESBuildTranspiler(()=>{},e=>{throw Error(String(e));},projectPath,parsed);
const toolPackages={};for(const name of ['typescript','esbuild','gulp','vinyl']){const p=require.resolve(name+'/package.json');const b=fs.readFileSync(p);toolPackages[name]={packagePath:p,packageSha256:sha(b),packageVersion:JSON.parse(b).version,modulePath:require.resolve(name),runtimeVersion:require(name).version??null};}
const options={repositoryAPI:'build/lib/compilation.ts:createCompile',call:{src:'src',build:false,emitError:true,transpileOnly:{esbuild:true},preserveEnglish:false},effectiveCompilerOptions:parsed.options,actualESBuildTranspilerOptions:transpiler._transformOpts,projectPath,overrides:override,sourceRule:'Canonical repository Vinyl path/base; exact immutable Git blob bytes replace disk content before createCompile; no repository source writes',sourceInputs:manifest.sourceFiles,expectedOutputPaths:manifest.sourceFiles.map(r=>r.outputPath).sort(),actualInputCount:5,inlineSourceMap:true,standaloneMapAllowed:false,nodeVersion:process.version,nodeExecutable:process.execPath,toolPackages,repositoryBuildInputs:['build/lib/compilation.ts','build/lib/util.ts','build/lib/tsb/index.ts','build/lib/tsb/transpiler.ts','build/lib/tsconfigUtils.ts','src/tsconfig.json','src/tsconfig.base.json'].map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(repo,p)))}))};
const mode=process.argv[2];if(!['dry','emit'].includes(mode))throw Error('Expected dry or emit');
const optionsPath=path.join(scratch,'emitter-options.json');
if(mode==='dry'){if(fs.existsSync(optionsPath))throw Error('Refuse options overwrite');fs.writeFileSync(optionsPath,JSON.stringify(options,null,2)+'\n');}else if(JSON.stringify(JSON.parse(fs.readFileSync(optionsPath,'utf8')))!==JSON.stringify(options))throw Error('Pinned emitter options changed');
const expected=new Map(manifest.sourceFiles.map(r=>[path.resolve(repo,r.sourcePath),r]));
for(const row of manifest.sourceFiles){const b=execFileSync('rtk',['proxy','git','show',row.sourceRef+':'+row.sourcePath],{cwd:repo,maxBuffer:8*1024*1024});if(sha(b)!==row.sourceSha256||!b.equals(fs.readFileSync(row.inputCopyPath)))throw Error('Immutable source qualification failed');}
const generated=[],seen=new Set(),destination=path.join(scratch,mode+'-generated');if(fs.existsSync(destination))throw Error('Refuse generated artifact overwrite');
const inputs=manifest.sourceFiles.map(r=>r.sourcePath);
const replace=es.mapSync(file=>{const row=expected.get(file.path);if(!row)throw Error('Unexpected source input '+file.path);file.contents=fs.readFileSync(row.inputCopyPath);if(sha(file.contents)!==row.sourceSha256)throw Error('Input content changed');return file;});
const enumerate=es.mapSync(file=>{const out=path.relative(repo,path.resolve(repo,'out',file.relative)).split(path.sep).join('/');if(!options.expectedOutputPaths.includes(out)||seen.has(out)||!out.endsWith('.js'))throw Error('Unauthorized extra/duplicate/non-JS output '+out);seen.add(out);const source=manifest.sourceFiles.find(r=>r.outputPath===out);generated.push({outputPath:out,vinylPath:file.path,vinylBase:file.base,relativePath:file.relative,bytes:file.contents.length,sha256:sha(file.contents),sourceRef:source.sourceRef,sourceBlob:source.sourceBlob,sourceSha256:source.sourceSha256,role:source.role});return file;});
const compile=createCompile('src',{build:false,emitError:true,transpileOnly:{esbuild:true},preserveEnglish:false});
await util.streamToPromise(gulp.src(inputs,{base:'src'}).pipe(replace).pipe(compile()).pipe(enumerate).pipe(gulp.dest(destination)));
generated.sort((a,b)=>a.outputPath.localeCompare(b.outputPath));if(JSON.stringify([...seen].sort())!==JSON.stringify(options.expectedOutputPaths))throw Error('Pipeline did not emit exactly the authorized five outputs');
const actualFiles=[];function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())walk(f);else actualFiles.push(path.relative(destination,f).split(path.sep).join('/'));}}walk(destination);actualFiles.sort();if(JSON.stringify(actualFiles)!==JSON.stringify(options.expectedOutputPaths.map(p=>p.slice(4))))throw Error('Unexpected generated writeFile artifact; no out writes allowed');
const report={mode,atUtc:new Date().toISOString(),actualInputCount:inputs.length,repositoryCreateCompilePipeline:true,actualESBuildTranspiler:true,repositoryStreamToPromise:true,standaloneMapCount:actualFiles.filter(p=>p.endsWith('.map')).length,generatedArtifactPaths:actualFiles.map(p=>path.join(destination,p)),outputs:generated,outWriteFileCalls:[],noRepositorySourceWritten:true,fullCompileOfFinalSourceTree:false};
const reportPath=path.join(scratch,mode+'-emitter-report.json');if(fs.existsSync(reportPath))throw Error('Refuse report overwrite');
if(mode==='emit'){
 const dry=JSON.parse(fs.readFileSync(path.join(scratch,'dry-emitter-report.json'),'utf8'));if(JSON.stringify(generated)!==JSON.stringify(dry.outputs))throw Error('Dry/emit output byte enumeration differs; no out write performed');
 const seals=JSON.parse(fs.readFileSync(path.join(scratch,'sealed-originals.json'),'utf8'));
 try{for(const row of generated){const target=path.resolve(repo,row.outputPath),seal=seals.find(r=>r.path===row.outputPath);if(!seal||!options.expectedOutputPaths.includes(row.outputPath)||!fs.lstatSync(target).isFile()||sha(fs.readFileSync(target))!==seal.sha256)throw Error('Out original changed before write');const bytes=fs.readFileSync(path.join(destination,row.outputPath.slice(4)));if(sha(bytes)!==row.sha256)throw Error('Generated bytes changed');fs.writeFileSync(target,bytes);report.outWriteFileCalls.push({path:row.outputPath,absolutePath:target,bytes:bytes.length,sha256:sha(bytes),completedAtUtc:new Date().toISOString()});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');}}
 finally{fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');}
}
else fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({mode,actualInputs:inputs.length,exactEnumeratedOutputs:generated.map(r=>r.outputPath),standaloneMapCount:report.standaloneMapCount,outWriteFileCallCount:report.outWriteFileCalls.length,repositoryCreateCompilePipeline:true}));
