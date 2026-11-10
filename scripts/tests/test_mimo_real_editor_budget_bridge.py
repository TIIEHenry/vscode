#!/usr/bin/env python3
"""Bridge the real Node24 budget controller to its Python parent on Linux.

Only empty actions run. There is no Electron, Java, engine RPC, provider request,
or product acceptance evidence here. Put Node24 on PATH before running unittest.
"""

import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile
import time
import unittest
import uuid


REPO_ROOT = Path(__file__).resolve().parents[2]
DRIVER = REPO_ROOT / "test/scenario/scripts/run-mimo-real-editor-matrix.py"
SPEC = importlib.util.spec_from_file_location("mimo_real_editor_budget_bridge_driver", DRIVER)
matrix = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(matrix)


NODE_CHILD = r'''
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const helper = require(path.join(input.repo, 'test/scenario/scenarios/universe-agent-real-editor-oracle.cjs'));
assert.match(process.versions.node, /^24\./u, 'This offline bridge requires the real Node24 runtime');
const config = helper.validateBudgetIdentity(process.env, input.oracle, input.root);
// Use actual process.hrtime.bigint, timers, publication and cleanup claiming.
// No clock, timer, publish, identity or controller hooks are substituted.
const controller = helper.createBudgetController(input.oracle, config);
const ackFile = path.join(input.root, 'bridge-ack.json');
const finalFile = path.join(input.root, 'bridge-node-summary.json');
function writeJson(file, value) {
 const temporary = `${file}.${process.pid}.tmp`;
 fs.writeFileSync(temporary, JSON.stringify(value), {mode:0o600});
 fs.renameSync(temporary, file);
}
async function parentObserved() {
 if (input.mode === 'success-fast') return;
 const progress = JSON.parse(fs.readFileSync(config.progressFile, 'utf8'));
 const deadline = process.hrtime.bigint() + 5000000000n;
 for (;;) {
  if (fs.existsSync(ackFile)) {
   const ack = JSON.parse(fs.readFileSync(ackFile, 'utf8'));
   if (ack.nonce === input.oracle.nonce && ack.seq === progress.seq) return;
  }
  assert.ok(process.hrtime.bigint() < deadline, 'Python parent did not validate the actual Node progress');
  await new Promise(resolve => setTimeout(resolve, 5));
 }
}
async function holdCorruptProgress(kind) {
 const value = JSON.parse(fs.readFileSync(config.progressFile, 'utf8'));
 if (kind === 'missing-history') delete value.budgetStages;
 else if (kind === 'missing-episode') value.budgetStages.splice(2, 1);
 else if (kind === 'reordered-episodes') [value.budgetStages[1], value.budgetStages[2]] = [value.budgetStages[2], value.budgetStages[1]];
 else if (kind === 'old-nonce') value.nonce = `old-${input.oracle.nonce}`;
 else throw new Error('Unknown offline corruption control');
 writeJson(config.progressFile, value);
 // The real Python validator must reject this file and reap our owned group.
 // A finite guard prevents a broken test from leaving an unbounded child.
 await new Promise(resolve => setTimeout(resolve, 5000));
 throw new Error('Corrupt progress survived parent validation');
}
(async () => {
 if (input.mode === 'old-nonce') return holdCorruptProgress(input.mode);
 await parentObserved();
 await controller.operation('offline-setup-noop', remaining => assert.ok(remaining > 0 && remaining <= 60000));
 controller.next();
 await parentObserved();
 for (const label of config.budget.episodeLabels) {
  controller.expect('episode', label);
  await controller.operation('offline-episode-noop', remaining => assert.ok(remaining > 0 && remaining <= 600000));
  controller.next();
  if (controller.current().phase !== 'finalization') await parentObserved();
 }
 if (config.budget.historyMs) {
  controller.expect('history');
  await controller.operation('offline-history-noop', remaining => assert.ok(remaining > 0 && remaining <= 120000));
  controller.next();
 }
 controller.expect('finalization');
 if (['missing-history', 'missing-episode', 'reordered-episodes'].includes(input.mode)) return holdCorruptProgress(input.mode);
 await parentObserved();
 if (input.mode === 'parent-cleanup') {
  // The parent claimed the shared file before acknowledging finalization.
  // External cleanup forbids success and all subsequent business operations.
  await assert.rejects(controller.operation('offline-forbidden-next-business', () => { throw new Error('business callback ran'); }), /cleanup-already-started/u);
  controller.beginCleanup(false);
 } else {
  await controller.operation('offline-finalization-noop', remaining => assert.ok(remaining > 0 && remaining <= 60000));
  controller.beginCleanup(true);
 }
 await parentObserved();
 await controller.operation('offline-tap-restore-noop', remaining => assert.ok(remaining > 0 && remaining <= 60000));
 controller.finishCleanup();
 await parentObserved();
 const cleanup = JSON.parse(fs.readFileSync(config.cleanupFile, 'utf8'));
 writeJson(finalFile, {nodeVersion:process.versions.node, nodeNowMonoNs:String(process.hrtime.bigint()),
  status:input.mode === 'parent-cleanup' ? 'cancelled-offline' : 'completed-offline',
  ...controller.snapshot(), cleanup});
})().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
'''


