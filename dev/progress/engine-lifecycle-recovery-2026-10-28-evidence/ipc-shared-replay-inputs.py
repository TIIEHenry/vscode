#!/usr/bin/env python3
"""Verify/extract frozen S1 inputs. Preparation only: never starts Node or writes out."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile

here = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo', type=Path, required=True)
parser.add_argument('--scratch', type=Path, required=True)
args = parser.parse_args()
repo = args.repo.resolve()
scratch = args.scratch.resolve()
assert repo.name == 'C' and repo == args.repo.absolute(), 'Use a real private worktree named C.'
assert str(scratch).startswith('/sdd/tmp/') and not scratch.exists(), 'Use a new named private /sdd/tmp scratch.'
archive = here / 'ipc-shared-runtime-artifacts.tar.gz'
inventory = json.loads((here / 'ipc-shared-artifact-inventory.json').read_text())
digest = lambda data: hashlib.sha256(data).hexdigest()
assert digest(archive.read_bytes()) == inventory['archiveSha256']
scratch.mkdir(parents=True)
raw = scratch / 'raw'
with tarfile.open(archive, 'r:gz') as bundle:
    members = bundle.getmembers()
    assert len(members) == len(inventory['members'])
    assert {member.name for member in members} == set(inventory['members'])
    for member in members:
        name = Path(member.name)
        assert member.isfile() and not name.is_absolute() and '..' not in name.parts
        data = bundle.extractfile(member).read()
        assert digest(data) == inventory['members'][member.name]['sha256']
        output = raw / name
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open('xb') as stream:
            stream.write(data)
replay = json.loads((raw / 'replay-manifest.json').read_text())
manifest = replay['finalManifest']
for source, expected in manifest['sourceSha256'].items():
    assert digest((repo / source).read_bytes()) == expected, source
for source, expected in replay['controlSha256'].items():
    assert digest((repo / source).read_bytes()) == expected, source
manifest['sourceSha256'].update(replay['controlSha256'])
manifest['repo'] = str(repo)
manifest['scratch'] = str(scratch)
manifest['frozenHead'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
old_scratch = Path(replay['originalScratch'])
for entries in manifest['phases'].values():
    for entry in entries:
        entry['snapshot'] = str(raw / 'runs/a4' / Path(entry['snapshot']).relative_to(old_scratch))
        suffix = entry['source'][4:]
        if suffix.endswith('.ts'):
            suffix = suffix[:-3] + '.js'
        entry['out'] = str(repo / 'out' / suffix)
        data = Path(entry['snapshot']).read_bytes()
        assert digest(data) == entry['sha256']
        if entry['role'] == 'raw-2f':
            original = subprocess.check_output(['git', 'show', manifest['baseline'] + ':' + entry['source']], cwd=repo)
            assert original == data, entry['source']
manifest['notes'].append('Replay changes only local paths/current frozen HEAD and adds exact control-input guards; original commands/results remain under raw/runs.')
with (scratch / 'manifest.json').open('x') as stream:
    json.dump(manifest, stream, indent=2)
for name in ['s1-runner.py', 's1-transpile.mjs', 's1-harness-tripwire.mjs']:
    with (scratch / name).open('xb') as stream:
        stream.write((raw / 'tools/final' / name).read_bytes())
summary = {'preparedOnly': True, 'nodeStarted': False, 'outUpdated': False,
           'scratch': str(scratch), 'oldEntries': len(manifest['phases']['old']),
           'newReplacements': len(manifest['phases']['new']), 'archiveMembersVerified': len(inventory['members']),
           'phases': ['old', 'new', 'quality'], 'sourceAndControlHashesVerified': len(manifest['sourceSha256'])}
with (scratch / 'replay-preparation-summary.json').open('x') as stream:
    json.dump(summary, stream, indent=2)
print(json.dumps(summary))
