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
                       UA_REAL_EDITOR_SCENE="legacy",
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


# These are deliberately synthetic negative controls for the verifier. They do
# not launch an editor, contact an engine, or count as real provider evidence.
MATRIX_ORACLE_FIXTURE = r'''
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const oracle = require(path.join(process.env.SCENARIO_REPO, 'test/scenario/scenarios/universe-agent-real-editor-oracle.cjs'));
const results = [];
function test(name, run) {
 try { run(); results.push({name, passed:true}); }
 catch (error) { results.push({name, passed:false, error:error.stack || String(error)}); }
}
const fixture = oracle.prepareFixture(process.env.SCENARIO_WORKSPACE, 'U01');
const input = JSON.parse(fixture.inputs[fixture.inputName]);
const sum = input.values.reduce((a,b) => a+b,0);
const output = `# 结果\n\n**文件校验**\n\n\`\`\`json\n${JSON.stringify({nonce:input.nonce,sum})}\n\`\`\``;
const envelope = (id,seq,role,blocks) => ({decoded:{session_id:'fixture-session',envelope_appended:{envelope:{id,seq:String(seq),role,blocks}}}});
const body = value => ({text_block:{text:value}});
const call = {tool_call_block:{tool_call_id:'read-1',tool_name:'file_read',arguments_json:JSON.stringify({file_path:fixture.inputName})}};
const result = {tool_result_block:{tool_call_id:'read-1',tool_name:'file_read',content:fixture.inputs[fixture.inputName]}};
const records = [
 envelope('user',1,'USER',[body(fixture.prompt)]),
 {decoded:{tool_call_lifecycle:{tool_call_id:'read-1',agent_id:'root',started:{tool_name:'file_read',args_json:JSON.stringify({file_path:fixture.inputName})}}}},
 envelope('preamble',2,'ASSISTANT',[body('先读取实际输入文件。'),call]),
 {decoded:{tool_call_lifecycle:{tool_call_id:'read-1',agent_id:'root',completed:{output:fixture.inputs[fixture.inputName]}}}},
 envelope('result',3,'TOOL',[result]),
 envelope('answer',4,'ASSISTANT',[body(output)])
];
const row = (turnId,kind,order,text,extra={}) => ({rootId:turnId,turnId,kind,order,text,bodyText:text,visible:true,persistent:true,busy:false,inFold:false,...extra});
const dom = {busy:false,overlay:false,articleIds:['user','preamble:body','fold:preamble','answer'],rows:[
 row('user','user',0,fixture.prompt),
 row('preamble:body','assistant',1,'先读取实际输入文件。'),
 row('preamble','tool',2,'file_read',{inFold:true,inThinking:false,toolName:'file_read',status:'completed',argumentsText:fixture.inputName,payload:fixture.inputs[fixture.inputName]}),
 row('answer','assistant',3,`结果 文件校验 ${JSON.stringify({nonce:input.nonce,sum})}`)
]};
const clone = value => JSON.parse(JSON.stringify(value));
test('positive independent file/body/call-id control', () => {
 oracle.verifyPromptDoesNotContainAnswer(fixture);
 oracle.verifyVisibleAnswer(records,dom,fixture);
 oracle.verifyToolDom(records,dom);
 oracle.verifyWholeOrder(records,dom);
});
test('prompt containing private oracle answer is rejected', () => {
 assert.throws(() => oracle.verifyPromptDoesNotContainAnswer({...fixture,prompt:fixture.prompt+input.nonce}), /prompt-leaks/);
});
test('final answer only in database/events is rejected', () => {
 const invalid = clone(dom); invalid.rows.pop();
 assert.throws(() => oracle.verifyVisibleAnswer(records,invalid,fixture), /only-in-events/);
});
test('extra preview overlay cannot count as durable completion', () => {
 const invalid = clone(dom); invalid.overlay=true;
 invalid.rows.push(row('overlay:preview','assistant',4,output,{persistent:false,busy:true}));
 assert.throws(() => oracle.verifyVisibleAnswer(records,invalid,fixture), /overlay-or-busy/);
});
test('answer tokens without the actual full body are rejected', () => {
 const invalid = clone(dom); invalid.rows[3].bodyText=`${input.nonce} ${sum}`;
 assert.throws(() => oracle.verifyVisibleAnswer(records,invalid,fixture), /body-was-dropped/);
});
test('hidden final element is not visible evidence', () => {
 const invalid = clone(dom); invalid.rows[3].visible=false;
 assert.throws(() => oracle.verifyVisibleAnswer(records,invalid,fixture), /only-in-events/);
});
test('real final answer before the user is rejected', () => {
 const invalid = clone(dom); invalid.rows[3].order=-1;
 assert.throws(() => oracle.verifyVisibleAnswer(records,invalid,fixture), /order-inverted/);
});
test('present rows in the wrong source order are rejected', () => {
 const invalid = clone(dom); [invalid.rows[1],invalid.rows[2]]=[invalid.rows[2],invalid.rows[1]];
 assert.throws(() => oracle.verifyWholeOrder(records,invalid), /order-not-preserved/);
});
test('same row with a different tool name is rejected', () => {
 const invalid = clone(dom); invalid.rows[2].toolName='grep';
 assert.throws(() => oracle.verifyToolDom(records,invalid), /tool-name-not-correlated/);
});
test('tool output for a different call id is rejected', () => {
 const invalid = clone(records); invalid[4].decoded.envelope_appended.envelope.blocks[0].tool_result_block.tool_call_id='some-other-call';
 assert.throws(() => oracle.verifyToolDom(invalid,dom), /no-corresponding-real-call-id/);
});
test('tool output swapped from another invocation is rejected', () => {
 const invalid = clone(dom); invalid.rows[2].payload='a different file and nonce';
 assert.throws(() => oracle.verifyToolDom(records,invalid), /different-call/);
});
test('started-only tool is not completed by a check icon', () => {
 const invalid = records.filter((_,index) => index!==3 && index!==4);
 assert.throws(() => oracle.verifyToolDom(invalid,dom), /does-not-prove-completion/);
});
test('tool nested under thinking is not a peer process step', () => {
 const invalid = clone(dom); invalid.rows[2].inThinking=true;
 assert.throws(() => oracle.verifyToolDom(records,invalid), /nested-under-thinking/);
});
test('cancelled tool restored as success is rejected', () => {
 const before = clone(dom); before.rows[2].status='cancelled';
 assert.throws(() => oracle.verifyHistory(before,dom), /reload-changed/);
});
test('a marker/direct answer cannot satisfy the spawn route', () => {
 assert.throws(() => oracle.verifyRoute('U08',records), /required-completed-tool/);
});
test('a started route without a terminal is rejected', () => {
 assert.throws(() => oracle.verifyRoute('U08',[{decoded:{tool_call_lifecycle:{tool_call_id:'spawn',started:{tool_name:'agent_spawn'}}}}]), /required-completed-tool/);
});
test('a permission UI decision without a real request is rejected', () => {
 assert.throws(() => oracle.verifyPermissionDelivery(records,'invented-request',true,fixture,process.env.SCENARIO_WORKSPACE), /permission-request-not-correlated/);
});
test('all required scene contracts stay explicit', () => {
 assert.equal(Object.keys(oracle.REQUIRED_ASSERTIONS).length,10);
 assert.ok(oracle.REQUIRED_ASSERTIONS.U07.includes('history-status'));
 assert.ok(oracle.REQUIRED_ASSERTIONS.U04.includes('permission-delivered'));
 assert.ok(oracle.REQUIRED_ASSERTIONS.U08.includes('route-owned-terminal'));
});
const identity={schemaVersion:1,campaignId:'fixture-campaign',cellId:'flash-anthropic',caseId:'U01',nonce:'fixture-attempt',
 model:'sub2api-mimo/mimo-v2.6-flash',protocol:'anthropic',modelProfile:'matrix-flash-anthropic',
 requiredAssertions:oracle.REQUIRED_ASSERTIONS.U01,responseModelAliases:oracle.RESPONSE_MODEL_ALIASES['sub2api-mimo/mimo-v2.6-flash'],
 workspaceExpected:{root:process.env.SCENARIO_WORKSPACE}};
const identityEnv={UA_REAL_EDITOR_CAMPAIGN_ID:identity.campaignId,UA_REAL_EDITOR_CELL_ID:identity.cellId,
 UA_REAL_EDITOR_CASE_ID:identity.caseId,UA_REAL_EDITOR_NONCE:identity.nonce,UA_REAL_EDITOR_MODEL:identity.model,
 UA_REAL_EDITOR_PROTOCOL:identity.protocol,UA_REAL_EDITOR_MODEL_PROFILE:identity.modelProfile,
 UA_REAL_EDITOR_WORKDIR:process.env.SCENARIO_WORKSPACE,
 UA_REAL_EDITOR_ORACLE_FILE:path.join(process.env.SCENARIO_WORKSPACE,'..','fixture-oracle-outside-workspace.json')};
test('independent attempt identity accepts the exact preregistered SKU',()=>{oracle.validateIdentity(identityEnv,identity);});
test('different attempt nonce cannot reuse the oracle',()=>{
 assert.throws(()=>oracle.validateIdentity({...identityEnv,UA_REAL_EDITOR_NONCE:'other-attempt'},identity),/identity-mismatch:nonce/);
});
test('response aliases cannot silently include another model',()=>{
 assert.throws(()=>oracle.validateIdentity(identityEnv,{...identity,responseModelAliases:[...identity.responseModelAliases,'mimo-v2.6-pro']}),/aliases-not-predeclared/);
});
test('an oracle inside the model workspace is rejected',()=>{
 assert.throws(()=>oracle.validateIdentity({...identityEnv,UA_REAL_EDITOR_ORACLE_FILE:path.join(process.env.SCENARIO_WORKSPACE,'oracle.json')},identity),/answer-is-readable/);
});
test('another durable identity copying the final answer is rejected',()=>{
 const invalid=clone(dom);invalid.rows.push({...clone(dom.rows[3]),rootId:'answer-copy',turnId:'answer-copy',order:4});
 invalid.articleIds.push('answer-copy');
 assert.throws(()=>oracle.verifyVisibleAnswer(records,invalid,fixture),/extra-durable-assistant/);
});
test('whole-session audit rejects a second durable answer even with unique roots',()=>{
 const invalid=clone(dom);invalid.rows.push({...clone(dom.rows[3]),rootId:'answer-copy',turnId:'answer-copy',order:4});
 invalid.articleIds.push('answer-copy');
 assert.throws(()=>oracle.verifyWholeOrder(records,invalid),/unexpected-or-duplicate-durable-assistant/);
});
test('whole-session audit also rejects an unbacked different assistant body',()=>{
 const invalid=clone(dom);invalid.rows.push(row('invented','assistant',4,'not present in the real stream'));
 assert.throws(()=>oracle.verifyWholeOrder(records,invalid),/unexpected-or-duplicate-durable-assistant/);
});
test('a legitimate previous turn is kept in the cumulative assistant set',()=>{
 const cumulative=[...records,envelope('follow-user',5,'USER',[body('follow up')]),envelope('follow-answer',6,'ASSISTANT',[body('follow-up-secret')])];
 const display=clone(dom);display.rows.push(row('follow-user','user',4,'follow up'),row('follow-answer','assistant',5,'follow-up-secret'));
 oracle.verifyWholeOrder(cumulative,display);
 oracle.verifyVisibleAnswer(cumulative.slice(-2),display,{prompt:'follow up',finalTokens:['follow-up-secret']},'follow up',['follow-up-secret'],false);
});
test('a one-character tool-result prefix is rejected',()=>{
 const invalid=clone(dom);invalid.rows[2].payload='{';
 assert.throws(()=>oracle.verifyToolDom(records,invalid),/different-call/);
});
test('a shared JSON field prefix is not a complete tool result',()=>{
 const invalid=clone(dom);invalid.rows[2].payload='{"nonce":';
 assert.throws(()=>oracle.verifyToolDom(records,invalid),/different-call/);
});
test('full JSON tool results allow formatting and key-order differences',()=>{
 const equivalent=clone(dom);equivalent.rows[2].payload=JSON.stringify({values:input.values,nonce:input.nonce});
 oracle.verifyToolDom(records,equivalent);
});
test('two same-name calls cannot reuse the first complete result',()=>{
 const other=JSON.stringify({nonce:'different-real-file',values:[919,927]});
 const args=JSON.stringify({file_path:'other-real-input.json'});
 const extra=[{decoded:{tool_call_lifecycle:{tool_call_id:'read-2',agent_id:'root',started:{tool_name:'file_read',args_json:args}}}},
  envelope('second-read',5,'ASSISTANT',[{tool_call_block:{tool_call_id:'read-2',tool_name:'file_read',arguments_json:args}}]),
  {decoded:{tool_call_lifecycle:{tool_call_id:'read-2',agent_id:'root',completed:{output:other}}}},
  envelope('second-result',6,'TOOL',[{tool_result_block:{tool_call_id:'read-2',tool_name:'file_read',content:other}}])];
 const invalid=clone(dom);invalid.rows.push(row('second-read','tool',4,'file_read',{inFold:true,toolName:'file_read',status:'completed',argumentsText:'other-real-input.json',payload:fixture.inputs[fixture.inputName]}));
 assert.throws(()=>oracle.verifyToolDom([...records,...extra],invalid),/different-call/);
});
test('complete execution arguments permit equivalent durable JSON formatting',()=>{
 const valid=clone(records);const complete={file_path:fixture.inputName,read_mode:'full'};
 valid[1].decoded.tool_call_lifecycle.started.args_json='{"file_path":';
 valid.splice(2,0,{decoded:{tool_call_lifecycle:{tool_call_id:'read-1',agent_id:'root',args_complete:{args_json:JSON.stringify(complete)}}}});
 valid[3].decoded.envelope_appended.envelope.blocks[1].tool_call_block.arguments_json=JSON.stringify({read_mode:'full',file_path:fixture.inputName},null,2);
 assert.deepEqual(JSON.parse(oracle.toolFacts(valid)[0].args),complete);
});
test('durable arguments cannot replace different complete execution arguments',()=>{
 const invalid=clone(records);invalid.splice(2,0,{decoded:{tool_call_lifecycle:{tool_call_id:'read-1',agent_id:'root',args_complete:{args_json:JSON.stringify({file_path:'actually-executed-elsewhere.json'})}}}});
 assert.throws(()=>oracle.toolFacts(invalid),/execution-and-durable-arguments-disagree/);
});
test('a durable result and matching DOM cannot conceal a different executed result',()=>{
 const invalid=clone(records);invalid[3].decoded.tool_call_lifecycle.completed.output='{"actual":"another call result"}';
 assert.throws(()=>oracle.verifyToolDom(invalid,dom),/execution-and-durable-result-disagree/);
});
test('equivalent complete JSON execution and durable results keep their semantic content',()=>{
 const valid=clone(records);valid[4].decoded.envelope_appended.envelope.blocks[0].tool_result_block.content=JSON.stringify({values:input.values,nonce:input.nonce});
 oracle.verifyToolDom(valid,dom);
});
test('durable success cannot conceal a completed execution error flag',()=>{
 const invalid=clone(records);invalid[3].decoded.tool_call_lifecycle.completed.is_error=true;
 assert.throws(()=>oracle.toolFacts(invalid),/execution-and-durable-result-disagree/);
});
test('durable success cannot overwrite a failed lifecycle',()=>{
 const invalid=clone(records);const life=invalid[3].decoded.tool_call_lifecycle;delete life.completed;life.failed={error_message:'execution failed'};
 assert.throws(()=>oracle.toolFacts(invalid),/failed-execution-presented-as-success/);
});
test('failed lifecycle remains failed when durable error text has a different representation',()=>{
 const valid=clone(records);const life=valid[3].decoded.tool_call_lifecycle;delete life.completed;life.failed={error_message:'execution failed'};
 valid[4].decoded.envelope_appended.envelope.blocks[0].tool_result_block.is_error=true;
 const display=clone(dom);display.rows[2].status='failed';
 oracle.verifyToolDom(valid,display);assert.equal(oracle.toolFacts(valid)[0].lifecycleFailed,true);
});
test('a nonempty durable tool name cannot rename the same execution call id',()=>{
 const invalid=clone(records);invalid[2].decoded.envelope_appended.envelope.blocks[1].tool_call_block.tool_name='file_write';
 assert.throws(()=>oracle.toolFacts(invalid),/call-name-changed-for-same-id/);
});
test('a lifecycle terminal cannot replace the start owner for the same call id',()=>{
 const invalid=clone(records);invalid[3].decoded.tool_call_lifecycle.agent_id='different-agent';
 assert.throws(()=>oracle.toolFacts(invalid),/call-agentId-changed-for-same-id/);
});
test('a lifecycle terminal cannot replace the runtime turn for the same call id',()=>{
 const invalid=clone(records);invalid[1].decoded.tool_call_lifecycle.turn_id='turn-a';invalid[3].decoded.tool_call_lifecycle.turn_id='turn-b';
 assert.throws(()=>oracle.toolFacts(invalid),/call-turnId-changed-for-same-id/);
});
test('a durable envelope cannot replace the actual execution owner',()=>{
 const invalid=clone(records);invalid[2].decoded.envelope_appended.envelope.agent_id='different-agent';
 assert.throws(()=>oracle.toolFacts(invalid),/call-agentId-changed-for-same-id/);
});
test('conflicting complete results for one execution call id are rejected',()=>{
 const invalid=clone(records);invalid.splice(4,0,{decoded:{tool_call_lifecycle:{tool_call_id:'read-1',agent_id:'root',completed:{output:'different execution result'}}}});
 assert.throws(()=>oracle.toolFacts(invalid),/execution-result-changed-for-same-call/);
});
test('a later successful lifecycle cannot erase a prior failed lifecycle',()=>{
 const invalid=clone(records);invalid.splice(3,0,{decoded:{tool_call_lifecycle:{tool_call_id:'read-1',agent_id:'root',failed:{error_message:'execution failed'}}}});
 assert.throws(()=>oracle.toolFacts(invalid),/failed-execution-presented-as-success/);
});
const routeWorkspace=path.join(process.env.SCENARIO_WORKSPACE,'route-controls');fs.mkdirSync(routeWorkspace);
const loopFixture=oracle.prepareFixture(routeWorkspace,'U10','route-control');
// Deliberately seed correct post-hoc artifacts in this OFFLINE negative fixture.
// The route verifier must still reject an execution trace that did not create
// those artifacts at the declared path, with the declared content and phase.
for(const [file,value]of Object.entries(loopFixture.outputs))fs.writeFileSync(path.join(routeWorkspace,file),JSON.stringify(value));
const start=(id,name,args={})=>({decoded:{session_id:'route-session',tool_call_lifecycle:{agent_id:'root',turn_id:'root-turn',tool_call_id:id,started:{tool_name:name,args_json:JSON.stringify(args)}}}});
const argsComplete=(id,args)=>({decoded:{session_id:'route-session',tool_call_lifecycle:{agent_id:'root',turn_id:'root-turn',tool_call_id:id,args_complete:{args_json:JSON.stringify(args)}}}});
const done=id=>({decoded:{session_id:'route-session',tool_call_lifecycle:{agent_id:'root',turn_id:'root-turn',tool_call_id:id,completed:{output:'done'}}}});
const state=(id,seq,iteration,isExit=false)=>{const record=envelope(id,seq,'SYSTEM',[{loop_state_block:{loop_id:'owned-loop',iteration,is_exit:isExit,terminal_reason:isExit?'agent_exit':''}}]);record.decoded.session_id='route-session';return record;};
const writeArgs=file=>({file_path:file,content:JSON.stringify(loopFixture.outputs[file])});
const loopRecords=[start('create','loop_create'),state('loop-first',1,1),done('create'),
 start('stage-write','file_write',writeArgs(loopFixture.stageName)),argsComplete('stage-write',writeArgs(loopFixture.stageName)),done('stage-write'),
 start('next','loop_next'),state('loop-second',2,2),done('next'),
 start('result-write','file_write',writeArgs(loopFixture.outputName)),argsComplete('result-write',writeArgs(loopFixture.outputName)),done('result-write'),
 start('exit','loop_exit'),state('loop-exit',3,2,true),done('exit'),
 {decoded:{session_id:'route-session',turn_lifecycle:{turn_completed:{agent_id:'root',turn_id:'root-turn'}}}}];
function changeWrite(list,id,update){for(const record of list){const life=record.decoded.tool_call_lifecycle;if(life?.tool_call_id!==id)continue;const arm=life.args_complete||life.started;if(!arm)continue;const args=JSON.parse(arm.args_json);Object.assign(args,update);arm.args_json=JSON.stringify(args);}}
test('exact relative workspace paths and correctly phased writes satisfy the loop control',()=>{
 oracle.verifyFiles(routeWorkspace,loopFixture);oracle.verifyRoute('U10',loopRecords,loopFixture);
});
test('exact absolute workspace paths also satisfy the route control',()=>{
 const absolute=clone(loopRecords);changeWrite(absolute,'stage-write',{file_path:path.join(routeWorkspace,loopFixture.stageName)});changeWrite(absolute,'result-write',{file_path:path.join(routeWorkspace,loopFixture.outputName)});
 oracle.verifyRoute('U10',absolute,loopFixture);
});
test('a route writer without observed complete execution arguments is rejected',()=>{
 const invalid=clone(loopRecords).filter(record=>!(record.decoded.tool_call_lifecycle?.tool_call_id==='result-write'&&record.decoded.tool_call_lifecycle.args_complete));
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/execution-args-not-observed-once/);
});
test('a route writer cannot use duplicated complete execution arguments',()=>{
 const invalid=clone(loopRecords);const index=invalid.findIndex(record=>record.decoded.tool_call_lifecycle?.tool_call_id==='result-write'&&record.decoded.tool_call_lifecycle.args_complete);invalid.splice(index,0,clone(invalid[index]));
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/execution-args-not-observed-once/);
});
test('route execution arguments must occur after their own started event',()=>{
 const invalid=clone(loopRecords);const index=invalid.findIndex(record=>record.decoded.tool_call_lifecycle?.tool_call_id==='result-write'&&record.decoded.tool_call_lifecycle.args_complete);const [complete]=invalid.splice(index,1);invalid.splice(index-1,0,complete);
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/write-outside-own-stage/);
});
test('route execution arguments must occur before their own terminal event',()=>{
 const invalid=clone(loopRecords);const index=invalid.findIndex(record=>record.decoded.tool_call_lifecycle?.tool_call_id==='result-write'&&record.decoded.tool_call_lifecycle.args_complete);const [complete]=invalid.splice(index,1);invalid.splice(index+1,0,complete);
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/write-outside-own-stage/);
});
test('correct durable path and content cannot replace wrong actually executed arguments',()=>{
 const invalid=clone(loopRecords);changeWrite(invalid,'result-write',{file_path:path.join('other',loopFixture.outputName),content:'{"incorrect":true}'});
 const persisted=envelope('corrected-projection',4,'ASSISTANT',[{tool_call_block:{tool_call_id:'result-write',tool_name:'file_write',arguments_json:JSON.stringify(writeArgs(loopFixture.outputName))}}]);persisted.decoded.session_id='route-session';invalid.push(persisted);
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/execution-and-durable-arguments-disagree/);
});
test('an early shell prefill plus a different directory write cannot pass post-hoc files',()=>{
 oracle.verifyFiles(routeWorkspace,loopFixture);
 const invalid=clone(loopRecords);changeWrite(invalid,'result-write',{file_path:path.join('other',loopFixture.outputName)});
 invalid.unshift(start('prefill','shell_run',{command:`printf '%s' ${JSON.stringify(JSON.stringify(loopFixture.outputs[loopFixture.outputName]))} > ${JSON.stringify(path.join(routeWorkspace,loopFixture.outputName))}`}),done('prefill'));
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/unregistered-writer-or-shell/);
});
test('a stage-local write to another directory with the same basename is rejected',()=>{
 const invalid=clone(loopRecords);changeWrite(invalid,'result-write',{file_path:path.join('other',loopFixture.outputName)});
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/target-not-declared/);
});
test('a filename occurring only inside content is not a target-path match',()=>{
 const invalid=clone(loopRecords);changeWrite(invalid,'result-write',{file_path:'decoy.json',content:JSON.stringify({mentions:loopFixture.outputName})});
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/target-not-declared/);
});
test('correct post-hoc files cannot hide incorrect file_write content',()=>{
 const invalid=clone(loopRecords);changeWrite(invalid,'result-write',{content:JSON.stringify({nonce:'wrong',twice:-1})});
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/content-differs-from-oracle/);
});
test('an extra early exact file_write is not hidden by a later valid stage write',()=>{
 const invalid=clone(loopRecords);invalid.unshift(start('early-write','file_write',writeArgs(loopFixture.outputName)),argsComplete('early-write',writeArgs(loopFixture.outputName)),done('early-write'));
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/not-written-exactly-once/);
});
test('a missing file_path cannot be supplied by a content substring',()=>{
 const invalid=clone(loopRecords);changeWrite(invalid,'result-write',{file_path:undefined,content:loopFixture.outputName});
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/file-path-missing-or-invalid/);
});
const outside=path.join(process.env.SCENARIO_WORKSPACE,'outside-route');fs.mkdirSync(outside);
fs.writeFileSync(path.join(outside,loopFixture.outputName),JSON.stringify(loopFixture.outputs[loopFixture.outputName]));
fs.symlinkSync(outside,path.join(routeWorkspace,'escape'),'dir');
test('a symlink directory escaping the route workspace is rejected',()=>{
 const invalid=clone(loopRecords);changeWrite(invalid,'result-write',{file_path:path.join('escape',loopFixture.outputName)});
 assert.throws(()=>oracle.verifyRoute('U10',invalid,loopFixture),/file-path-symlink/);
});
test('a symlink final artifact cannot pass the independent file oracle',()=>{
 const target=path.join(routeWorkspace,loopFixture.outputName);fs.unlinkSync(target);fs.symlinkSync(path.join(outside,loopFixture.outputName),target);
 try{assert.throws(()=>oracle.verifyFiles(routeWorkspace,loopFixture),/file-path-symlink/);}
 finally{fs.unlinkSync(target);fs.writeFileSync(target,JSON.stringify(loopFixture.outputs[loopFixture.outputName]),{flag:'wx'});}
});
test('dot-dot aliases cannot hide a symlink traversal',()=>{
 assert.throws(()=>oracle.canonicalTaskFile(routeWorkspace,['escape','..',loopFixture.outputName].join(path.sep)),/file-path-symlink|file-path-traversal/);
});
const spawnWorkspace=path.join(process.env.SCENARIO_WORKSPACE,'spawn-controls');fs.mkdirSync(spawnWorkspace);
const spawnFixture=oracle.prepareFixture(spawnWorkspace,'U08','spawn-control');
const activity=(id,name,args)=>({decoded:{sub_agent_activity:{parent_tool_call_id:'spawn',sub_agent_id:'owned-child',append_entry:{tool_invocation:{tool_call_id:id,tool_name:name,args_json:JSON.stringify(args)}}}}});
const spawnRecords=[start('spawn','agent_spawn'),activity('child-read','file_read',{file_path:spawnFixture.inputName}),
 activity('child-write','file_write',{file_path:spawnFixture.outputName,content:JSON.stringify(spawnFixture.outputs[spawnFixture.outputName])}),
 {decoded:{sub_agent_completed:{sub_agent_id:'owned-child',parent_tool_call_id:'spawn',outcome:'SUB_AGENT_RUNTIME_STATUS_SUCCESS',output:'child completed its own result'}}},done('spawn')];
for(const record of spawnRecords)record.decoded.session_id='route-session';
test('spawn control ties child work to exact workspace paths and independent content',()=>{oracle.verifyRoute('U08',spawnRecords,spawnFixture);});
test('spawn cannot substitute another directory having the expected basename',()=>{
 const invalid=clone(spawnRecords);invalid[2].decoded.sub_agent_activity.append_entry.tool_invocation.args_json=JSON.stringify({file_path:path.join('other',spawnFixture.outputName),content:JSON.stringify(spawnFixture.outputs[spawnFixture.outputName])});
 assert.throws(()=>oracle.verifyRoute('U08',invalid,spawnFixture),/child-owned-work-not-observed/);
});
const deepWorkspace=path.join(process.env.SCENARIO_WORKSPACE,'deep-controls');fs.mkdirSync(deepWorkspace);
const deepFixture=oracle.prepareFixture(deepWorkspace,'U09','deep-control');
const deepRecords=[start('deep','deep_think'),{decoded:{deep_think_started:{tool_call_id:'deep',request_id:'owned-request',dimensions:['durability','latency']}}},
 {decoded:{deep_think_dimension_started:{tool_call_id:'deep',request_id:'owned-request',dimension:'durability'}}},
 {decoded:{deep_think_dimension_completed:{tool_call_id:'deep',request_id:'owned-request',dimension:'durability',success:true,result:'replica check'}}},
 {decoded:{deep_think_dimension_started:{tool_call_id:'deep',request_id:'owned-request',dimension:'latency'}}},
 {decoded:{deep_think_dimension_completed:{tool_call_id:'deep',request_id:'owned-request',dimension:'latency',success:true,result:'latency check'}}},
 {decoded:{deep_think_completed:{tool_call_id:'deep',request_id:'owned-request',aggregated_result:'both dimensions synthesized'}}},done('deep'),
 start('deep-result','file_write',{file_path:deepFixture.outputName,content:JSON.stringify(deepFixture.outputs[deepFixture.outputName])}),
 argsComplete('deep-result',{file_path:deepFixture.outputName,content:JSON.stringify(deepFixture.outputs[deepFixture.outputName])}),done('deep-result'),
 {decoded:{turn_lifecycle:{turn_completed:{agent_id:'root',turn_id:'root-turn'}}}}];
for(const record of deepRecords)record.decoded.session_id='route-session';
test('deep_think control writes the exact decision only after both dimensions',()=>{oracle.verifyRoute('U09',deepRecords,deepFixture);});
test('deep_think cannot use a same-basename file outside the declared target',()=>{
 const invalid=clone(deepRecords);changeWrite(invalid,'deep-result',{file_path:path.join('other',deepFixture.outputName)});
 assert.throws(()=>oracle.verifyRoute('U09',invalid,deepFixture),/target-not-declared/);
});
const foldId='fold:preamble';
function foldDom(status='running',payload=''){const value=clone(dom);value.rows=[{...value.rows[2],rootId:foldId,status,payload}];value.folds=[{id:foldId,expanded:true}];return value;}
const runningRecords=records.slice(0,3);
function openedFold(source=runningRecords,display=foldDom()){const observation=oracle.beginFoldObservation(source,'fixture-session',foldId,display);assert.ok(observation,'opening baseline must include known real owners');return observation;}
test('own tool content and DOM completion advance the selected fold',()=>{
 const observation=openedFold();oracle.advanceFoldObservation(observation,records,foldDom('completed',fixture.inputs[fixture.inputName]));
 oracle.verifyFoldCoverage([observation]);
});
test('heartbeat-only frames cannot satisfy fold persistence coverage',()=>{
 const observation=openedFold();oracle.advanceFoldObservation(observation,[...runningRecords,{decoded:{session_id:'fixture-session',heartbeat:{server_mono_ms:'999'}}}],foldDom());
 assert.equal(observation.advanced,false);assert.throws(()=>oracle.verifyFoldCoverage([observation]),/content-increment-uncovered/);
});
test('subscription health-only frames cannot advance the fold',()=>{
 const observation=openedFold();oracle.advanceFoldObservation(observation,[...runningRecords,{decoded:{session_id:'fixture-session',subscription_health:{phase:'LIVE'}}}],foldDom());
 assert.equal(observation.advanced,false);
});
test('another session completion cannot advance this fold even if its DOM changes',()=>{
 const observation=openedFold();const foreign=clone(records.slice(3));for(const item of foreign)item.decoded.session_id='other-session';
 oracle.advanceFoldObservation(observation,[...runningRecords,...foreign],foldDom('completed',fixture.inputs[fixture.inputName]));assert.equal(observation.advanced,false);
});
test('another fold in the same session cannot advance this fold',()=>{
 const observation=openedFold();const otherArgs=JSON.stringify({file_path:'second.json'});
 const foreign=[{decoded:{session_id:'fixture-session',tool_call_lifecycle:{tool_call_id:'other-call',started:{tool_name:'file_read',args_json:otherArgs}}}},
  envelope('other-envelope',8,'ASSISTANT',[{tool_call_block:{tool_call_id:'other-call',tool_name:'file_read',arguments_json:otherArgs}}])];
 const display=foldDom();display.rows.push(row('other-envelope','tool',1,'file_read',{rootId:'fold:other',inFold:true,toolName:'file_read',status:'running',payload:''}));display.folds.push({id:'fold:other',expanded:true});
 oracle.advanceFoldObservation(observation,[...runningRecords,...foreign],display);assert.equal(observation.advanced,false);
});
test('learning a pre-existing row after opening is not a content increment',()=>{
 const otherArgs=JSON.stringify({file_path:'old-second.json'});
 const alreadyThere=[...runningRecords,{decoded:{session_id:'fixture-session',tool_call_lifecycle:{tool_call_id:'old-call',started:{tool_name:'file_read',args_json:otherArgs}}}},
  envelope('old-envelope',8,'ASSISTANT',[{tool_call_block:{tool_call_id:'old-call',tool_name:'file_read',arguments_json:otherArgs}}])];
 const observation=openedFold(alreadyThere);const display=foldDom();display.rows.push(row('old-envelope','tool',1,'file_read',{rootId:foldId,inFold:true,toolName:'file_read',status:'running',payload:''}));
 oracle.advanceFoldObservation(observation,[...alreadyThere,{decoded:{session_id:'fixture-session',heartbeat:{server_mono_ms:'1000'}}}],display);assert.equal(observation.advanced,false);
});
test('a DOM clock tick plus heartbeat cannot count as owned content',()=>{
 const observation=openedFold();const display=foldDom();display.rows[0].text='file_read Running 5s';display.rows[0].argumentsText+=' 5s';
 oracle.advanceFoldObservation(observation,[...runningRecords,{decoded:{session_id:'fixture-session',heartbeat:{server_mono_ms:'1001'}}}],display);assert.equal(observation.advanced,false);
});
test('source completion waits for the correlated DOM content to catch up',()=>{
 const observation=openedFold();oracle.advanceFoldObservation(observation,records,foldDom());assert.equal(observation.advanced,false);
 oracle.advanceFoldObservation(observation,[...records,{decoded:{session_id:'fixture-session',heartbeat:{server_mono_ms:'1002'}}}],foldDom('completed',fixture.inputs[fixture.inputName]));
 oracle.verifyFoldCoverage([observation]);
});
test('a new post-opening call genuinely appended to this fold is an increment',()=>{
 const observation=openedFold();const args=JSON.stringify({file_path:'new-second.json'});
 const appended=[...runningRecords,{decoded:{session_id:'fixture-session',tool_call_lifecycle:{tool_call_id:'new-call',started:{tool_name:'file_read',args_json:args}}}},
  envelope('new-envelope',8,'ASSISTANT',[{tool_call_block:{tool_call_id:'new-call',tool_name:'file_read',arguments_json:args}}])];
 const display=foldDom();display.rows.push(row('new-envelope','tool',1,'file_read',{rootId:foldId,inFold:true,toolName:'file_read',status:'running',payload:''}));
 oracle.advanceFoldObservation(observation,appended,display);oracle.verifyFoldCoverage([observation]);
});
test('an owned content update that collapses the chosen fold is rejected',()=>{
 const observation=openedFold();const display=foldDom('completed',fixture.inputs[fixture.inputName]);display.folds[0].expanded=false;
 oracle.advanceFoldObservation(observation,records,display);assert.throws(()=>oracle.verifyFoldCoverage([observation]),/expansion-reset-after-selection/);
});
(async () => {
 const grpc = require(path.join(process.env.SCENARIO_REPO,'node_modules/@grpc/grpc-js'));
 const original = grpc.Client.prototype.makeBidiStreamRequest;
 let capturedDecoder;
 let originalCalls=0;
 grpc.Client.prototype.makeBidiStreamRequest=function(_method,_serialize,deserialize) {originalCalls++;capturedDecoder=deserialize;return {fixtureOnly:true};};
 const token='offline-fixture-owned-token';
 try {
  await oracle.installMainTap(null,{token,packageJson:path.join(process.env.SCENARIO_REPO,'package.json'),address:'127.0.0.1:50081'});
  const bytes=Buffer.from([1,2,3]);let decoderCalls=0;
  const receiver={getChannel:()=>({getTarget:()=> 'dns:127.0.0.1:50081'})};
  grpc.Client.prototype.makeBidiStreamRequest.call(receiver,'/agentservice.SessionService/SessionEventStream',()=>{},function(actual) {
   decoderCalls++;assert.equal(actual,bytes);assert.equal(this,receiver);return 'unchanged';
  });
  test('raw tap forwards original Buffer and decoder receiver exactly once',()=>{
   assert.equal(capturedDecoder.call(receiver,bytes),'unchanged');assert.equal(decoderCalls,1);assert.equal(originalCalls,1);
   const observation=oracle.drainMainTap(null,{token});assert.equal(observation.frames.length,1);
   assert.equal(observation.frames[0].bytesBase64,bytes.toString('base64'));
  });
  let throwCalls=0;
  grpc.Client.prototype.makeBidiStreamRequest.call(receiver,'/agentservice.SessionService/SessionEventStream',()=>{},()=>{throwCalls++;throw new Error('original decoder failure');});
  test('decoder errors propagate without a second invocation',()=>{
   assert.throws(()=>capturedDecoder.call(receiver,bytes),/original decoder failure/);assert.equal(throwCalls,1);
  });
  oracle.drainMainTap(null,{token,restore:true});
  test('restored active-stream decoder remains transparent',()=>{
   assert.throws(()=>capturedDecoder.call(receiver,bytes),/original decoder failure/);assert.equal(throwCalls,2);
  });
 } finally {
  if(globalThis.__uaRealEditorRawTap) oracle.drainMainTap(null,{token,restore:true});
  grpc.Client.prototype.makeBidiStreamRequest=original;
 }
 console.log(JSON.stringify(results));process.exitCode=results.every(result=>result.passed)?0:1;
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
'''