class ObservedBudgetControl(matrix.CaseBudgetControl):
    """Add an acknowledgement after the production parent validator accepts data."""

    def __init__(self, root, identity, budget, parent_claim=False):
        super().__init__(root, identity, budget)  # Real Linux monotonic clock.
        self.observed = []
        self.parent_claim = parent_claim
        self.parent_claim_value = None

    def poll(self):
        stopped = super().poll()
        # poll deliberately prioritizes an existing cleanup claim. Still call
        # its real read_progress validator to acknowledge the final Node data.
        progress = self.read_progress()
        if progress is not None:
            if not self.observed or self.observed[-1]["seq"] != progress["seq"]:
                self.observed.append(json.loads(json.dumps(progress)))
            if self.parent_claim and progress["phase"] == "finalization" and self.parent_claim_value is None:
                self.parent_claim_value = self.ensure_cleanup()
            temporary = self.root / "bridge-ack.json.tmp"
            matrix.write_private_json(temporary, {"nonce": self.identity["nonce"], "seq": progress["seq"]})
            os.replace(temporary, self.root / "bridge-ack.json")
        return stopped


class MimoRealEditorBudgetBridgeTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="mimo-budget-bridge-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.node = shutil.which("node")
        self.assertIsNotNone(self.node, "Put Node24 on PATH for the offline budget bridge")

    def run_bridge(self, case_id, mode="success"):
        case_root = self.root / f"{case_id}-{mode}"
        case_root.mkdir(mode=0o700)
        identity = {"campaignId": uuid.uuid4().hex, "cellId": "offline-budget-bridge", "caseId": case_id, "nonce": uuid.uuid4().hex}
        control = ObservedBudgetControl(case_root, identity, matrix.case_budget(case_id), parent_claim=mode == "parent-cleanup")
        oracle = {"schemaVersion": 1, **identity, "budget": control.budget, "budgetSha256": control.budget_sha, "clock": control.clock}
        script = case_root / "bridge-child.cjs"
        script.write_text(NODE_CHILD)
        os.chmod(script, 0o600)
        input_file = case_root / "bridge-input.json"
        matrix.write_private_json(input_file, {"repo": str(REPO_ROOT), "root": str(case_root), "oracle": oracle, "mode": mode})
        env = {**os.environ, "UA_REAL_EDITOR_BUDGET_SHA256": control.budget_sha,
               "UA_REAL_EDITOR_BOOT_ID": control.clock["bootId"],
               "UA_REAL_EDITOR_SETUP_STARTED_MONO_NS": control.clock["setupStartedMonoNs"],
               "UA_REAL_EDITOR_SETUP_DEADLINE_MONO_NS": control.clock["setupDeadlineMonoNs"],
               "UA_REAL_EDITOR_BUDGET_PROGRESS_FILE": str(control.progress_file),
               "UA_REAL_EDITOR_CLEANUP_BUDGET_FILE": str(control.cleanup_file)}
        cleanup_state = {"stopped": True}
        log = case_root / "bridge.log"
        try:
            code, timed_out = matrix.run_owned([self.node, str(script), str(input_file)], env, log,
                                             control.budget["watchdogMs"] / 1000, cleanup_state, budget_control=control)
        except (OSError, ValueError):
            self.assertTrue(cleanup_state["stopped"], "The rejected Node group must be reaped")
            raise
        self.assertTrue(cleanup_state["stopped"], "The actual driver must reap its owned Node group")
        self.assertEqual(code, 0, log.read_text())
        self.assertFalse(timed_out, log.read_text())
        self.assertFalse(control.protocol_error)
        summary_file = case_root / "bridge-node-summary.json"
        self.assertTrue(summary_file.is_file(), log.read_text())
        summary = json.loads(summary_file.read_text())
        self.assertRegex(summary["nodeVersion"], r"^24\.")
        self.assertEqual(summary["budget"], control.budget)
        self.assertEqual(summary["budgetSha256"], control.budget_sha)
        self.assertEqual(summary["clock"], control.clock)
        self.assertGreaterEqual(int(summary["nodeNowMonoNs"]), int(control.clock["setupStartedMonoNs"]))
        self.assertLessEqual(int(summary["nodeNowMonoNs"]), time.monotonic_ns())
        # This is actual CJS output, checked by the same Python validator used
        # by the production driver rather than a reconstructed phase fixture.
        business = matrix.validate_budget_stages(control.budget, control.clock, summary["budgetStages"], time.monotonic_ns(), mode in ("success", "success-fast"))
        self.assertEqual(summary["expectedEpisodeCount"], control.budget["episodeCount"])
        self.assertEqual(summary["startedEpisodeCount"], control.budget["episodeCount"])
        self.assertEqual(summary["completedEpisodeCount"], control.budget["episodeCount"])
        self.assertEqual(len([stage for stage in business if stage["phase"] == "episode"]), control.budget["episodeCount"])
        self.assertEqual(control.read_progress()["phase"], "cleanup")
        before = control.cleanup_file.read_bytes()
        self.assertEqual(control.ensure_cleanup(), summary["cleanup"])
        self.assertEqual(control.cleanup_file.read_bytes(), before)
        self.assertEqual(control.read_cleanup(), summary["cleanup"])
        return control, summary

    def test_complete_ordinary_U02_and_U07_use_actual_node_python_budget_protocol(self):
        for case_id, expected in (("U01", 1), ("U02", 2), ("U07", 7)):
            with self.subTest(case_id=case_id):
                control, summary = self.run_bridge(case_id)
                self.assertEqual(summary["status"], "completed-offline")
                self.assertEqual(summary["completedEpisodeCount"], expected)
                self.assertEqual([row["episodeLabel"] for row in control.observed if row["phase"] == "episode"], control.budget["episodeLabels"])
                self.assertTrue(any(row["phase"] == "setup" for row in control.observed))
                self.assertTrue(any(row["phase"] == "finalization" for row in control.observed))
                self.assertEqual(any(row["phase"] == "history" for row in control.observed), case_id == "U07")

    def test_python_first_cleanup_is_read_by_node_without_a_new_allowance(self):
        control, summary = self.run_bridge("U01", "parent-cleanup")
        self.assertEqual(summary["status"], "cancelled-offline")
        self.assertEqual(summary["cleanup"], control.parent_claim_value)
        self.assertEqual(summary["budgetStages"][-2]["status"], "failed")

    def test_fast_U07_retains_complete_history_when_parent_misses_intermediate_polls(self):
        # No acknowledgement waits are used in this child. The real parent's
        # normal polling interval may observe only a late full-history snapshot.
        control, summary = self.run_bridge("U07", "success-fast")
        self.assertEqual(summary["completedEpisodeCount"], 7)
        self.assertEqual([stage["phase"] for stage in summary["budgetStages"]],
                         ["setup", *(["episode"] * 7), "history", "finalization", "cleanup"])
        latest = control.read_progress()
        observed_sequences = {value["seq"] for value in control.observed}
        self.assertTrue(set(range(1, latest["seq"] + 1)) - observed_sequences,
                        "The fast bridge must actually miss an intermediate publication")

    def test_corrupt_actual_node_progress_cannot_become_a_pass(self):
        for mode in ("missing-history", "missing-episode", "reordered-episodes", "old-nonce"):
            with self.subTest(mode=mode):
                with self.assertRaises(ValueError):
                    self.run_bridge("U07", mode)
                root = self.root / f"U07-{mode}"
                self.assertFalse((root / "bridge-node-summary.json").exists())
                self.assertTrue((root / "cleanup-budget.json").is_file())


if __name__ == "__main__":
    unittest.main()
