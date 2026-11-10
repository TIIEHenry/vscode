#!/usr/bin/env python3
"""Fail-closed driver/configuration checks; no model, engine, Java, or UI required."""

import importlib.util
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener


REPO_ROOT = Path(__file__).resolve().parents[2]
DRIVER = REPO_ROOT / "test/scenario/scripts/run-mimo-real-editor-matrix.py"
SPEC = importlib.util.spec_from_file_location("mimo_real_editor_matrix", DRIVER)
matrix = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(matrix)


class MimoRealEditorMatrixTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="mimo-ui-driver-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.provenance_index = 0

    def result_fixture(self, case_id="U01"):
        cell = matrix.expected_cells()[0]
        oracle = {"schemaVersion": 1, "campaignId": "campaign", "cellId": cell["cellId"],
                  "caseId": case_id, "nonce": "nonce", "model": cell["model"],
                  "protocol": cell["protocol"], "modelProfile": cell["modelProfile"],
                  "provenanceModules": self.module_seal()}
        budget = matrix.case_budget(case_id)
        initial = time.monotonic_ns() - 100_000_000
        control = matrix.CaseBudgetControl(self.root, oracle, budget, now=lambda: initial)
        oracle.update(budget=budget, budgetSha256=control.budget_sha, clock=control.clock)
        stages = self.budget_stages(budget, control.clock, completed=True)
        cleanup_start = int(stages[-1]["endedMonoNs"])
        control.now = lambda: cleanup_start
        (self.root / "cleanup-budget.json").unlink(missing_ok=True)
        claim = control.ensure_cleanup()
        stages.append({"phase": "cleanup", "episodeIndex": 0, "episodeLabel": None,
            "phaseStartedMonoNs": claim["cleanupStartedMonoNs"], "phaseDeadlineMonoNs": claim["cleanupDeadlineMonoNs"],
            "status": "completed", "endedMonoNs": str(cleanup_start + 1_000_000), "durationMs": 1, "timeoutOperation": None})
        evidence = {}
        for key in ("domFile", "eventFile", "oracleFile"):
            path = self.root / f"{key}.json"
            path.write_text('{"real": true}\n')
            evidence[key] = str(path)
        evidence["provenanceFile"] = str(self.provenance_fixture(oracle))
        result = {key: oracle[key] for key in ("schemaVersion", "campaignId", "cellId", "caseId", "nonce")}
        result.update(status="passed", actualModel=oracle["model"], actualProtocol=oracle["protocol"],
                      modelProfile=oracle["modelProfile"], evidence=evidence,
                      assertions=[{"id": name, "passed": True} for name in matrix.REQUIRED_ASSERTIONS[case_id]])
        result.update(budget=budget, budgetSha256=control.budget_sha, clock=control.clock, budgetStages=stages,
                      expectedEpisodeCount=budget["episodeCount"], startedEpisodeCount=budget["episodeCount"],
                      completedEpisodeCount=budget["episodeCount"])
        observations = [{"model": cell["model"], "protocol": cell["protocol"], "status": 200,
                         "responseModels": [cell["model"]], "responseModelStatus": "verified"}]
        return oracle, result, observations

    def module_seal(self):
        self.module_repo = self.root / "sealed-ide"
        for role, relative in matrix.PROVENANCE_MODULE_PATHS.items():
            path = self.module_repo / relative
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(f"// offline compiled module fixture: {role}\n")
        return matrix.provenance_module_identity(self.module_repo)

    def provenance_fixture(self, oracle, root=None):
        modules = []
        for sealed in oracle["provenanceModules"]:
            url = (self.module_repo / sealed["path"]).as_uri()
            if sealed["role"] != "mainActor":
                url = url.replace("file://", "vscode-file://vscode-app", 1)
            modules.append({**sealed, "url": url, "loaded": True})
        artifact = {"schemaVersion": 1, "kind": "ua-real-editor-dom-frame-provenance",
                    **{key: oracle[key] for key in ("campaignId", "cellId", "caseId", "nonce")},
                    "status": "available", "modules": modules,
                    "counts": {"mainFrames": 1, "rendererInputs": 1, "paints": 1, "matchedScopes": 1},
                    "frames": [{"bound": True}], "inputs": [{"valid": True}], "paints": [{"offline": True}],
                    "verifiedScopes": [{"offline": True}], "diagnostics": []}
        self.provenance_index += 1
        path = (root or self.root) / f"provenance-{self.provenance_index}.json"
        matrix.write_private_json(path, artifact)
        return path

    @staticmethod
    def budget_stages(budget, clock, completed=False):
        plan = [("setup", 0, None, budget["setupMs"])]
        plan += [("episode", index, label, budget["episodeMs"]) for index, label in enumerate(budget["episodeLabels"], 1)]
        if budget["historyMs"]:
            plan.append(("history", 0, None, budget["historyMs"]))
        plan.append(("finalization", 0, None, budget["finalizationMs"]))
        at = int(clock["setupStartedMonoNs"])
        stages = []
        for phase, index, label, allocation in plan if completed else plan[:1]:
            stages.append({"phase": phase, "episodeIndex": index, "episodeLabel": label,
                "phaseStartedMonoNs": str(at), "phaseDeadlineMonoNs": str(at + allocation * 1_000_000),
                "status": "completed" if completed else "active", "endedMonoNs": str(at + 1_000_000) if completed else None,
                "durationMs": 1 if completed else 0, "timeoutOperation": None})
            at += 1_000_000
        return stages

    def errors(self, oracle, result, observations):
        with mock.patch.object(matrix, "ROOT", self.module_repo):
            return matrix.verify_case_result(result, oracle, self.root, observations)

    def test_full_grid_is_six_cells_with_ten_required_cases_each(self):
        cells = matrix.expected_cells()
        self.assertEqual(len(cells), 6)
        self.assertEqual({cell["model"] for cell in cells}, set(matrix.MODELS.values()))
        self.assertEqual({cell["protocol"] for cell in cells}, set(matrix.PROTOCOLS))
        self.assertEqual(len({cell["cellId"] for cell in cells}), 6)
        self.assertTrue(all(tuple(cell["requiredCases"]) == matrix.CASES for cell in cells))
        self.assertTrue(all("dom-frame-provenance" in matrix.REQUIRED_ASSERTIONS[case] for case in matrix.CASES))
        self.assertEqual(matrix.TASK_TIMEOUT_MS, 600000)

    def test_complete_correlated_case_can_pass(self):
        self.assertEqual(self.errors(*self.result_fixture()), [])

    def test_empty_result_or_empty_assertions_cannot_pass(self):
        oracle, result, observations = self.result_fixture()
        self.assertIn("missing-or-invalid-scenario-result", self.errors(oracle, None, observations))
        result["assertions"] = []
        self.assertIn("assertions-empty-or-failed", self.errors(oracle, result, observations))

    def test_arbitrary_true_assertion_does_not_substitute_for_required_contract(self):
        oracle, result, observations = self.result_fixture()
        result["assertions"] = [{"id": "did-click-send", "passed": True}]
        self.assertIn("required-assertions-missing-or-duplicate", self.errors(oracle, result, observations))

    def test_route_requires_its_owned_terminal_assertion(self):
        oracle, result, observations = self.result_fixture("U08")
        result["assertions"] = [item for item in result["assertions"] if item["id"] != "route-owned-terminal"]
        self.assertIn("required-assertions-missing-or-duplicate", self.errors(oracle, result, observations))

    def test_wrong_model_protocol_profile_and_stale_attempt_fail(self):
        oracle, result, observations = self.result_fixture()
        result.update(actualModel="other", actualProtocol="openai-chat", modelProfile="daily", nonce="old")
        errors = self.errors(oracle, result, observations)
        for name in ("actualModel", "actualProtocol", "modelProfile", "nonce"):
            self.assertIn("result-identity-" + name, errors)

    def test_no_request_or_only_failed_provider_request_is_not_real_success(self):
        oracle, result, observations = self.result_fixture()
        self.assertIn("no-real-provider-request", self.errors(oracle, result, []))
        observations[0]["status"] = 401
        self.assertIn("no-successful-provider-response", self.errors(oracle, result, observations))

    def test_request_fallback_cannot_be_hidden_by_a_later_target_request(self):
        oracle, result, observations = self.result_fixture()
        observations.append({"model": "fallback", "protocol": oracle["protocol"], "status": 200})
        self.assertIn("provider-identity-mismatch", self.errors(oracle, result, observations))

    def test_requested_model_cannot_prove_the_actual_response_model(self):
        oracle, result, observations = self.result_fixture()
        observations[0].update(responseModels=[], responseModelStatus="unknown")
        self.assertIn("actual-response-model-unknown-or-unverified", self.errors(oracle, result, observations))
        observations[0].update(responseModels=[matrix.MODELS["pro"]], responseModelStatus="mismatch")
        self.assertIn("actual-response-model-mismatch-or-invalid", self.errors(oracle, result, observations))

    def test_missing_and_outside_case_evidence_fail_even_with_successful_dom_claim(self):
        oracle, result, observations = self.result_fixture()
        Path(result["evidence"]["eventFile"]).unlink()
        result["evidence"]["oracleFile"] = str(REPO_ROOT / "package.json")
        errors = self.errors(oracle, result, observations)
        self.assertIn("evidence-missing-eventFile", errors)
        self.assertIn("evidence-missing-oracleFile", errors)

    def test_old_three_file_pass_cannot_omit_dom_frame_provenance(self):
        oracle, result, observations = self.result_fixture()
        result["evidence"].pop("provenanceFile")
        result["assertions"] = [item for item in result["assertions"] if item["id"] != "dom-frame-provenance"]
        errors = self.errors(oracle, result, observations)
        self.assertIn("required-assertions-missing-or-duplicate", errors)
        self.assertIn("evidence-missing-or-invalid-provenanceFile", errors)
        self.assertEqual(matrix.provenance_diagnostic_status(result, errors), "unavailable")

    def test_provenance_file_must_be_private_nonempty_and_owned_by_this_case(self):
        oracle, result, observations = self.result_fixture()
        path = Path(result["evidence"]["provenanceFile"])
        original = path.read_text()
        for content in ("", "not JSON"):
            with self.subTest(content=content):
                path.write_text(content)
                self.assertIn("evidence-missing-or-invalid-provenanceFile", self.errors(oracle, result, observations))
        path.write_text(original)
        path.chmod(0o644)
        self.assertIn("evidence-missing-or-invalid-provenanceFile", self.errors(oracle, result, observations))
        path.chmod(0o600)
        alias = self.root / "provenance-alias.json"
        alias.symlink_to(path)
        result["evidence"]["provenanceFile"] = str(alias)
        self.assertIn("evidence-missing-or-invalid-provenanceFile", self.errors(oracle, result, observations))
        with tempfile.TemporaryDirectory(prefix="mimo-provenance-outside-") as outside:
            foreign = Path(outside) / "provenance.json"
            matrix.write_private_json(foreign, json.loads(original))
            result["evidence"]["provenanceFile"] = str(foreign)
            self.assertIn("evidence-missing-or-invalid-provenanceFile", self.errors(oracle, result, observations))
            outside_alias = Path(outside) / "alias-to-owned-case"
            outside_alias.symlink_to(self.root, target_is_directory=True)
            result["evidence"]["provenanceFile"] = str(outside_alias / path.name)
            self.assertIn("evidence-missing-or-invalid-provenanceFile", self.errors(oracle, result, observations))
        result["evidence"]["provenanceFile"] = "provenance.json"
        self.assertIn("evidence-missing-or-invalid-provenanceFile", self.errors(oracle, result, observations))
        result["evidence"]["provenanceFile"] = str(path)
        path.unlink()
        self.assertIn("evidence-missing-or-invalid-provenanceFile", self.errors(oracle, result, observations))

    def test_provenance_rejects_wrong_schema_and_stale_case_identity(self):
        oracle, result, observations = self.result_fixture()
        path = Path(result["evidence"]["provenanceFile"])
        original = json.loads(path.read_text())
        for bad in ([], {}, {**original, "schemaVersion": True}, {**original, "schemaVersion": 2}, {**original, "kind": "other-evidence"}):
            with self.subTest(value=bad):
                matrix.update_private_json(path, bad)
                self.assertIn("provenance-schema-invalid", self.errors(oracle, result, observations))
        for key in ("campaignId", "cellId", "caseId", "nonce"):
            with self.subTest(identity=key):
                matrix.update_private_json(path, {**original, key: "stale"})
                self.assertIn("provenance-identity-" + key, self.errors(oracle, result, observations))

    def test_provenance_requires_positive_real_callback_counts_and_records(self):
        oracle, result, observations = self.result_fixture()
        path = Path(result["evidence"]["provenanceFile"])
        original = json.loads(path.read_text())
        for name in ("mainFrames", "rendererInputs", "paints", "matchedScopes"):
            for count in (None, 0, -1, True, 1.0, "1", 2):
                with self.subTest(name=name, count=count):
                    value = json.loads(json.dumps(original))
                    value["counts"][name] = count
                    matrix.update_private_json(path, value)
                    self.assertIn("provenance-hits-invalid-" + name, self.errors(oracle, result, observations))
        for name, records in (("mainFrames", "frames"), ("rendererInputs", "inputs"), ("paints", "paints"), ("matchedScopes", "verifiedScopes")):
            for rows in (None, [], ["not-a-record"]):
                with self.subTest(name=name, rows=rows):
                    matrix.update_private_json(path, {**original, records: rows})
                    self.assertIn("provenance-hits-invalid-" + name, self.errors(oracle, result, observations))
        for name, records, marker in (("mainFrames", "frames", "bound"), ("rendererInputs", "inputs", "valid")):
            with self.subTest(unbound=name):
                matrix.update_private_json(path, {**original, records: [{marker: False}]})
                self.assertIn("provenance-hits-invalid-" + name, self.errors(oracle, result, observations))

    def test_provenance_retains_unbound_transitions_without_counting_them_as_hits(self):
        oracle, result, observations = self.result_fixture()
        path = Path(result["evidence"]["provenanceFile"])
        value = json.loads(path.read_text())
        value["frames"].insert(0, {"bound": False})
        value["inputs"].insert(0, {"valid": False})
        matrix.update_private_json(path, value)
        self.assertEqual(self.errors(oracle, result, observations), [])

    def test_provenance_requires_exact_loaded_module_roles_paths_urls_and_sealed_bytes(self):
        oracle, result, observations = self.result_fixture()
        path = Path(result["evidence"]["provenanceFile"])
        original = json.loads(path.read_text())
        for mutation in ("missing", "duplicate", "path", "hash", "unloaded", "remote-url", "foreign-url", "query", "fragment"):
            with self.subTest(mutation=mutation):
                value = json.loads(json.dumps(original))
                module = value["modules"][0]
                if mutation == "missing":
                    value["modules"].pop()
                elif mutation == "duplicate":
                    value["modules"][-1] = dict(module)
                elif mutation == "path":
                    module["path"] = matrix.PROVENANCE_MODULE_PATHS["lens"]
                elif mutation == "hash":
                    module["sha256"] = "0" * 64
                elif mutation == "unloaded":
                    module["loaded"] = False
                elif mutation == "remote-url":
                    module["url"] = "https://example.invalid/" + module["path"]
                elif mutation == "foreign-url":
                    module["url"] = (self.root / "other-copy" / module["path"]).as_uri()
                else:
                    module["url"] += "?replacement=1" if mutation == "query" else "#replacement"
                matrix.update_private_json(path, value)
                self.assertIn("provenance-module-seal-mismatch", self.errors(oracle, result, observations))
        matrix.update_private_json(path, original)
        (self.module_repo / original["modules"][0]["path"]).write_text("// changed after campaign seal\n")
        self.assertIn("provenance-module-seal-mismatch", self.errors(oracle, result, observations))

    def test_provenance_requires_a_campaign_module_seal_and_tracks_each_module_digest(self):
        oracle, result, observations = self.result_fixture()
        frozen = oracle.pop("provenanceModules")
        self.assertIn("provenance-module-seal-mismatch", self.errors(oracle, result, observations))
        for value in (None, frozen[:-1], [*frozen[:-1], frozen[0]]):
            with self.subTest(seal=value):
                with self.assertRaisesRegex(ValueError, "provenance module"):
                    matrix.provenance_module_seal(value)
        module = self.module_repo / frozen[-1]["path"]
        module.write_text("// changed compiled bytes\n")
        self.assertNotEqual(matrix.provenance_module_identity(self.module_repo), frozen)

    def test_thinking_na_cannot_replace_provenance_and_unavailable_is_not_a_pass(self):
        oracle, result, observations = self.result_fixture()
        result["thinking"] = {"status": "not-applicable"}
        path = Path(result["evidence"]["provenanceFile"])
        value = json.loads(path.read_text())
        matrix.update_private_json(path, {**value, "status": "unavailable"})
        errors = self.errors(oracle, result, observations)
        self.assertIn("provenance-unavailable", errors)
        self.assertEqual(matrix.provenance_diagnostic_status(result, errors), "unavailable")
        result.update(status="uncovered", failureCategory="dom-frame-provenance-unavailable")
        self.assertIn("scenario-not-passed", self.errors(oracle, result, observations))
        result["failureCategory"] = "dom-frame-provenance-invalid"
        self.assertEqual(matrix.provenance_diagnostic_status(result, errors), "invalid")
        self.assertEqual(matrix.provenance_diagnostic_status(None, ["missing-or-invalid-scenario-result"]), "unavailable")

    def test_skipped_status_and_false_assertion_are_failures(self):
        oracle, result, observations = self.result_fixture()
        result["status"] = "skipped"
        result["assertions"][0]["passed"] = False
        errors = self.errors(oracle, result, observations)
        self.assertIn("scenario-not-passed", errors)
        self.assertIn("assertions-empty-or-failed", errors)

    def test_environment_drops_credentials_model_filters_and_jvm_injection(self):
        env = matrix.clean_environment({"PATH": "/bin", "HOME": "/caller", "DISPLAY": ":1",
            "ANTHROPIC_API_KEY": "secret", "OPENAI_MODEL": "other", "UA_PROVIDER_CUSTOM_API_KEY": "secret",
            "MIMO_MATRIX_CELLS": "flash:chat", "VSCODE_APPDATA": "/daily", "VSCODE_PORTABLE": "/daily",
            "JAVA_TOOL_OPTIONS": "-Duser.home=/daily", "JDK_JAVA_OPTIONS": "-Xmx99G", "NODE_OPTIONS": "injected"})
        self.assertEqual(env, {"PATH": "/bin", "HOME": "/caller", "DISPLAY": ":1", "VSCODE_SKIP_PRELAUNCH": "1"})

    def test_profiles_pin_catalog_and_provider_state_to_same_model(self):
        for cell in matrix.expected_cells():
            case = self.root / cell["cellId"].replace(":", "-")
            matrix.seed_profile(case, cell, "private-test-token", "http://127.0.0.1:43210")
            config = json.loads((case / "agent-home/config.json").read_text())
            state = json.loads(config["provider:state"])
            model = json.loads((case / "agent-home/models.json").read_text())["models"][0]
            jvm = json.loads((case / "jvm-home/.universe-agent/config.json").read_text())
            self.assertEqual(config["modelId"], cell["modelProfile"])
            self.assertEqual(model["id"], cell["modelProfile"])
            self.assertEqual(state["modelProfiles"][0]["modelId"], cell["model"])
            self.assertEqual(jvm["defaultModel"], cell["model"])
            provider = matrix.PROVIDER_IDS[cell["protocol"]]
            self.assertEqual(jvm["providers"][provider]["protocol"], provider)
            self.assertEqual(jvm["providers"][provider]["id"], provider)
            self.assertEqual((case / "agent-home/config.json").stat().st_mode & 0o777, 0o600)

    def test_private_writes_never_overwrite_previous_attempt(self):
        path = self.root / "result.json"
        matrix.write_private_json(path, {"attempt": 1})
        with self.assertRaises(FileExistsError):
            matrix.write_private_json(path, {"attempt": 2})
        self.assertEqual(json.loads(path.read_text()), {"attempt": 1})

    def test_gateway_identity_refuses_embedded_credentials_and_query(self):
        for url in ("https://secret:token@example.com", "http://localhost:3425?key=secret", "file:///tmp/gateway"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                matrix.validate_gateway(url)
        self.assertEqual(matrix.validate_gateway("http://127.0.0.1:3425/v1/"), "http://127.0.0.1:3425")

    def test_wire_protocol_is_inferred_from_actual_api_path(self):
        self.assertEqual(matrix.request_protocol("/v1/messages"), "anthropic")
        self.assertEqual(matrix.request_protocol("/v1/chat/completions"), "openai-chat")
        self.assertEqual(matrix.request_protocol("/v1/responses"), "openai-response")
        self.assertIsNone(matrix.request_protocol("/v1/models"))

    def test_response_metadata_is_parsed_for_all_protocols_across_chunk_boundaries(self):
        target = matrix.MODELS["flash"]
        short = "mimo-v2.6-flash"
        for protocol, value in (("anthropic", {"type": "message_start", "message": {"model": target}}),
                                ("openai-chat", {"model": short, "choices": []}),
                                ("openai-response", {"type": "response.created", "response": {"model": short}})):
            with self.subTest(protocol=protocol):
                observer = matrix.ResponseModelObserver(target, protocol, "text/event-stream")
                raw = b"data: " + json.dumps(value).encode() + b"\n\ndata: [DONE]\n\n"
                for offset in range(0, len(raw), 7):
                    observer.consume(raw[offset:offset + 7])
                observer.consume(b"", final=True)
                self.assertEqual(observer.metadata()["responseModelStatus"], "verified")
                self.assertIn(observer.metadata()["responseModels"][0], matrix.RESPONSE_MODEL_ALIASES[target])

    def test_response_fallback_cannot_be_hidden_by_later_target_metadata(self):
        target = matrix.MODELS["flash"]
        observer = matrix.ResponseModelObserver(target, "openai-response", "text/event-stream")
        for model in ("mimo-v2.6-pro", target):
            observer.consume(b"data: " + json.dumps({"response": {"model": model}}).encode() + b"\n\n")
        self.assertEqual(observer.metadata()["responseModelStatus"], "mismatch")

    def test_missing_response_model_or_body_text_claim_is_not_proof(self):
        observer = matrix.ResponseModelObserver(matrix.MODELS["flash"], "openai-chat", "application/json")
        observer.consume(json.dumps({"choices": [{"message": {"content": '{"model":"mimo-v2.6-flash"}'}}]}).encode(), final=True)
        self.assertEqual(observer.metadata(), {"responseModels": [], "responseModelStatus": "unknown"})

    def test_relay_forwards_real_response_and_only_records_request_shape(self):
        target = matrix.MODELS["flash"]
        response_body = b"data: " + json.dumps({"model": target, "choices": [{"delta": {"content": "private-response-content"}}]}).encode() + b"\n\ndata: [DONE]\n\n"

        class Upstream(BaseHTTPRequestHandler):
            def log_message(self, *_args):
                pass

            def do_POST(self):
                self.rfile.read(int(self.headers["Content-Length"]))
                body = response_body
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        upstream = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
        thread = threading.Thread(target=upstream.serve_forever, daemon=True)
        thread.start()
        observations = []
        observation_file = self.root / "requests.json"
        try:
            with matrix.provider_relay(f"http://127.0.0.1:{upstream.server_port}", target,
                                       "openai-chat", observations, observation_file) as endpoint:
                request = Request(endpoint + "/v1/chat/completions", method="POST",
                    data=json.dumps({"model": target, "messages": [{"content": "private-prompt-content"}]}).encode(),
                    headers={"Authorization": "Bearer private-test-token", "Content-Type": "application/json"})
                with build_opener(ProxyHandler({})).open(request, timeout=3) as response:
                    self.assertEqual(response.read(), response_body)
            recorded = observation_file.read_text()
            self.assertEqual(observations[0]["model"], target)
            self.assertEqual(observations[0]["protocol"], "openai-chat")
            self.assertEqual(observations[0]["status"], 200)
            self.assertEqual(observations[0]["responseModelStatus"], "verified")
            for secret in ("private-test-token", "private-prompt-content", "private-response-content"):
                self.assertNotIn(secret, recorded)
        finally:
            upstream.shutdown()
            upstream.server_close()
            thread.join(timeout=3)

    def test_relay_rejects_fallback_without_forwarding(self):
        observations = []
        with matrix.provider_relay("http://127.0.0.1:1", matrix.MODELS["flash"], "anthropic",
                                   observations, self.root / "requests.json") as endpoint:
            request = Request(endpoint + "/v1/messages", method="POST",
                              data=json.dumps({"model": "fallback"}).encode())
            with self.assertRaises(HTTPError) as caught:
                build_opener(ProxyHandler({})).open(request, timeout=3)
            self.assertEqual(caught.exception.code, 409)
        self.assertEqual(observations[0]["rejected"], "model-or-protocol-mismatch")
        self.assertIsNone(observations[0]["status"])

    def test_runtime_snapshot_rejects_empty_output_and_symlinks(self):
        with self.assertRaises(ValueError):
            matrix.tree_digest(self.root)
        (self.root / "link").symlink_to(REPO_ROOT / "package.json")
        with self.assertRaises(ValueError):
            matrix.tree_digest(self.root)

    def test_electron_file_alias_seal_binds_path_raw_link_target_and_actual_bytes(self):
        runtime = self.root / "electron"
        runtime.mkdir()
        for name in ("code-oss", "other-code-oss"):
            (runtime / name).write_bytes(b"identical executable fixture")
        alias = runtime / "universe-agent-studio"
        alias.symlink_to("code-oss")
        with self.assertRaisesRegex(ValueError, "refuses symlinks"):
            matrix.tree_digest(runtime)
        sealed = matrix.tree_digest(runtime, allow_file_aliases=True)
        self.assertEqual(sealed["files"], 3)
        self.assertEqual(sealed["fileAliases"], [{"path": alias.name, "link": "code-oss", "target": "code-oss",
                                               "sha256": matrix.sha256_file(runtime / "code-oss")}])
        (runtime / "code-oss").write_bytes(b"changed executable fixture")
        self.assertNotEqual(matrix.tree_digest(runtime, allow_file_aliases=True)["sha256"], sealed["sha256"])
        (runtime / "code-oss").write_bytes(b"identical executable fixture")
        self.assertEqual(matrix.tree_digest(runtime, allow_file_aliases=True), sealed)
        for link in ("other-code-oss", "./code-oss"):
            alias.unlink()
            alias.symlink_to(link)
            changed = matrix.tree_digest(runtime, allow_file_aliases=True)
            self.assertNotEqual(changed["sha256"], sealed["sha256"])
            self.assertEqual(changed["fileAliases"][0]["link"], link)
            self.assertEqual(changed["fileAliases"][0]["target"], "other-code-oss" if link == "other-code-oss" else "code-oss")
        alias.unlink()
        alias.symlink_to("code-oss")
        alias.rename(runtime / "renamed-studio")
        self.assertNotEqual(matrix.tree_digest(runtime, allow_file_aliases=True)["sha256"], sealed["sha256"])

    def test_electron_file_alias_rejects_external_directory_dangling_cyclic_and_special_targets(self):
        outside = self.root / "outside-executable"
        outside.write_bytes(b"outside")
        for kind in ("external", "directory", "dangling", "cycle", "special"):
            with self.subTest(kind=kind):
                runtime = self.root / kind
                runtime.mkdir()
                (runtime / "regular-file").write_bytes(b"runtime")
                alias = runtime / "alias"
                if kind == "external":
                    alias.symlink_to(outside)
                elif kind == "directory":
                    (runtime / "directory").mkdir()
                    alias.symlink_to("directory", target_is_directory=True)
                elif kind == "dangling":
                    alias.symlink_to("missing")
                elif kind == "cycle":
                    alias.symlink_to("peer")
                    (runtime / "peer").symlink_to("alias")
                else:
                    os.mkfifo(runtime / "pipe")
                    alias.symlink_to("pipe")
                with self.assertRaisesRegex(ValueError, "regular file inside|dangling, cyclic"):
                    matrix.tree_digest(runtime, allow_file_aliases=True)

    def test_source_identity_opts_in_only_the_electron_runtime(self):
        repo = self.root / "repo"
        ordinary = (repo / "out", repo / "test/scenario/out", repo / "test/automation/out")
        electron = repo / ".build/electron"
        for directory in (*ordinary, electron):
            directory.mkdir(parents=True)
            (directory / "compiled-file").write_bytes(b"compiled fixture")
        for relative in matrix.PROVENANCE_MODULE_PATHS.values():
            path = repo / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"offline compiled provenance fixture")
        (electron / "studio-alias").symlink_to("compiled-file")
        def fake_git(_command, **kwargs):
            return "a" * 40 if kwargs.get("text") else b""
        with mock.patch.object(matrix.subprocess, "check_output", side_effect=fake_git):
            identity = matrix.source_identity(repo)
            self.assertEqual(identity["provenanceModules"], matrix.provenance_module_identity(repo))
            self.assertEqual(identity["electronRuntime"]["fileAliases"][0]["path"], "studio-alias")
            for key in ("clientOutput", "scenarioOutput", "automationOutput"):
                self.assertNotIn("fileAliases", identity[key])
            for directory in ordinary:
                with self.subTest(directory=directory.relative_to(repo).as_posix()):
                    alias = directory / "alias"
                    alias.symlink_to("compiled-file")
                    try:
                        with self.assertRaisesRegex(ValueError, "refuses symlinks"):
                            matrix.source_identity(repo)
                    finally:
                        alias.unlink()
    def package_fixture(self):
        package = self.root / "sealed-engine"
        package.mkdir()
        (package / "lib").mkdir()
        (package / "bin").mkdir()
        proto = self.root / "sealed-proto"
        proto.mkdir()
        (proto / "session_service.proto").write_text('syntax = "proto3"; message Session {}\n')
        names = ["grpc-api", "grpc-server", "core", "protocol", "tools"]
        jars = []
        libraries = []
        for index, name in enumerate(names):
            filename = name + ".jar"
            path = package / "lib" / filename
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("test-component.txt", name)
                if name == "grpc-api":
                    archive.writestr("session_service.proto", (proto / "session_service.proto").read_bytes())
            digest = matrix.sha256_file(path)
            libraries.append(digest + "  lib/" + filename)
            jars.append({"classpathIndex": index, "filename": filename, "sha256": digest,
                         "size": path.stat().st_size, "component": "project :" + name})
        (package / "lib.SHA256SUMS").write_text("\n".join(libraries) + "\n")
        (package / "classpath.txt").write_text("\n".join("lib/" + item["filename"] for item in jars) + "\n")
        source_sha = "c4fa" + "0" * 36
        record = {"source_sha": source_sha, "source_dirty": False, "runtime_project_paths": [":" + name for name in names], "jars": jars}
        (package / "runtime-artifacts.json").write_text(json.dumps(record))
        (package / "VERSION").write_text("source_sha=" + source_sha + "\nsource_dirty=false\nmain_class=universe.agentic.grpc.HeadlessServer\nlib_manifest=lib.SHA256SUMS\nlib_manifest_sha256=" + matrix.sha256_file(package / "lib.SHA256SUMS") + "\n")
        return package, proto, source_sha

    def test_package_identity_is_read_from_clean_provenance_and_actual_jars(self):
        package, proto, source_sha = self.package_fixture()
        value = matrix.package_provenance(package, source_sha, proto)
        self.assertEqual(value["sourceSha"], source_sha)
        self.assertFalse(value["sourceDirty"])
        self.assertEqual(value["embeddedProtoCount"], 1)

    def test_declared_sha_cannot_relabel_a_different_package(self):
        package, proto, _source_sha = self.package_fixture()
        with self.assertRaisesRegex(ValueError, "commit/clean"):
            matrix.package_provenance(package, "a" * 40, proto)

    def test_dirty_package_is_rejected(self):
        package, proto, source_sha = self.package_fixture()
        version = package / "VERSION"
        version.write_text(version.read_text().replace("source_dirty=false", "source_dirty=true"))
        with self.assertRaisesRegex(ValueError, "commit/clean"):
            matrix.package_provenance(package, source_sha, proto)

    def test_component_provenance_must_agree_with_package_version(self):
        package, proto, source_sha = self.package_fixture()
        record_file = package / "runtime-artifacts.json"
        record = json.loads(record_file.read_text())
        record["source_dirty"] = True
        record_file.write_text(json.dumps(record))
        with self.assertRaisesRegex(ValueError, "component record"):
            matrix.package_provenance(package, source_sha, proto)

    def test_jar_tamper_and_component_classpath_reordering_are_rejected(self):
        package, proto, source_sha = self.package_fixture()
        classpath = package / "classpath.txt"
        classpath.write_text("\n".join(reversed(classpath.read_text().splitlines())) + "\n")
        with self.assertRaisesRegex(ValueError, "classpath"):
            matrix.package_provenance(package, source_sha, proto)
        (package / "lib/core.jar").write_bytes(b"different library")
        with self.assertRaisesRegex(ValueError, "digest"):
            matrix.package_provenance(package, source_sha, proto)

    def test_unrelated_proto_tree_cannot_be_used_to_decode_actual_engine(self):
        package, proto, source_sha = self.package_fixture()
        (proto / "session_service.proto").write_text('syntax = "proto3"; message Different {}\n')
        with self.assertRaisesRegex(ValueError, "Protocol bytes"):
            matrix.package_provenance(package, source_sha, proto)

    @unittest.skipUnless(sys.platform == "linux", "Owned descendant verification uses Linux /proc")
    def test_normal_wrapper_exit_kills_stubborn_owned_child_before_returning(self):
        for detached in (False, True):
            with self.subTest(detached=detached):
                child_pid_file = self.root / f"child-{detached}.pid"
                child = "import os,signal,time,pathlib; signal.signal(signal.SIGTERM,signal.SIG_IGN); pathlib.Path(" + repr(str(child_pid_file)) + ").write_text(str(os.getpid())); time.sleep(60)"
                parent = "import subprocess,sys,time,pathlib; subprocess.Popen([sys.executable,'-c'," + repr(child) + "],start_new_session=" + str(detached) + "); p=pathlib.Path(" + repr(str(child_pid_file)) + ");\nwhile not p.exists(): time.sleep(.01)\n"
                with mock.patch.object(matrix, "PROCESS_STOP_GRACE_SECONDS", 0.2):
                    code, timed_out = matrix.run_owned([sys.executable, "-c", parent], dict(os.environ), self.root / f"owned-{detached}.log", 5)
                self.assertEqual((code, timed_out), (0, False))
                pid = int(child_pid_file.read_text())
                with self.assertRaises(ProcessLookupError):
                    os.kill(pid, 0)

    @unittest.skipUnless(sys.platform == "linux", "Owned descendant verification uses Linux /proc")
    def test_cleanup_does_not_signal_an_unrelated_process_group(self):
        unrelated = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"], start_new_session=True)
        try:
            code, timed_out = matrix.run_owned([sys.executable, "-c", "raise SystemExit(23)"], dict(os.environ), self.root / "owned.log", 5)
            self.assertEqual((code, timed_out), (23, False))
            self.assertIsNone(unrelated.poll())
        finally:
            unrelated.terminate()
            unrelated.wait(timeout=5)

    def signal_driver_fixture(self, signum, during_spawn=False):
        fixture_root = self.root / f"signal-{signum}-{during_spawn}"
        fixture_root.mkdir()
        script = r'''
import importlib.util,json,os,pathlib,signal,socket,subprocess,sys,time
base=pathlib.Path(@FIXTURE@)
spec=importlib.util.spec_from_file_location("signal_fixture_matrix",@DRIVER@)
matrix=importlib.util.module_from_spec(spec);spec.loader.exec_module(matrix)
matrix.PROCESS_STOP_GRACE_SECONDS=.2
matrix.PROCESS_KILL_GRACE_SECONDS=2
fixture_ide=base/"sealed-ide"
for role,relative in matrix.PROVENANCE_MODULE_PATHS.items():
    file=fixture_ide/relative;file.parent.mkdir(parents=True,exist_ok=True);file.write_text("// offline module "+role)
matrix.ROOT=fixture_ide
matrix.runtime_identity=lambda *args:{"ide":{"provenanceModules":matrix.provenance_module_identity(fixture_ide)}}
matrix.gateway_models=lambda *args:set(matrix.MODELS.values())
cells=[matrix.expected_cells()[0]]
matrix.expected_cells=lambda:cells
package=base/"package";package.mkdir()
engine=package/"engine";engine.write_text("not executed");engine.chmod(0o700)
proto=base/"proto";proto.mkdir()
os.environ["MAGPIE_API_KEY"]="private-fixture-token"
child_program="import json,os,pathlib,signal,sys,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); started=pathlib.Path('/proc/self/stat').read_text().rsplit(') ',1)[1].split()[19]; pathlib.Path(sys.argv[1]).write_text(json.dumps({'pid':os.getpid(),'started':started})); time.sleep(60)"
parent_program=f"""import json,os,pathlib,subprocess,sys,time
base=pathlib.Path({str(base)!r})
for detached in (False,True):
 subprocess.Popen([sys.executable,'-c',{child_program!r},str(base/('owned-'+str(detached)+'.json'))],start_new_session=detached)
deadline=time.monotonic()+5
while not all((base/('owned-'+str(item)+'.json')).exists() for item in (False,True)):
 if time.monotonic()>deadline:raise RuntimeError('owned children did not start')
 time.sleep(.01)
started=pathlib.Path('/proc/self/stat').read_text().rsplit(') ',1)[1].split()[19]
(base/'owned-ready.json').write_text(json.dumps([{{'pid':os.getpid(),'started':started}}]+[json.loads((base/('owned-'+str(item)+'.json')).read_text()) for item in (False,True)]))
time.sleep(60)
"""
original_popen=subprocess.Popen
unrelated=original_popen([sys.executable,"-c","import time;time.sleep(60)"],start_new_session=True)
prior={item:signal.getsignal(item) for item in (signal.SIGTERM,signal.SIGINT)}
if @DURING_SPAWN@:
 def interrupted_spawn(*args,**kwargs):
  process=original_popen(*args,**kwargs)
  deadline=time.monotonic()+5
  while not (base/"owned-ready.json").exists():
   if time.monotonic()>deadline:raise RuntimeError("owned child startup timeout")
   time.sleep(.01)
  os.kill(os.getpid(),@SIGNUM@)
  return process
 matrix.subprocess.Popen=interrupted_spawn
def fake_case(args,manifest,cell,case,token,base_url,credentials,cleanup_state):
 root=args.report_root/cell["cellId"].replace(":","-")/case;root.mkdir(parents=True)
 cleanup_state["caseCreated"]=True
 for name in ("agent-home","jvm-home"):(root/name).mkdir()
 matrix.seed_profile(root,cell,token,base_url,credentials)
 if case=="U01":
  (root/"result.json").write_text('{"status":"passed","fixture":"preserve-me"}')
  return {"cellId":cell["cellId"],"caseId":case,"status":"passed"}
 (root/"events.jsonl").write_text('{"fixture":"already-observed-before-signal"}\n')
 with matrix.provider_relay("http://127.0.0.1:9",cell["model"],cell["protocol"],[],root/"provider-requests.json") as endpoint:
  (base/"relay-port").write_text(endpoint.rsplit(":",1)[1])
  matrix.run_owned([sys.executable,"-c",parent_program],dict(os.environ),root/"owned.log",60,cleanup_state)
 raise AssertionError("signal interruption did not unwind")
matrix._run_case=fake_case
try:
 code=matrix.main(["--engine-bin",str(engine),"--engine-package",str(package),"--engine-sha","offline",
  "--proto-root",str(proto),"--report-root",str(base/"campaign")])
 port=int((base/"relay-port").read_text())
 with socket.socket() as probe:
  probe.settimeout(1);relay_closed=probe.connect_ex(("127.0.0.1",port))!=0
 (base/"post-cleanup.json").write_text(json.dumps({"code":code,"unrelatedAlive":unrelated.poll() is None,
  "relayClosed":relay_closed,"handlersRestored":all(signal.getsignal(item)==handler for item,handler in prior.items())}))
finally:
 matrix.subprocess.Popen=original_popen
 unrelated.terminate();unrelated.wait(timeout=5)
raise SystemExit(code)
'''.replace("@FIXTURE@", repr(str(fixture_root))).replace("@DRIVER@", repr(str(DRIVER))) \
            .replace("@DURING_SPAWN@", repr(during_spawn)).replace("@SIGNUM@", str(int(signum)))
        process = subprocess.Popen([sys.executable, "-c", script], stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True, start_new_session=True)
        try:
            deadline = time.monotonic() + 10
            ready = fixture_root / "owned-ready.json"
            while not ready.exists() and process.poll() is None and time.monotonic() < deadline:
                time.sleep(0.01)
            if not ready.exists():
                stdout, stderr = process.communicate(timeout=5)
                self.fail("Python signal fixture did not reach its owned children: " + stdout + stderr)
            if not during_spawn:
                process.send_signal(signum)
                # A second signal during cleanup must not abort the finally path.
                time.sleep(0.03)
                if process.poll() is None:
                    process.send_signal(signal.SIGTERM if signum == signal.SIGINT else signal.SIGINT)
            stdout, stderr = process.communicate(timeout=10)
            self.assertEqual(process.returncode, 128 + signum, stdout + stderr)
            post = json.loads((fixture_root / "post-cleanup.json").read_text())
            self.assertEqual(post, {"code": 128 + signum, "unrelatedAlive": True,
                                    "relayClosed": True, "handlersRestored": True})
            for child in json.loads(ready.read_text()):
                self.assertNotIn(child["pid"], matrix.process_table(), "Owned descendant survived signal cleanup")
            summary = json.loads((fixture_root / "campaign/summary.json").read_text())
            self.assertEqual(summary["status"], "interrupted")
            self.assertEqual(summary["executedCases"], 1)
            self.assertEqual(summary["signal"], signum)
            self.assertEqual(summary["exitCode"], 128 + signum)
            self.assertFalse(summary["cleanupFailed"])
            cell = matrix.expected_cells()[0]["cellId"].replace(":", "-")
            first = fixture_root / "campaign" / cell / "U01/result.json"
            self.assertEqual(first.read_text(), '{"status":"passed","fixture":"preserve-me"}')
            active = fixture_root / "campaign" / cell / "U02"
            self.assertIn("already-observed-before-signal", (active / "events.jsonl").read_text())
            self.assertEqual(json.loads((active / "interruption.json").read_text())["status"], "interrupted")
            self.assertNotIn("private-fixture-token", json.dumps(summary))
            for artifact in (fixture_root / "campaign").rglob("*"):
                if artifact.is_file():
                    self.assertNotIn(b"private-fixture-token", artifact.read_bytes(), "Runtime credential remained in final artifacts")
            self.assertTrue(json.loads((active / "credential-status.json").read_text())["knownRuntimeCredentialsRemoved"])
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate(timeout=5)
            for path in (fixture_root / "owned-ready.json", fixture_root / "owned-False.json", fixture_root / "owned-True.json"):
                if not path.exists():
                    continue
                value = json.loads(path.read_text())
                for child in value if isinstance(value, list) else [value]:
                    current = matrix.process_table().get(child["pid"])
                    if current is not None and current[3] == child["started"]:
                        os.kill(child["pid"], signal.SIGKILL)

    @unittest.skipUnless(sys.platform == "linux", "Signal cleanup verifies owned descendants through Linux /proc")
    def test_sigterm_unwinds_owned_children_relay_and_retains_partial_campaign(self):
        self.signal_driver_fixture(signal.SIGTERM)

    @unittest.skipUnless(sys.platform == "linux", "Signal cleanup verifies owned descendants through Linux /proc")
    def test_sigint_unwinds_owned_children_relay_and_retains_partial_campaign(self):
        self.signal_driver_fixture(signal.SIGINT)

    @unittest.skipUnless(sys.platform == "linux", "Signal cleanup verifies owned descendants through Linux /proc")
    def test_signal_during_spawn_waits_for_cleanup_ownership_before_unwinding(self):
        self.signal_driver_fixture(signal.SIGTERM, during_spawn=True)

    def credential_case_fixture(self, mode):
        report = self.root / mode
        args = mock.Mock(report_root=report)
        manifest = {"campaignId": "offline-credential-campaign"}
        cell = matrix.expected_cells()[0]
        token = "offline-private-runtime-token"

        def fake_case(_args, _manifest, _cell, case, _token, base_url, credentials, cleanup_state):
            root = report / cell["cellId"].replace(":", "-") / case
            root.mkdir(parents=True)
            cleanup_state["caseCreated"] = True
            for name in ("agent-home", "jvm-home"):
                (root / name).mkdir()
            matrix.seed_profile(root, cell, _token, base_url, credentials)
            matrix.write_private_json(root / "oracle.json", {"model": cell["model"], "protocol": cell["protocol"], "modelProfile": cell["modelProfile"]})
            (root / "unrelated-user-file.json").write_text('{"preserve":"unrelated"}')
            if mode == "unsafe-stop":
                cleanup_state["stopped"] = False
            if mode != "success":
                raise ValueError("offline failure after runtime seeding")
            return {"status": "passed"}

        with mock.patch.object(matrix, "_run_case", side_effect=fake_case):
            if mode == "success":
                self.assertEqual(matrix.run_case(args, manifest, cell, "U01", token, "http://127.0.0.1:9"), {"status": "passed"})
            else:
                expected = "not confirmed stopped" if mode == "unsafe-stop" else "offline failure"
                with self.assertRaisesRegex(ValueError, expected):
                    matrix.run_case(args, manifest, cell, "U01", token, "http://127.0.0.1:9")
        return report / cell["cellId"].replace(":", "-") / "U01", token

    def test_success_removes_only_owned_runtime_credentials_and_keeps_model_metadata(self):
        root, token = self.credential_case_fixture("success")
        self.assertFalse((root / "agent-home/config.json").exists())
        self.assertFalse((root / "jvm-home/.universe-agent/config.json").exists())
        self.assertTrue((root / "agent-home/models.json").is_file())
        self.assertEqual(json.loads((root / "oracle.json").read_text())["model"], matrix.MODELS["flash"])
        self.assertEqual((root / "unrelated-user-file.json").read_text(), '{"preserve":"unrelated"}')
        for path in root.rglob("*"):
            if path.is_file():
                self.assertNotIn(token.encode(), path.read_bytes())

    def test_failure_also_removes_owned_runtime_credentials_after_confirmed_stop(self):
        root, token = self.credential_case_fixture("failure")
        status = json.loads((root / "credential-status.json").read_text())
        self.assertTrue(status["ownedProcessesStopped"])
        self.assertTrue(status["knownRuntimeCredentialsRemoved"])
        for path in root.rglob("*"):
            if path.is_file():
                self.assertNotIn(token.encode(), path.read_bytes())

    def test_unconfirmed_owned_stop_retains_private_configs_and_cannot_report_safe(self):
        root, _token = self.credential_case_fixture("unsafe-stop")
        status = json.loads((root / "credential-status.json").read_text())
        self.assertEqual(status["status"], "private-isolation-required")
        self.assertFalse(status["safeToShare"])
        self.assertFalse(status["knownRuntimeCredentialsRemoved"])
        self.assertTrue((root / "agent-home/config.json").is_file())

    def test_credential_cleanup_never_deletes_an_unknown_existing_config(self):
        root = self.root / "unknown-config"
        (root / "agent-home").mkdir(parents=True)
        unknown = root / "agent-home/config.json"
        unknown.write_text('{"preserve":"existing user configuration"}')
        credentials = []
        with self.assertRaises(FileExistsError):
            matrix.seed_profile(root, matrix.expected_cells()[0], "offline-token", "http://127.0.0.1:9", credentials)
        matrix.remove_seeded_credentials(credentials)
        self.assertEqual(credentials, [])
        self.assertEqual(unknown.read_text(), '{"preserve":"existing user configuration"}')

    def budget_control_fixture(self, case_id="U01", start=None):
        root = self.root / (case_id + "-budget")
        root.mkdir()
        began = time.monotonic_ns() - 100_000_000 if start is None else start
        identity = {"campaignId": "offline-budget-campaign", "cellId": "flash:anthropic", "caseId": case_id, "nonce": "owned-attempt"}
        control = matrix.CaseBudgetControl(root, identity, matrix.case_budget(case_id), now=lambda: began)
        control.now = time.monotonic_ns
        return control

    @staticmethod
    def budget_progress(control, stages, seq=1):
        tail = stages[-1]
        return {**control.envelope(), **{key: tail[key] for key in ("phase", "episodeIndex", "episodeLabel", "phaseStartedMonoNs", "phaseDeadlineMonoNs", "status")},
            "seq": seq, "expectedEpisodeCount": control.budget["episodeCount"],
            "startedEpisodeCount": sum(stage["phase"] == "episode" for stage in stages),
            "completedEpisodeCount": sum(stage["phase"] == "episode" and stage["status"] == "completed" for stage in stages),
            "budgetStages": stages}

    def test_frozen_composite_budgets_keep_every_episode_and_the_engine_timeout(self):
        expected = {"U01": (1, 720000, 780000), "U02": (2, 1320000, 1380000), "U07": (7, 4440000, 4500000)}
        for case, (count, case_ms, watchdog_ms) in expected.items():
            budget = matrix.case_budget(case)
            self.assertEqual((budget["episodeCount"], budget["caseBudgetMs"], budget["watchdogMs"]), (count, case_ms, watchdog_ms))
            self.assertEqual(budget["episodeMs"], 600000)
        self.assertEqual(matrix.TASK_TIMEOUT_MS, 600000)
        self.assertEqual(matrix.case_budget("U07")["episodeLabels"], ["U01", "U02", "U02:followup", "U08", "U09", "U10", "U06"])

    def test_parent_accepts_fast_u07_phase_jumps_only_with_complete_retained_history(self):
        control = self.budget_control_fixture("U07")
        initial = self.budget_stages(control.budget, control.clock)
        matrix.update_private_json(control.progress_file, self.budget_progress(control, initial))
        control.read_progress()
        completed = self.budget_stages(control.budget, control.clock, completed=True)
        matrix.update_private_json(control.progress_file, self.budget_progress(control, completed, seq=100))
        self.assertEqual(control.read_progress()["completedEpisodeCount"], 7)

    def test_parent_rejects_missing_episode_history_even_when_latest_counters_claim_seven(self):
        control = self.budget_control_fixture("U07")
        stages = self.budget_stages(control.budget, control.clock, completed=True)
        del stages[3]
        progress = self.budget_progress(control, stages, seq=100)
        progress.update(startedEpisodeCount=7, completedEpisodeCount=7)
        matrix.update_private_json(control.progress_file, progress)
        with self.assertRaisesRegex(ValueError, "skipped|required|history"):
            control.read_progress()

    def test_parent_rejects_progress_with_a_different_attempt_or_clock(self):
        control = self.budget_control_fixture()
        stages = self.budget_stages(control.budget, control.clock)
        for key, value in (("nonce", "previous-attempt"), ("bootId", "other-host-boot")):
            progress = self.budget_progress(control, stages)
            progress[key] = value
            matrix.update_private_json(control.progress_file, progress)
            with self.assertRaisesRegex(ValueError, "identity"):
                control.read_progress()

    def test_repeated_poll_cannot_refresh_a_phase_or_modify_completed_history(self):
        control = self.budget_control_fixture()
        stages = self.budget_stages(control.budget, control.clock)
        matrix.update_private_json(control.progress_file, self.budget_progress(control, stages))
        control.read_progress()
        changed = json.loads(json.dumps(stages))
        changed[0]["phaseDeadlineMonoNs"] = str(int(changed[0]["phaseDeadlineMonoNs"]) + 1)
        matrix.update_private_json(control.progress_file, self.budget_progress(control, changed, seq=2))
        with self.assertRaisesRegex(ValueError, "deadline|history"):
            control.read_progress()
        completed = self.budget_stages(control.budget, control.clock, completed=True)
        matrix.update_private_json(control.progress_file, self.budget_progress(control, completed, seq=3))
        control.read_progress()
        completed[0]["timeoutOperation"] = "rewritten-after-completion"
        matrix.update_private_json(control.progress_file, self.budget_progress(control, completed, seq=4))
        with self.assertRaisesRegex(ValueError, "Completed.*modified"):
            control.read_progress()

    def test_cleanup_has_one_complete_atomic_winner_and_later_callers_cannot_extend_it(self):
        control = self.budget_control_fixture()
        claims, failures = [], []
        def claim():
            try:
                claims.append(control.ensure_cleanup())
            except BaseException as error:
                failures.append(error)
        threads = [threading.Thread(target=claim) for _ in range(12)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=3)
        self.assertEqual(failures, [])
        self.assertEqual(len(claims), 12)
        self.assertTrue(all(claim == claims[0] for claim in claims))
        initial = control.cleanup_file.read_bytes()
        control.ensure_cleanup()
        self.assertEqual(control.cleanup_file.read_bytes(), initial)
        self.assertFalse(list(control.root.glob("cleanup-budget.json.tmp-*")))

    def test_cleanup_deadline_replacement_is_rejected_instead_of_granting_more_time(self):
        control = self.budget_control_fixture()
        claim = dict(control.ensure_cleanup())
        claim["cleanupDeadlineMonoNs"] = str(int(claim["cleanupDeadlineMonoNs"]) + 1_000_000)
        matrix.update_private_json(control.cleanup_file, claim)
        with self.assertRaisesRegex(ValueError, "allowance|replaced"):
            control.read_cleanup()
        self.assertLessEqual(control.cleanup_limit(), time.monotonic_ns())
        self.assertTrue(control.protocol_error)

    def test_removing_an_established_cleanup_file_cannot_restart_its_allowance(self):
        control = self.budget_control_fixture()
        control.ensure_cleanup()
        control.cleanup_file.unlink()
        with self.assertRaisesRegex(ValueError, "disappeared|restarted"):
            control.ensure_cleanup()
        self.assertLessEqual(control.cleanup_limit(), time.monotonic_ns())
        self.assertFalse(control.cleanup_file.exists())

    def test_late_completed_finalization_or_missing_budget_identity_cannot_pass(self):
        oracle, result, observations = self.result_fixture("U07")
        final = next(stage for stage in result["budgetStages"] if stage["phase"] == "finalization")
        final["endedMonoNs"] = str(int(final["phaseDeadlineMonoNs"]) + 1)
        self.assertIn("budget-policy-clock-or-phase-history-invalid", self.errors(oracle, result, observations))
        result.pop("budgetSha256")
        self.assertIn("budget-policy-clock-or-phase-history-invalid", self.errors(oracle, result, observations))

    def test_passed_result_cannot_hide_failed_active_or_late_cleanup(self):
        for state in ("active", "failed", "timed-out", "unknown"):
            with self.subTest(status=state):
                oracle, result, observations = self.result_fixture()
                cleanup = result["budgetStages"][-1]
                cleanup["status"] = state
                if state == "active":
                    cleanup["endedMonoNs"] = None
                self.assertIn("budget-policy-clock-or-phase-history-invalid", self.errors(oracle, result, observations))
        for field, change in (("endedMonoNs", lambda stage: str(int(stage["phaseDeadlineMonoNs"]) + 1)),
                              ("durationMs", lambda _stage: float("nan"))):
            with self.subTest(field=field):
                oracle, result, observations = self.result_fixture()
                cleanup = result["budgetStages"][-1]
                cleanup[field] = change(cleanup)
                self.assertIn("budget-policy-clock-or-phase-history-invalid", self.errors(oracle, result, observations))

    def test_parent_first_cleanup_may_overlap_failed_business_but_cannot_retime_a_pass(self):
        oracle, result, _observations = self.result_fixture()
        stages = result["budgetStages"]
        last_business, cleanup = stages[-2:]
        cleanup["phaseStartedMonoNs"] = str(int(cleanup["phaseStartedMonoNs"]) - 1)
        cleanup["phaseDeadlineMonoNs"] = str(int(cleanup["phaseDeadlineMonoNs"]) - 1)
        cleanup["durationMs"] += 0.000001
        with self.assertRaisesRegex(ValueError, "unaccounted"):
            matrix.validate_budget_stages(oracle["budget"], oracle["clock"], stages, time.monotonic_ns())
        last_business["status"] = "failed"
        matrix.validate_budget_stages(oracle["budget"], oracle["clock"], stages, time.monotonic_ns())

    def test_exact_deadline_is_expired_for_finalization_and_cleanup(self):
        for phase, message in (("finalization", "Late budget completion"), ("cleanup", "Late cleanup")):
            with self.subTest(phase=phase):
                oracle, result, _observations = self.result_fixture()
                stage = next(item for item in result["budgetStages"] if item["phase"] == phase)
                at = int(stage["phaseDeadlineMonoNs"])
                stage["endedMonoNs"] = str(at)
                stage["durationMs"] = (at - int(stage["phaseStartedMonoNs"])) / 1_000_000
                with self.assertRaisesRegex(ValueError, message):
                    matrix.validate_budget_stages(oracle["budget"], oracle["clock"], result["budgetStages"], at, require_complete=True)

    @unittest.skipUnless(sys.platform == "linux", "Real parent watchdog uses Linux owned groups")
    def test_setup_watchdog_covers_a_child_hung_before_any_cjs_progress(self):
        control = self.budget_control_fixture(start=time.monotonic_ns() - 61_000_000_000)
        code = "import time;time.sleep(60)"
        state = {"stopped": True}
        result, timed_out = matrix.run_owned([sys.executable, "-c", code], dict(os.environ), control.root / "startup.log", 780, state, control)
        self.assertNotEqual(result, 0)
        self.assertTrue(timed_out)
        self.assertEqual(control.timeout["phase"], "setup")
        self.assertTrue(state["stopped"])
        self.assertFalse(control.progress_file.exists())

    @unittest.skipUnless(sys.platform == "linux", "Real parent watchdog uses Linux owned groups")
    def test_passed_result_does_not_disable_watchdog_while_postprocessing_child_is_hung(self):
        control = self.budget_control_fixture(start=time.monotonic_ns() - 61_000_000_000)
        stages = self.budget_stages(control.budget, control.clock, completed=True)
        cleanup_start = int(stages[-1]["endedMonoNs"])
        control.now = lambda: cleanup_start
        claim = control.ensure_cleanup()
        control.now = time.monotonic_ns
        stages.append({"phase": "cleanup", "episodeIndex": 0, "episodeLabel": None,
            "phaseStartedMonoNs": claim["cleanupStartedMonoNs"], "phaseDeadlineMonoNs": claim["cleanupDeadlineMonoNs"],
            "status": "completed", "endedMonoNs": str(cleanup_start + 1_000_000), "durationMs": 1, "timeoutOperation": None})
        matrix.update_private_json(control.progress_file, self.budget_progress(control, stages, seq=100))
        matrix.write_private_json(control.root / "scenario-result.json", {"status": "passed"})
        child_file = control.root / "video-child.pid"
        child_code = "import os,pathlib,signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);pathlib.Path(" + repr(str(child_file)) + ").write_text(str(os.getpid()));time.sleep(60)"
        parent_code = "import pathlib,subprocess,sys,time;subprocess.Popen([sys.executable,'-c'," + repr(child_code) + "],start_new_session=True);p=pathlib.Path(" + repr(str(child_file)) + ");\nwhile not p.exists():time.sleep(.005)\ntime.sleep(60)"
        original_popen = subprocess.Popen
        owned = []
        def spawn_then_publish(*args, **kwargs):
            process = original_popen(*args, **kwargs)
            owned.append(process)
            until = time.monotonic() + 3
            while not child_file.exists() and time.monotonic() < until:
                time.sleep(.005)
            self.assertTrue(child_file.exists())
            return process
        began = time.monotonic()
        state = {"stopped": True}
        try:
            with mock.patch.object(matrix.subprocess, "Popen", side_effect=spawn_then_publish):
                try:
                    code, timed_out = matrix.run_owned([sys.executable, "-c", parent_code], dict(os.environ), control.root / "postprocess.log", 780, state, control)
                    self.assertNotEqual(code, 0)
                    self.assertTrue(timed_out)
                except ValueError as error:
                    self.assertIn("cleanup", str(error))
            self.assertLess(time.monotonic() - began, 2)
            self.assertEqual(control.timeout["phase"], "cleanup")
            child_pid = int(child_file.read_text())
            until = time.monotonic() + 1
            while child_pid in matrix.process_table() and time.monotonic() < until:
                try:
                    os.waitpid(child_pid, os.WNOHANG)
                except ChildProcessError:
                    pass
                time.sleep(.005)
            self.assertNotIn(child_pid, matrix.process_table())
        finally:
            for process in owned:
                if process.poll() is None:
                    process.kill()
                process.wait(timeout=3)

    def classified_case_fixture(self, category, cjs_timeout=False, cleanup_error=False):
        report = self.root / ("classified-case-" + category)
        report.mkdir()
        args = mock.Mock(report_root=report, engine_bin=Path("/not/executed"), proto_root=Path("/not/executed"))
        cell = matrix.expected_cells()[0]
        manifest = {"campaignId": "offline-classification", "budgetPolicy": matrix.budget_policy(),
                    "budgetPolicySha256": matrix.canonical_sha256(matrix.budget_policy()),
                    "identity": {"ide": {"provenanceModules": self.module_seal()}}}
        control_type = matrix.CaseBudgetControl

        def make_control(*args, **kwargs):
            if cjs_timeout:
                kwargs["now"] = lambda: time.monotonic_ns() - 61_000_000_000
            return control_type(*args, **kwargs)

        def fake_owned(_command, env, _log, timeout, cleanup_state, control):
            self.assertEqual(timeout, 4500)
            self.assertEqual(env["UA_REAL_EDITOR_TIMEOUT_MS"], "600000")
            oracle = json.loads(Path(env["UA_REAL_EDITOR_ORACLE_FILE"]).read_text())
            stages = self.budget_stages(control.budget, control.clock, completed=True)
            # A pure classifier fixture, not live evidence: keep every phase in
            # the past even on extremely fast filesystems.
            at = int(control.clock["setupStartedMonoNs"])
            for stage in stages:
                stage.update(phaseStartedMonoNs=str(at), phaseDeadlineMonoNs=str(at + (control.budget["setupMs"] if stage["phase"] == "setup" else control.budget["historyMs"] if stage["phase"] == "history" else control.budget["finalizationMs"] if stage["phase"] == "finalization" else control.budget["episodeMs"]) * 1_000_000), endedMonoNs=str(at), durationMs=0)
            stages[-1]["status"] = "failed"
            timeout = None
            if cjs_timeout:
                # The CJS stage actually reaches its registered deadline in the past;
                # the parent sees cleanup next, so it never sets control.timeout.
                finalization = stages[-1]
                finalization.update(status="timed-out", endedMonoNs=finalization["phaseDeadlineMonoNs"],
                                    durationMs=control.budget["finalizationMs"], timeoutOperation="fixture-cjs-stage-timeout")
                timeout = {"phase": "finalization", "episodeIndex": 0, "episodeLabel": None,
                           "operation": "fixture-cjs-stage-timeout", "atMonoNs": finalization["endedMonoNs"]}
                control.now = time.monotonic_ns
            claim = control.ensure_cleanup()
            stages.append({"phase": "cleanup", "episodeIndex": 0, "episodeLabel": None,
                "phaseStartedMonoNs": claim["cleanupStartedMonoNs"], "phaseDeadlineMonoNs": claim["cleanupDeadlineMonoNs"],
                "status": "completed", "endedMonoNs": claim["cleanupStartedMonoNs"], "durationMs": 0, "timeoutOperation": None})
            evidence = {}
            for name in ("domFile", "eventFile", "oracleFile"):
                path = control.root / (name + ".json")
                matrix.write_private_json(path, {"offline": True})
                evidence[name] = str(path)
            provenance_file = self.provenance_fixture(oracle, control.root)
            if category.startswith("dom-frame-provenance-"):
                provenance = json.loads(provenance_file.read_text())
                provenance["status"] = category.removeprefix("dom-frame-provenance-")
                matrix.update_private_json(provenance_file, provenance)
            evidence["provenanceFile"] = str(provenance_file)
            value = {**oracle, "status": "failed" if category.endswith("-invalid") else "uncovered", "failureCategory": category, "actualModel": oracle["model"],
                "actualProtocol": oracle["protocol"], "evidence": evidence, "budgetStages": stages,
                "timeout": timeout,
                "expectedEpisodeCount": 7, "startedEpisodeCount": 7, "completedEpisodeCount": 7,
                "assertions": [{"id": item, "passed": item == "dom-frame-provenance" and category == "process-fold-uncovered"} for item in matrix.REQUIRED_ASSERTIONS["U07"]]}
            matrix.write_private_json(Path(env["UA_REAL_EDITOR_RESULT_FILE"]), value)
            matrix.update_private_json(control.progress_file, self.budget_progress(control, stages, seq=100))
            self.assertIsNone(control.timeout)
            return 1, False

        with mock.patch.object(matrix, "run_owned", side_effect=fake_owned), mock.patch.object(matrix, "ROOT", self.module_repo), \
                mock.patch.object(matrix, "CaseBudgetControl", side_effect=make_control):
            if cleanup_error:
                with mock.patch.object(matrix, "remove_seeded_credentials", side_effect=ValueError("offline cleanup failure")):
                    with self.assertRaisesRegex(ValueError, "offline cleanup failure"):
                        matrix.run_case(args, manifest, cell, "U07", "offline-token", "http://127.0.0.1:9")
                return json.loads(next(report.rglob("result.json")).read_text())
            row = matrix.run_case(args, manifest, cell, "U07", "offline-token", "http://127.0.0.1:9")
        self.assertEqual(row["status"], "failed")
        self.assertEqual(row["scenarioStatus"], "failed" if category.endswith("-invalid") else "uncovered")
        self.assertEqual(row["failureCategory"], category)
        self.assertEqual(row["completedEpisodeCount"], 7)
        self.assertEqual(row["timeout"] is not None, cjs_timeout)
        self.assertFalse(list(report.rglob("agent-home/config.json")))
        return row

    def test_case_result_keeps_uncovered_and_timeout_categories_instead_of_only_generic_failure(self):
        row = self.classified_case_fixture("process-fold-uncovered")
        self.assertEqual(row["diagnosticStatus"], "verified")
        self.assertIsNone(row["infrastructureFailureCategory"])

    def test_case_result_classifies_unavailable_and_invalid_dom_diagnostics_separately(self):
        for status in ("unavailable", "invalid"):
            with self.subTest(diagnostic=status):
                category = "dom-frame-provenance-" + status
                row = self.classified_case_fixture(category)
                self.assertEqual(row["diagnosticStatus"], status)
                self.assertEqual(row["infrastructureFailureCategory"], category)

    def test_cjs_only_timeout_has_priority_over_unavailable_or_invalid_diagnostics(self):
        for status in ("unavailable", "invalid"):
            with self.subTest(diagnostic=status):
                row = self.classified_case_fixture("dom-frame-provenance-" + status, cjs_timeout=True)
                self.assertEqual(row["diagnosticStatus"], status)
                self.assertEqual(row["infrastructureFailureCategory"], "budget-stage-timeout")
                self.assertEqual(row["timeout"]["operation"], "fixture-cjs-stage-timeout")

    def test_cjs_only_timeout_survives_outer_cleanup_failure_classification(self):
        row = self.classified_case_fixture("dom-frame-provenance-unavailable", cjs_timeout=True, cleanup_error=True)
        self.assertEqual(row["status"], "failed")
        self.assertEqual(row["scenarioStatus"], "uncovered")
        self.assertEqual(row["failureCategory"], "dom-frame-provenance-unavailable")
        self.assertEqual(row["infrastructureFailureCategory"], "budget-stage-timeout")
        self.assertEqual(row["timeout"]["operation"], "fixture-cjs-stage-timeout")

    def test_surviving_process_group_blocks_subsequent_case(self):
        with mock.patch.object(matrix.os, "killpg"), mock.patch.object(matrix, "wait_for_owned_group", return_value=False):
            with self.assertRaisesRegex(ValueError, "subsequent cases"):
                matrix.stop_owned_group(123456)

    def main_fixture(self):
        package = self.root / "package"
        package.mkdir()
        engine = package / "engine"
        engine.write_text("fake-not-executed")
        engine.chmod(0o700)
        proto = self.root / "proto"
        proto.mkdir()
        return ["--engine-bin", str(engine), "--engine-package", str(package), "--engine-sha", "c4fa00000000",
                "--proto-root", str(proto), "--report-root", str(self.root / "campaign")]

    def test_driver_runs_all_sixty_cases_serially_and_keeps_a_failed_cell(self):
        args = self.main_fixture()
        seen = []

        def fake_case(_args, _manifest, cell, case, _token, _base):
            seen.append((cell["cellId"], case))
            return {"cellId": cell["cellId"], "caseId": case, "status": "failed" if len(seen) == 1 else "passed"}

        with mock.patch.dict(os.environ, {"MAGPIE_API_KEY": "private-test-token"}), \
                mock.patch.object(matrix, "runtime_identity", return_value={"frozen": True}), \
                mock.patch.object(matrix, "gateway_models", return_value=set(matrix.MODELS.values())), \
                mock.patch.object(matrix, "run_case", side_effect=fake_case):
            self.assertEqual(matrix.main(args), 1)
        expected = [(cell["cellId"], case) for cell in matrix.expected_cells() for case in matrix.CASES]
        self.assertEqual(seen, expected)
        summary = json.loads((self.root / "campaign/summary.json").read_text())
        self.assertEqual(summary["expectedCases"], 60)
        self.assertEqual(summary["executedCases"], 60)
        self.assertEqual(summary["status"], "failed")
        self.assertNotIn("private-test-token", json.dumps(summary))

    def test_identity_drift_stops_before_any_ui_run(self):
        args = self.main_fixture()
        with mock.patch.dict(os.environ, {"MAGPIE_API_KEY": "private-test-token"}), \
                mock.patch.object(matrix, "runtime_identity", side_effect=[{"v": 1}, {"v": 2}]), \
                mock.patch.object(matrix, "gateway_models", return_value=set(matrix.MODELS.values())), \
                mock.patch.object(matrix, "run_case") as run:
            self.assertEqual(matrix.main(args), 2)
            run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
