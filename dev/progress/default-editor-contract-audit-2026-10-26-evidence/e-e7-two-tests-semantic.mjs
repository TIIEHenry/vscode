import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const repo=process.cwd();
const require=createRequire(path.join(repo,'package.json'));
const ts=require('typescript');
const targets=JSON.parse(process.argv[2]);
const configPath=path.join(repo,'src/tsconfig.json');
const config=ts.readConfigFile(configPath,ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,path.dirname(configPath),{noEmit:true},configPath);
const program=ts.createProgram({rootNames:parsed.fileNames,options:parsed.options,projectReferences:parsed.projectReferences});
const format=d=>({file:d.file?path.relative(repo,d.file.fileName):null,code:d.code,category:ts.DiagnosticCategory[d.category],start:d.start??null,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')});
const result={checker:'TypeScript createProgram with actual complete src project roots/options, targeted diagnostics only',typescript:ts.version,configPath,rootCount:parsed.fileNames.length,noEmit:program.getCompilerOptions().noEmit,fullProjectSemanticCheck:false,sourceOrNativeWritten:false,configDiagnostics:[...(config.error?[config.error]:[]),...parsed.errors,...program.getOptionsDiagnostics(),...program.getGlobalDiagnostics()].map(format),files:[]};
for(const target of targets){
 const sf=program.getSourceFile(path.join(repo,target));
 if(!sf)throw new Error('Target missing from actual src project: '+target);
 result.files.push({sourcePath:target,syntacticDiagnostics:program.getSyntacticDiagnostics(sf).map(format),semanticDiagnostics:program.getSemanticDiagnostics(sf).map(format)});
}
result.errorCount=result.configDiagnostics.filter(d=>d.category==='Error').length+result.files.reduce((n,f)=>n+[...f.syntacticDiagnostics,...f.semanticDiagnostics].filter(d=>d.category==='Error').length,0);
console.log(JSON.stringify(result,null,2));
process.exitCode=result.errorCount?1:0;
