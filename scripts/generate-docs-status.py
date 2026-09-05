#!/usr/bin/env python3
"""Write or verify generated documentation status columns."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from docs_status import REPO_ROOT, apply_generated_status, compare_generated_columns


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate or verify docs status columns.")
    parser.add_argument("--check", action="store_true", help="Compare only; exit non-zero on drift.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing files.")
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT, help="Repository root path.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.repo_root.resolve()

    if args.check or args.dry_run:
        findings = compare_generated_columns(root)
        if findings:
            for finding in findings:
                print(f"{finding.path}: {finding.message}", file=sys.stderr)
            return 1
        if args.dry_run:
            changes = apply_generated_status(root, dry_run=True)
            for change in changes:
                print(change)
        print("generated status: OK")
        return 0

    changes = apply_generated_status(root, dry_run=False)
    post_findings = compare_generated_columns(root)
    if post_findings:
        for finding in post_findings:
            print(f"{finding.path}: {finding.message}", file=sys.stderr)
        return 1
    for change in changes:
        print(change)
    if not changes:
        print("generated status: already up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main())
