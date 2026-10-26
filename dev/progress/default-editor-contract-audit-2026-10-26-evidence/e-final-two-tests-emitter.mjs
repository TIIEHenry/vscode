import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream/promises';
const repo=process.cwd();
const require=createRequire(path.join(repo,'package.json'));
const ts=require('typescript');
const gulp=require('gulp');
const inputs=JSON.parse(process.argv[3]);
const optionsPath=process.argv[4];
const compilationPath=path.join(repo,'build/lib/compilation.ts');
const {createCompile}=await import(pathToFileURL(compilationPath).href);
const {ESBuildTranspiler}=await import(pathToFileURL(path.join(repo,'build/lib/tsb/transpiler.ts')).href);
const rootDir=path.join(repo,'src');
const projectPath=path.join(rootDir,'tsconfig.json');
const read=ts.readConfigFile(projectPath,ts.sys.readFile);
if(read.error)throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText,'\n'));
const override={verbose:false,sourceMap:!process.env.VSCODE_NO_SOURCEMAP,rootDir,baseUrl:rootDir,sourceRoot:'file://'+rootDir,newLine:/\r\n/.test(fs.readFileSync(compilationPath,'utf8'))?0:1,inlineSources:false,inlineSourceMap:true};
const cmdLine=ts.parseJsonConfigFileContent(read.config,ts.sys,rootDir,override);
if(cmdLine.errors.length)throw new Error(ts.formatDiagnostics(cmdLine.errors,{getCurrentDirectory:()=>repo,getCanonicalFileName:n=>n,getNewLine:()=> '\n'}));
const transpiler=new ESBuildTranspiler(()=>{},e=>{throw new Error(String(e));},projectPath,cmdLine);
const options={repositoryAPI:'build/lib/compilation.ts:createCompile',call:{src:'src',build:false,emitError:true,transpileOnly:{esbuild:true},preserveEnglish:false},gulpSource:{patterns:inputs,base:'src'},gulpDestination:'out',projectPath,overrides:override,effectiveCompilerOptions:cmdLine.options,actualESBuildTranspilerOptions:transpiler._transformOpts,sourcefileRule:'absolute Vinyl file.path per original ESBuildTranspiler',VSCODE_NO_SOURCEMAP:process.env.VSCODE_NO_SOURCEMAP??null};
if(process.argv[2]==='options'){
 if(fs.existsSync(optionsPath))throw new Error('Refuse options overwrite');
 fs.writeFileSync(optionsPath,JSON.stringify(options,null,2)+'\n');
 console.log('Captured actual repository emitter options; no transform invoked.');
}else{
 if(process.argv[2]!=='emit')throw new Error('unknown mode');
 if(JSON.stringify(JSON.parse(fs.readFileSync(optionsPath,'utf8')))!==JSON.stringify(options))throw new Error('Pinned options changed');
 const compile=createCompile('src',{build:false,emitError:true,transpileOnly:{esbuild:true},preserveEnglish:false});
 await pipeline(gulp.src(inputs,{base:'src'}),compile(),gulp.dest('out'));
 console.log(JSON.stringify({emittedInputs:inputs,onlyExactTwoInputs:true,repositoryCreateCompilePipeline:true}));
}
