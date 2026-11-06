#!/usr/bin/env python3
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See License.txt in the project root for license information.
"""Fail when a `*.test.ts` under src/vs sits outside a `test` directory.

The local Electron, Node and unit-custom runners collect `**/test/**/*.test.js`.
A test that lives beside its source never reaches those local gates.

Usage: python3 scripts/check-test-placement.py [--root <repo>]
"""

import argparse
import os
import sys


def find_misplaced(root):
    src = os.path.join(root, 'src', 'vs')
    misplaced = []
    for dirpath, dirnames, filenames in os.walk(src):
        dirnames[:] = [d for d in dirnames if d != 'node_modules']
        rel_dir = os.path.relpath(dirpath, src).split(os.sep)
        if 'test' in rel_dir:
            continue
        for name in filenames:
            if name.endswith('.test.ts'):
                misplaced.append(os.path.relpath(os.path.join(dirpath, name), root))
    return sorted(misplaced)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--root', default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    args = parser.parse_args()
    misplaced = find_misplaced(args.root)
    if misplaced:
        print('error: %d test file(s) outside a `test` directory:' % len(misplaced), file=sys.stderr)
        for path in misplaced:
            print('  ' + path, file=sys.stderr)
        return 1
    print('ok: every src/vs *.test.ts is under a `test` directory')
    return 0


if __name__ == '__main__':
    sys.exit(main())
