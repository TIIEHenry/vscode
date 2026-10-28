import pathlib, subprocess, json, sys, time
directory = pathlib.Path(pathlib.Path('/tmp/vscode-closeout-final-integration-current.txt').read_text().strip())
phase, *command = sys.argv[1:]
started = time.time()
print(json.dumps({'phase': phase, 'command': command, 'started': started}), flush=True)
with (directory / (phase + '.stdout.log')).open('wb') as out, (directory / (phase + '.stderr.log')).open('wb') as err:
    result = subprocess.run(command, stdout=out, stderr=err)
receipt = {'phase': phase, 'command': command, 'started': started, 'ended': time.time(), 'exitCode': result.returncode}
(directory / (phase + '.receipt.json')).write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt), flush=True)
sys.exit(result.returncode)
