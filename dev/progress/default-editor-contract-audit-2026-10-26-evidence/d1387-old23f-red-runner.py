import argparse, pathlib, subprocess, json, hashlib, os, datetime
parser = argparse.ArgumentParser()
parser.add_argument('--test-ref', required=True)
parser.add_argument('--grep', required=True)
parser.add_argument('--test', action='append', required=True)
parser.add_argument('--artifact-prefix', required=True)
args = parser.parse_args()
repo = pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
os.chdir(repo)
ref = subprocess.check_output(['git', 'rev-parse', '--verify', args.test_ref + '^{commit}'], text=True).strip()
old_ref = '23f8701c8d2a6bd4b47c2e098c62a5bb89649c84'
producer = 'src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts'
files = [producer, *args.test]
assert all(file.startswith('src/vs/') and file.endswith('.ts') for file in files)
assert all('/test/' in file for file in args.test)
sha = lambda data: hashlib.sha256(data).hexdigest()
node = "import {transform} from 'esbuild'; let text=''; for await(const chunk of process.stdin){text+=chunk;} const result=await transform(text,{loader:'ts',format:'esm',target:'es2024',sourcemap:'inline',sourcesContent:false,sourcefile:process.argv[1],tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}}}); process.stdout.write(result.code.replaceAll('.ts?esm','.js?esm'));"
manifest = {'phase': 'old23f-production-with-new-immutable-tests', 'sourceHead': subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(), 'testRef': ref, 'producerRef': old_ref, 'modules': []}
backups = []
try:
    for file in files:
        chosen = old_ref if file == producer else ref
        source = subprocess.check_output(['git', 'show', chosen + ':' + file])
        output = pathlib.Path('out') / pathlib.Path(file).relative_to('src').with_suffix('.js')
        old = output.read_bytes()
        code = subprocess.check_output(['node', '--input-type=module', '-e', node, file], input=source)
        backups.append((output, old))
        output.write_bytes(code)
        manifest['modules'].append({'sourcePath': file, 'sourceRef': chosen, 'sourceSha256': sha(source), 'outputPath': str(output), 'beforeOutputSha256': sha(old), 'installedOutputSha256': sha(code)})
    command = ['timeout','--foreground','-k','15s','180s','xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000']
    for file in args.test:
        command.extend(['--run', file])
    command.extend(['--grep', args.grep])
    manifest['command'] = command
    with open(args.artifact_prefix + '.log', 'w') as log:
        result = subprocess.run(command, env={**os.environ, 'VSCODE_SKIP_PRELAUNCH':'1'}, stdout=log, stderr=subprocess.STDOUT)
    manifest['exitCode'] = result.returncode
finally:
    for (output, old), module in zip(backups, manifest['modules']):
        output.write_bytes(old)
        module['restoredOutputSha256'] = sha(output.read_bytes())
        assert module['restoredOutputSha256'] == module['beforeOutputSha256']
    pathlib.Path(args.artifact_prefix + '-identity.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'testRef': ref, 'exitCode': manifest.get('exitCode'), 'restored': len(backups)}))
