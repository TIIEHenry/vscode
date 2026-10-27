#!/usr/bin/env python3
"""Pure-Python S2 evidence verification, safe extraction and input preparation.

Never imports subprocess, starts Node, changes Git, acquires locks, writes an out
tree, or grants runtime permission. Historical raw manifests remain unchanged.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    return json.loads(path.read_text())


def relative(value):
    path = PurePosixPath(value)
    if not value or value == '.' or '\\' in value or path.is_absolute() or '..' in path.parts or str(path) != value:
        raise ValueError('Unsafe or noncanonical relative path: ' + value)
    return path


def target(root, value):
    path = root.joinpath(*relative(value).parts)
    if not path.is_relative_to(root):
        raise ValueError('Path escaped destination')
    return path


def fresh_destination(value):
    path = Path(value).absolute()
    # Check both spelling and resolved targets before any mkdir/open. A worktree
    # has a .git file, while a normal checkout has a .git directory. Either
    # marker, including a symlinked marker, forbids all descendant writes.
    resolved = path.resolve(strict=False)
    for parent in [path.parent, resolved.parent]:
        for ancestor in [parent, *parent.parents]:
            marker = ancestor / '.git'
            if marker.exists() or marker.is_symlink():
                raise ValueError('Destination is inside a Git checkout/worktree')
    # Do not follow a preexisting destination or symlinked parent.
    if path.exists() or path.is_symlink() or path.parent.resolve() != path.parent:
        raise ValueError('Destination must be new under an existing real parent')
    if not path.parent.is_dir():
        raise ValueError('Destination parent must already exist')
    # Preparation must not target a repository output tree or Git internals.
    if {'out', '.git', 'node_modules'} & set(path.parts):
        raise ValueError('Repository outputs/dependencies/Git are forbidden destinations')
    return path


def verify_bundle(root):
    root = Path(root).resolve(strict=True)
    inventory_path = root / 'payload-inventory.json'
    inventory = read_json(inventory_path)
    expected = {row['path']: row for row in inventory['files']}
    if len(expected) != len(inventory['files']):
        raise ValueError('Duplicate payload member')
    actual = set()
    for path in root.rglob('*'):
        if path.is_symlink():
            raise ValueError('Symlinks forbidden in bundle')
        if path.is_file():
            name = path.relative_to(root).as_posix()
            actual.add(name)
            if name == 'payload-inventory.json':
                continue
            row = expected.get(name)
            if row is None:
                raise ValueError('Unlisted bundle member: ' + name)
            data = path.read_bytes()
            if len(data) != row['bytes'] or digest(data) != row['sha256']:
                raise ValueError('Payload identity mismatch: ' + name)
    if actual != set(expected) | {'payload-inventory.json'}:
        raise ValueError('Bundle member set mismatch')
    mapping = read_json(root / 'snapshot-map.json')
    logical = set()
    for row in mapping['snapshots']:
        name = row['attempt'] + '/' + row['relativePath']
        if name in logical:
            raise ValueError('Duplicate virtual snapshot: ' + name)
        logical.add(name)
        relative(row['relativePath'])
        obj = target(root, row['objectPath'])
        data = obj.read_bytes()
        if len(data) != row['bytes'] or digest(data) != row['sha256']:
            raise ValueError('Snapshot object mismatch: ' + name)
        if obj.name != row['sha256']:
            raise ValueError('Object name is not its content identity')
    report = {
        'operation': 'verify', 'readOnly': True, 'runtimeAuthorized': False,
        'payloadFilesVerified': len(expected),
        'inventorySha256': digest(inventory_path.read_bytes()),
        'virtualSnapshotsVerified': len(logical),
        'inputFileCount': mapping['originalFileCount'],
        'inputBytes': mapping['originalBytes'],
        'NodeStarted': False, 'outWritten': False, 'locksAcquired': False,
        'GitUsed': False,
    }
    return root, mapping, report


def extract_archive(archive, expected_sha256, destination):
    archive = Path(archive).resolve(strict=True)
    if digest(archive.read_bytes()) != expected_sha256:
        raise ValueError('Archive digest differs from supplied identity')
    destination = fresh_destination(destination)
    with tarfile.open(archive, 'r:gz') as stream:
        members = stream.getmembers()
        names = set()
        for member in members:
            relative(member.name)
            if member.name in names or not member.isfile():
                raise ValueError('Duplicate or nonregular archive member: ' + member.name)
            names.add(member.name)
        destination.mkdir(mode=0o700)
        for member in members:
            path = target(destination, member.name)
            path.parent.mkdir(parents=True, exist_ok=True)
            source = stream.extractfile(member)
            if source is None:
                raise ValueError('No data for ' + member.name)
            data = source.read()
            if len(data) != member.size:
                raise ValueError('Truncated archive member: ' + member.name)
            with path.open('xb') as output:
                output.write(data)
            path.chmod(0o600)
    _, _, report = verify_bundle(destination)
    report.update(operation='extract-and-verify', readOnly=False,
                  verificationReadOnly=True, writesOnlyNewPrivateDestination=True,
                  archiveSha256=expected_sha256,
                  extractedFiles=len(names), destination=str(destination))
    return report


def prepare_inputs(bundle, destination, selected):
    root, mapping, verification = verify_bundle(bundle)
    destination = fresh_destination(destination)
    available = {row['id'] for row in mapping['attempts']}
    selected = available if selected == ['all'] else set(selected)
    if not selected or not selected <= available:
        raise ValueError('Unknown attempt selection')
    destination.mkdir(mode=0o700)
    index = {(row['attempt'], row['originalAbsolutePath']): row
             for row in mapping['snapshots']}
    restored = 0
    for row in mapping['snapshots']:
        if row['attempt'] not in selected:
            continue
        output = target(destination, row['attempt'] + '/' + row['relativePath'])
        output.parent.mkdir(parents=True, exist_ok=True)
        data = target(root, row['objectPath']).read_bytes()
        with output.open('xb') as stream:
            stream.write(data)
        output.chmod(0o600)
        restored += 1
    prepared = []
    for attempt in sorted(selected):
        raw_path = root / 'attempts' / attempt / 'source-frozen-manifest.json'
        raw_data = raw_path.read_bytes()
        manifest = json.loads(raw_data)
        manifest['runtimeAuthorized'] = False
        manifest['preparationOnly'] = True
        manifest['historicalAuthorizationClosed'] = True
        manifest['runtimePermissionNotice'] = (
            'No execution authorization. Prepare-only relocation does not provide '
            'dependencies, an output tree, process capacity, locks or a lane token.')
        manifest['historicalRawManifest'] = {
            'bundlePath': raw_path.relative_to(root).as_posix(),
            'sha256': digest(raw_data),
        }
        manifest['scratch'] = str(destination / attempt)
        for rows in [*manifest['phases'].values(), manifest['completeNew']]:
            for row in rows:
                original = row['snapshot']
                mapped = index.get((attempt, original))
                if mapped is None or mapped['sha256'] != row['sha256']:
                    raise ValueError('Manifest snapshot lacks exact object mapping')
                row['snapshot'] = str(target(destination, attempt + '/' + mapped['relativePath']))
        current_sources = {row['source']: row for row in manifest['completeNew']}
        for row in manifest.get('sourceReadInputs', []):
            row['historicalActualPath'] = row['actualPath']
            row['actualPath'] = current_sources[row['source']]['snapshot']
            row['preparationOnlyFrozenSourceScan'] = True
        output = destination / attempt / 'prepared-source-frozen-manifest.json'
        with output.open('x') as stream:
            json.dump(manifest, stream, indent=2)
            stream.write('\n')
        prepared.append({'attempt': attempt, 'manifest': str(output),
                         'sha256': digest(output.read_bytes()),
                         'runtimeAuthorized': False})
    # Re-read every restored snapshot and every derivative manifest; never invoke
    # the historical runners, which require separate explicit authorization.
    for row in mapping['snapshots']:
        if row['attempt'] in selected:
            data = target(destination, row['attempt'] + '/' + row['relativePath']).read_bytes()
            if digest(data) != row['sha256'] or len(data) != row['bytes']:
                raise ValueError('Restored snapshot differs from object')
    for row in prepared:
        manifest = read_json(Path(row['manifest']))
        if manifest['runtimeAuthorized'] is not False or manifest['preparationOnly'] is not True:
            raise ValueError('Prepared manifest unexpectedly permits runtime')
    return {
        'operation': 'prepare-inputs', 'runtimeAuthorized': False,
        'bundleVerification': verification, 'attempts': prepared,
        'snapshotsRestoredAndVerified': restored,
        'onlySnapshotAndDerivativeManifestWrites': True,
        'historicalRawManifestsUnchanged': True, 'NodeStarted': False,
        'outWritten': False, 'locksAcquired': False, 'GitUsed': False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='operation', required=True)
    command = sub.add_parser('verify')
    command.add_argument('--bundle', required=True)
    command = sub.add_parser('extract')
    command.add_argument('--archive', required=True)
    command.add_argument('--expected-sha256', required=True)
    command.add_argument('--destination', required=True)
    command = sub.add_parser('prepare')
    command.add_argument('--bundle', required=True)
    command.add_argument('--destination', required=True)
    command.add_argument('--attempt', nargs='+', default=['all'])
    args = parser.parse_args()
    if args.operation == 'verify':
        report = verify_bundle(args.bundle)[2]
    elif args.operation == 'extract':
        report = extract_archive(args.archive, args.expected_sha256, args.destination)
    else:
        report = prepare_inputs(args.bundle, args.destination, args.attempt)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
