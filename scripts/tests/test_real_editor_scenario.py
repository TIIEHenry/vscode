#!/usr/bin/env python3
"""Run the real scenario callbacks against Chromium DOM fixtures, without an engine."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]

FIXTURE = r'''
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.env.SCENARIO_REPO, 'node_modules/@playwright/test'));
const scenario = require(path.join(process.env.SCENARIO_REPO, 'test/scenario/scenarios/universe-agent-real-editor.cjs'));
const live = scenario.steps.find(step => step.id === 'tool-and-assistant');
const reload = scenario.steps.find(step => step.id === 'reload-history');
const marker = 'UA_REAL_EDITOR_MARKER_7F3D';
const results = [];
const url = 'http://real-editor-scenario.test/';

function row(root, text, { turn = root, busy = false, kind = 'assistant' } = {}) {
 return `<article class="conversation-timeline-item" data-root-id="${root}"${busy ? ' aria-busy="true"' : ''}><div class="conversation-lens-turn" data-kind="${kind}" data-turn-id="${turn}" aria-busy="false">${text}</div></article>`;
}
const preamble = row('preamble', 'I will read the file.');
const answer = row('answer', marker);
const tool = `<article class="conversation-timeline-item" data-root-id="tool"><div class="conversation-process-fold"><button class="conversation-process-fold-header" aria-expanded="true">Tool</button><div class="conversation-process-fold-tool">file_read succeeded</div></div></article>`;
function html(assistants = preamble + answer, tools = tool, extra = '') {
 return `<body><div role="status" aria-label="Engine connection: Engine · Loopback">Engine · Loopback</div>${row('user', 'Fixture question', {kind:'user'})}${assistants}${tools}${extra}</body>`;
}

async function fixture(browser, initial, replay = initial) {
 const context = await browser.newContext();
 const actual = await context.newPage();
 actual.setDefaultNavigationTimeout(2000);
 let reloadHTML = replay;
 await actual.route(url, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: reloadHTML }));
 await actual.goto(url);
 await actual.setContent(initial);
 const waits = [];
 let fixtureTimeout = 2000;
 // Only the test's waiting budget is bounded. Assert that the scenario still
 // requests its real 60s deadline, and run its real predicate in Chromium.
 const page = new Proxy(actual, { get(target, key) {
  if (key === 'waitForFunction') return (predicate, arg, options) => {
   assert.equal(options.timeout, 60000);
   waits.push(options.timeout);
   return target.waitForFunction(predicate, arg, { ...options, timeout: fixtureTimeout });
  };
  const value = Reflect.get(target, key, target);
  return typeof value === 'function' ? value.bind(target) : value;
 }});
 return { actual, page, waits, setTimeout: value => fixtureTimeout = value,
  setReplay: value => reloadHTML = value, close: () => context.close() };
}

async function waitUntilPredicate(f, baseline, state) {
 const until = Date.now() + 2000;
 while (f.waits.length === baseline && state.result === undefined && Date.now() < until) {
  await new Promise(resolve => setTimeout(resolve, 5));
 }
 assert.ok(f.waits.length > baseline, state.result?.error?.message || 'completion predicate was not reached');
 await f.actual.waitForTimeout(60);
 assert.equal(state.result, undefined, 'a busy/overlay marker must remain pending');
}

async function remainsPendingThenCompletes(f, step, completeHTML, expectedError) {
 const state = {};
 const baseline = f.waits.length;
 const promise = step.run({page:f.page}).then(value => state.result = {value}, error => state.result = {error});
 await waitUntilPredicate(f, baseline, state);
 await f.actual.setContent(completeHTML);
 await promise;
 if (expectedError) assert.match(state.result.error?.message || '', expectedError);
 else assert.equal(state.result.error, undefined, state.result.error?.message);
}

async function test(name, run) {
 fs.appendFileSync(process.env.SCENARIO_FIXTURE_PROGRESS, `START ${name}\n`);
 try { await run(); results.push({name, passed:true}); }
 catch (error) { results.push({name, passed:false, error:error.stack || String(error)}); }
 fs.appendFileSync(process.env.SCENARIO_FIXTURE_PROGRESS, JSON.stringify(results[results.length-1])+'\n');
}

(async () => {
 const browser = await chromium.launch();
 process.once('SIGTERM', () => void browser.close().finally(() => process.exit(143)));
 try {
  await test('live and real reload allow preamble plus streaming assistant', async () => {
   const f = await fixture(browser, html(preamble + row('overlay:preview', 'Streaming preview', {busy:true})), html());
   try {
    await remainsPendingThenCompletes(f, live, html());
    await reload.run({page:f.page});
    assert.deepEqual(f.waits, [60000,60000]);
   } finally { await f.close(); }
  });
  for (const [name, transient] of [
   ['article busy wins over inner turn aria-busy=false', row('answer', marker, {busy:true})],
   ['nonbusy overlay root is not durable', row('overlay:root', marker, {turn:'durable-turn'})],
   ['nonbusy overlay turn is not durable', row('answer', marker, {turn:'overlay:turn'})]
  ]) await test(name, async () => {
   const f = await fixture(browser, html(preamble + transient));
   try { await remainsPendingThenCompletes(f, live, html()); } finally { await f.close(); }
  });
  for (const [name, invalid] of [
   ['empty root cannot complete', row('', marker, {turn:'answer'})],
   ['empty turn cannot complete', row('answer', marker, {turn:''})],
   ['whitespace identity cannot complete', row('   ', marker, {turn:'answer'})],
   ['two durable marker answers are rejected', answer + row('duplicate', marker)],
   ['additional busy marker is not hidden by completed filtering', answer + row('overlay:extra', marker, {busy:true})]
  ]) await test(name, async () => {
   const f = await fixture(browser, html(preamble + invalid));
   f.setTimeout(150);
   try { await assert.rejects(() => live.run({page:f.page}), /Timeout 150ms exceeded/); }
   finally { await f.close(); }
  });
  await test('multiple successful tool rows are accepted', async () => {
   const f = await fixture(browser, html(preamble + answer, tool + tool));
   try {
    await live.run({page:f.page});
   } finally { await f.close(); }
  });
  await test('a late successful tool fold is accepted', async () => {
   const waiting = html(preamble + row('answer', marker, {busy:true}), tool);
   const completed = html(preamble + answer, tool + tool);
   const f = await fixture(browser, waiting);
   try {
    await remainsPendingThenCompletes(f, live, completed);
   } finally { await f.close(); }
  });
  await test('duplicate root identities are still rejected', async () => {
   const f = await fixture(browser, html(preamble + row('preamble', marker, {turn:'answer'})));
   try { await assert.rejects(() => live.run({page:f.page}), /duplicate timeline root ids/); }
   finally { await f.close(); }
  });
  await test('reload still rejects changed durable identities', async () => {
   const f = await fixture(browser, html(), html(preamble + row('changed-answer', marker)));
   try {
    await live.run({page:f.page});
    await assert.rejects(() => reload.run({page:f.page}), /Reload changed durable timeline identities/);
   } finally { await f.close(); }
  });
  await test('reload waits for persistent completed marker before comparing identities', async () => {
   const f = await fixture(browser, html(), html(preamble + row('overlay:preview', marker, {busy:true})));
   try {
    await live.run({page:f.page});
    await remainsPendingThenCompletes(f, reload, html());
   } finally { await f.close(); }
  });
  await test('real error rows are still rejected', async () => {
   const f = await fixture(browser, html(preamble + answer, tool, row('failure', 'Fixture error', {kind:'error'})));
   try { await assert.rejects(() => live.run({page:f.page}), /Real engine returned an error row/); }
   finally { await f.close(); }
  });
  await test('failed tools are still rejected', async () => {
   const f = await fixture(browser, html(preamble + answer, tool.replace('succeeded','Failed')));
   try { await assert.rejects(() => live.run({page:f.page}), /Real tool row is failed/); }
   finally { await f.close(); }
  });
  for (const reloaded of [false, true]) {
   for (const failure of ['error', 'tool']) await test(`${reloaded ? 'reload' : 'live'} rejects a late ${failure} after marker completion`, async () => {
    const waiting = html(preamble + row('answer', marker, {busy:true}));
    const final = failure === 'error'
     ? html(preamble + answer, tool, row('late-error', 'Late fixture error', {kind:'error'}))
     : html(preamble + answer, tool.replace('succeeded', 'Failed'));
    const f = await fixture(browser, reloaded ? html() : waiting, waiting);
    try {
     if (reloaded) await live.run({page:f.page});
     await remainsPendingThenCompletes(f, reloaded ? reload : live, final,
      failure === 'error' ? /error row/ : /tool row is failed/);
    } finally { await f.close(); }
   });
  }
 } finally { await browser.close(); }
 console.log(JSON.stringify(results));
 process.exitCode = results.every(result => result.passed) ? 0 : 1;
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
'''


class RealEditorScenarioTest(unittest.TestCase):
    def test_original_step_callbacks_with_real_chromium_dom(self):
        with tempfile.TemporaryDirectory(prefix="real-editor-scenario-dom-") as temporary:
            env = dict(os.environ, SCENARIO_REPO=str(REPO_ROOT),
                       UA_REAL_EDITOR_WORKDIR=temporary,
                       SCENARIO_FIXTURE_PROGRESS=str(Path(temporary) / "progress.log"))
            process = subprocess.Popen(["node", "-"], env=env, stdin=subprocess.PIPE,
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            try:
                stdout, stderr = process.communicate(FIXTURE, timeout=90)
            except subprocess.TimeoutExpired as error:
                process.terminate()
                try:
                    process.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.communicate()
                progress = Path(env["SCENARIO_FIXTURE_PROGRESS"])
                self.fail(f"Chromium fixture timed out: {progress.read_text() if progress.exists() else 'before first case'}; {error}")
            self.assertEqual(process.returncode, 0, stdout + stderr)
            cases = json.loads(stdout)
            self.assertEqual(len(cases), 20)
            for case in cases:
                with self.subTest(case=case["name"]):
                    self.assertTrue(case["passed"], case.get("error"))


if __name__ == "__main__":
    unittest.main()