class RealEditorMatrixOracleTest(unittest.TestCase):
    def test_verifier_negative_controls_without_engine_or_ui(self):
        with tempfile.TemporaryDirectory(prefix="real-editor-matrix-oracle-") as temporary:
            env = dict(os.environ, SCENARIO_REPO=str(REPO_ROOT), SCENARIO_WORKSPACE=temporary)
            completed = subprocess.run(["node", "-"], input=MATRIX_ORACLE_FIXTURE,
                                       env=env, text=True, capture_output=True, timeout=30)
            self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
            cases = json.loads(completed.stdout)
            self.assertEqual(len(cases), 76)
            for case in cases:
                with self.subTest(case=case["name"]):
                    self.assertTrue(case["passed"], case.get("error"))


# Deterministic clocks and deferred promises exercise deadline behavior only.
# They never launch the editor or provide engine/model acceptance evidence.
MATRIX_BUDGET_FIXTURE = r'''
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const oracle=require(path.join(process.env.SCENARIO_REPO,'test/scenario/scenarios/universe-agent-real-editor-oracle.cjs'));
const results=[];
async function test(name,run){try{await run();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack||String(error)});}}
const clone=value=>JSON.parse(JSON.stringify(value));
let serial=0;
function harness(caseId='U01',offsetMs=0){
 const root=path.join(process.env.SCENARIO_WORKSPACE,`budget-${++serial}`);fs.mkdirSync(root);
 const start=1000000000000n;let now=start+BigInt(offsetMs)*1000000n;
 const budget=oracle.budgetForCase(caseId);
 const hash=oracle.sha256(JSON.stringify(budget,Object.keys(budget).sort()));
 const identity={campaignId:'campaign',cellId:'flash-anthropic',caseId,nonce:`attempt-${serial}`,budget,budgetSha256:hash,
  clock:{bootId:'offline-clock-boot',setupStartedMonoNs:String(start),setupDeadlineMonoNs:String(start+60000000000n)}};
 const env={UA_REAL_EDITOR_BUDGET_SHA256:hash,UA_REAL_EDITOR_BOOT_ID:identity.clock.bootId,
  UA_REAL_EDITOR_SETUP_STARTED_MONO_NS:identity.clock.setupStartedMonoNs,UA_REAL_EDITOR_SETUP_DEADLINE_MONO_NS:identity.clock.setupDeadlineMonoNs,
  UA_REAL_EDITOR_BUDGET_PROGRESS_FILE:path.join(root,'budget-progress.json'),UA_REAL_EDITOR_CLEANUP_BUDGET_FILE:path.join(root,'cleanup-budget.json')};
 const config=oracle.validateBudgetIdentity(env,identity,root,now,identity.clock.bootId);
 const timers=new Map();const publications=[];let timerId=0;
 const controller=oracle.createBudgetController(identity,config,{nowNs:()=>now,
  setTimer:(callback,ms)=>{const id=++timerId;timers.set(id,{callback,ms,at:now+BigInt(ms)*1000000n});return id;},
  clearTimer:id=>timers.delete(id),publish:value=>publications.push(clone(value))});
 return{root,start,identity,env,config,controller,timers,publications,now:()=>now,
  advance:ms=>now+=BigInt(ms)*1000000n,setNow:value=>now=value,
  fire:()=>{for(const[id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.callback();}}};
}
(async()=>{
await test('all cases retain the fixed episode and watchdog equations',()=>{
 for(let index=1;index<=10;index++){const budget=oracle.budgetForCase(`U${String(index).padStart(2,'0')}`);
  assert.equal(budget.episodeMs,600000);assert.equal(budget.setupMs,60000);assert.equal(budget.finalizationMs,60000);assert.equal(budget.cleanupMs,60000);
  assert.equal(budget.caseBudgetMs,budget.setupMs+budget.episodeCount*budget.episodeMs+budget.historyMs+budget.finalizationMs);
  assert.equal(budget.watchdogMs,budget.caseBudgetMs+budget.cleanupMs);}
 assert.equal(oracle.budgetForCase('U01').watchdogMs,780000);assert.equal(oracle.budgetForCase('U02').watchdogMs,1380000);assert.equal(oracle.budgetForCase('U07').watchdogMs,4500000);
});
await test('U07 preregisters seven actual episode labels and one history phase',()=>{
 assert.deepEqual(oracle.budgetForCase('U07').episodeLabels,['U01','U02','U02:followup','U08','U09','U10','U06']);
 assert.equal(oracle.budgetForCase('U07').historyMs,120000);
});
await test('exact clock and budget identities validate',()=>{const h=harness();assert.equal(h.config.budgetSha256,h.identity.budgetSha256);});
await test('environment cannot override the frozen budget hash',()=>{
 const h=harness();assert.throws(()=>oracle.validateBudgetIdentity({...h.env,UA_REAL_EDITOR_BUDGET_SHA256:'0'.repeat(64)},h.identity,h.root,h.now(),h.identity.clock.bootId),/policy-identity/);
});
await test('oracle cannot increase the episode budget',()=>{
 const h=harness();const changed=clone(h.identity);changed.budget.episodeMs++;
 assert.throws(()=>oracle.validateBudgetIdentity(h.env,changed,h.root,h.now(),h.identity.clock.bootId),/policy-identity/);
});
await test('a different boot cannot share a monotonic clock identity',()=>{
 const h=harness();assert.throws(()=>oracle.validateBudgetIdentity(h.env,h.identity,h.root,h.now(),'other-boot'),/boot-id/);
});
await test('setup clock environment cannot diverge from the oracle',()=>{
 const h=harness();assert.throws(()=>oracle.validateBudgetIdentity({...h.env,UA_REAL_EDITOR_SETUP_DEADLINE_MONO_NS:String(h.now()+1n)},h.identity,h.root,h.now(),h.identity.clock.bootId),/setup-clock-identity/);
});
await test('a future setup start does not establish the common clock range',()=>{
 const h=harness();assert.throws(()=>oracle.validateBudgetIdentity(h.env,h.identity,h.root,h.start-1n,h.identity.clock.bootId),/monotonic-domain/);
});
await test('nanoseconds must remain exact decimal strings',()=>{
 const h=harness();const changed=clone(h.identity);changed.clock.setupStartedMonoNs=1e12;
 assert.throws(()=>oracle.validateBudgetIdentity({...h.env,UA_REAL_EDITOR_SETUP_STARTED_MONO_NS:1e12},changed,h.root,h.now(),h.identity.clock.bootId),/setup-start-invalid/);
});
await test('CJS inherits only the remaining setup time from the wrapper',async()=>{
 const h=harness('U01',45000);assert.equal(h.controller.remaining('hello'),15000);
 await h.controller.operation('hello',remaining=>{assert.equal(remaining,15000);});
 assert.equal(h.controller.current().phaseDeadlineMonoNs,h.identity.clock.setupDeadlineMonoNs);
});
await test('an already exhausted setup invokes no underlying operation',async()=>{
 const h=harness('U01',60000);let called=false;
 await assert.rejects(h.controller.operation('hello',()=>{called=true;}),/budget-timeout:setup:hello/);
 assert.equal(called,false);assert.throws(()=>h.controller.next(),/budget-timeout/);
});
await test('permission and terminal polls share one episode deadline',async()=>{
 const h=harness();h.controller.next();h.advance(590000);
 await h.controller.operation('permission',remaining=>assert.equal(remaining,10000));h.advance(9999);
 await h.controller.operation('terminal-poll',remaining=>assert.equal(remaining,1));h.advance(1);
 let called=false;await assert.rejects(h.controller.operation('scroll',()=>{called=true;}),/budget-timeout:episode:scroll/);assert.equal(called,false);
 assert.equal(h.controller.snapshot().timeout.episodeLabel,'U01');assert.equal(h.controller.snapshot().timeout.operation,'scroll');
});
await test('positive fractional milliseconds never turn into timeout zero',async()=>{
 const h=harness();h.setNow(BigInt(h.controller.current().phaseDeadlineMonoNs)-1n);
 await h.controller.operation('one-nanosecond-left',remaining=>assert.equal(remaining,1));
});
await test('a resolve after the stage deadline cannot become a pass',async()=>{
 const h=harness();h.controller.next();
 await assert.rejects(h.controller.operation('late-evaluate',()=>{h.advance(600000);return 'too late';}),/budget-timeout/);
 assert.throws(()=>h.controller.next(),/budget-timeout/);assert.equal(h.controller.snapshot().completedEpisodeCount,0);
});
await test('unresolved evaluate is bounded and its late resolve cannot start another episode',async()=>{
 const h=harness('U02');h.controller.next();let release;let laterOperation=false;
 const pending=h.controller.operation('main-evaluate',()=>new Promise(resolve=>{release=resolve;}));
 await Promise.resolve();h.advance(600000);h.fire();await assert.rejects(pending,/budget-timeout/);
 release('late raw frames');await Promise.resolve();
 assert.throws(()=>h.controller.next(),/budget-timeout/);
 await assert.rejects(h.controller.operation('next-send',()=>{laterOperation=true;}),/budget-timeout/);assert.equal(laterOperation,false);
});
await test('a native timeout at the deadline is classified as the stage timeout',async()=>{
 const h=harness();h.controller.next();await assert.rejects(h.controller.operation('native-wait',()=>{h.advance(600000);throw new Error('native timeout');}),/budget-timeout:episode:native-wait/);
});
await test('successful operations clear their deadline timer',async()=>{
 const h=harness();await h.controller.operation('quick',()=>42);assert.equal(h.timers.size,0);
});
await test('U02 episode two gets its own budget without recreating setup',()=>{
 const h=harness('U02');h.controller.next();h.advance(123);h.controller.next();
 h.controller.expect('episode','U02:followup');assert.equal(h.controller.remaining('send'),600000);
 const state=h.controller.snapshot();assert.equal(state.startedEpisodeCount,2);assert.equal(state.completedEpisodeCount,1);assert.equal(state.budgetStages.filter(stage=>stage.phase==='setup').length,1);
});
await test('an out-of-order or invented episode label cannot run',()=>{
 const h=harness('U07');h.controller.next();assert.throws(()=>h.controller.expect('episode','U08'),/stage-or-episode-order/);
});
await test('U07 runs all seven episodes before the single history phase',()=>{
 const h=harness('U07');h.controller.next();
 for(const label of h.config.budget.episodeLabels){h.controller.expect('episode',label);h.advance(1);h.controller.next();}
 h.controller.expect('history');assert.equal(h.controller.remaining('history'),120000);
 const state=h.controller.snapshot();assert.equal(state.startedEpisodeCount,7);assert.equal(state.completedEpisodeCount,7);
 assert.deepEqual(h.publications.at(-1).budgetStages.map(stage=>stage.phase),['setup',...Array(7).fill('episode'),'history']);
 for(let i=1;i<state.budgetStages.length;i++)assert.equal(state.budgetStages[i-1].endedMonoNs,state.budgetStages[i].phaseStartedMonoNs);
});
await test('snapshot switch reload and visibility share the history deadline',async()=>{
 const h=harness('U07');h.controller.next();for(let i=0;i<7;i++)h.controller.next();
 h.advance(110000);await h.controller.operation('history-reload',remaining=>assert.equal(remaining,10000));
 h.advance(10000);await assert.rejects(h.controller.operation('history-visible',()=>true),/budget-timeout:history/);
 assert.equal(h.controller.snapshot().timeout.phase,'history');
});
await test('finalization receives exactly one separate minute',async()=>{
 const h=harness();h.controller.next();h.advance(599999);h.controller.next();h.controller.expect('finalization');
 assert.equal(h.controller.remaining('thinking'),60000);h.advance(60000);
 await assert.rejects(h.controller.operation('thinking',()=>true),/budget-timeout:finalization/);
});
await test('completion cannot skip required business stages',()=>{
 const h=harness('U07');h.controller.next();assert.throws(()=>h.controller.beginCleanup(true),/incomplete-business-stages/);
});
await test('cleanup is claimed once and subsequent calls cannot extend it',()=>{
 const h=harness();h.controller.beginCleanup(false);const first=JSON.parse(fs.readFileSync(h.config.cleanupFile));
 h.advance(10000);h.controller.beginCleanup(false);assert.deepEqual(JSON.parse(fs.readFileSync(h.config.cleanupFile)),first);
 assert.equal(h.controller.remaining('restore'),50000);assert.throws(()=>h.controller.next(),/unregistered-stage/);
});
await test('an externally claimed cleanup poisons further business operations',async()=>{
 const h=harness();oracle.claimCleanupBudget(h.config.cleanupFile,h.identity,h.config,h.now(),h.now);
 let called=false;await assert.rejects(h.controller.operation('send',()=>{called=true;}),/cleanup-already-started/);assert.equal(called,false);
 h.controller.beginCleanup(false);assert.equal(h.controller.current().phase,'cleanup');
});
await test('cleanup claim losers read the immutable winner without resetting it',()=>{
 const h=harness();const first=oracle.claimCleanupBudget(h.config.cleanupFile,h.identity,h.config,h.now(),h.now);
 h.advance(9000);const second=oracle.claimCleanupBudget(h.config.cleanupFile,h.identity,h.config,h.now(),h.now);assert.deepEqual(second,first);
 assert.equal(fs.readdirSync(h.root).filter(name=>name.endsWith('.claim')).length,0);
});
await test('cleanup publication exposes complete JSON and refuses an alien identity',()=>{
 const h=harness();oracle.claimCleanupBudget(h.config.cleanupFile,h.identity,h.config,h.now(),h.now);
 assert.throws(()=>oracle.claimCleanupBudget(h.config.cleanupFile,{...h.identity,nonce:'alien'},h.config,h.now(),h.now),/identity-mismatch:nonce/);
 assert.equal(JSON.parse(fs.readFileSync(h.config.cleanupFile)).nonce,h.identity.nonce);
});
await test('a legitimate concurrent cleanup winner may publish just after the losing caller began',()=>{
 const h=harness();const callerAt=h.now();h.advance(1);const winner=oracle.claimCleanupBudget(h.config.cleanupFile,h.identity,h.config,h.now(),h.now);
 const loser=oracle.claimCleanupBudget(h.config.cleanupFile,h.identity,h.config,callerAt,h.now);assert.deepEqual(loser,winner);
});
await test('cleanup after the watchdog receives no new grace interval',()=>{
 const h=harness();h.advance(h.config.budget.watchdogMs+1);h.controller.beginCleanup(false);
 const claim=JSON.parse(fs.readFileSync(h.config.cleanupFile));assert.equal(claim.cleanupDeadlineMonoNs,String(h.start+BigInt(h.config.budget.watchdogMs)*1000000n));
 assert.throws(()=>h.controller.remaining('owned-reap'),/budget-timeout:cleanup/);
});
await test('cleanup timeout cannot be followed by a new business stage',async()=>{
 const h=harness();h.controller.beginCleanup(false);h.advance(60000);
 await assert.rejects(h.controller.operation('restore',()=>true),/budget-timeout:cleanup/);
 assert.throws(()=>h.controller.next(),/budget-timeout/);assert.equal(h.controller.snapshot().startedEpisodeCount,0);
});
await test('normal finalization enters the same shared cleanup deadline as tap restore',async()=>{
 const h=harness();h.controller.next();h.controller.next();h.controller.beginCleanup(true);
 h.advance(12000);await h.controller.operation('restore',remaining=>assert.equal(remaining,48000));h.controller.finishCleanup();
 assert.equal(h.controller.snapshot().budgetStages.at(-1).status,'completed');assert.equal(h.controller.snapshot().completedEpisodeCount,1);
 assert.throws(()=>h.controller.next(),/stage-already-closed/);
});
console.log(JSON.stringify(results));process.exitCode=results.every(result=>result.passed)?0:1;
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
'''


class RealEditorMatrixBudgetTest(unittest.TestCase):
    def test_fixed_stage_deadlines_without_engine_or_ui(self):
        with tempfile.TemporaryDirectory(prefix="real-editor-matrix-budget-") as temporary:
            env = dict(os.environ, SCENARIO_REPO=str(REPO_ROOT), SCENARIO_WORKSPACE=temporary)
            completed = subprocess.run(["node", "-"], input=MATRIX_BUDGET_FIXTURE,
                                       env=env, text=True, capture_output=True, timeout=30)
            self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
            cases = json.loads(completed.stdout)
            self.assertEqual(len(cases), 31)
            for case in cases:
                with self.subTest(case=case["name"]):
                    self.assertTrue(case["passed"], case.get("error"))


if __name__ == "__main__":
    unittest.main()
