from pathlib import Path
import subprocess
import runpy
import sys

root = Path.cwd().resolve()
baseline = "f33d16fbc5841119f5baa7ff2788060d39b8bb4f"
paths = [
    "dev/plans/conversation-visible-lease-recovery.md",
    "dev/progress/sources-accept-post-read-authorization-checkpoint.md",
    "dev/parallel/active/sources-accept-post-read-authorization.md",
    "dev/progress/status.md",
]
old = {
    str((root / path).resolve()): subprocess.check_output(
        ["git", "show", f"{baseline}:{path}"], cwd=root
    ).decode("utf-8")
    for path in paths
}
original_read_text = Path.read_text

def read_baseline(self, *args, **kwargs):
    key = str(self.resolve())
    return old[key] if key in old else original_read_text(self, *args, **kwargs)

# Only the four changed Markdown contents are overlaid in memory.
# The filesystem inventory, exists/is_file checks, link targets, and generator
# inputs outside these paths are the exact same current E checkout.
Path.read_text = read_baseline
sys.argv = ["scripts/check-docs-health.py", "--format", "json"]
runpy.run_path(str(root / "scripts/check-docs-health.py"), run_name="__main__")
