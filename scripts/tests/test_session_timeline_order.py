#!/usr/bin/env python3
"""Replay numeric engine sequence ordering through Node Actor and Chromium Host."""

import json
import os
import signal
from pathlib import Path
import subprocess
import tempfile
import unittest

REPO_ROOT = Path(__file__).resolve().parents[2]

FIXTURE = r'''
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const repo = process.env.SCENARIO_REPO;
const { chromium } = require(path.join(repo, 'node_modules/@playwright/test'));
const out = path.join(repo, 'out');
const load = relative => import(pathToFileURL(path.join(out, relative)));

(async () => {
 const { SessionActor } = await load('vs/platform/universeAgent/node/sessionCore/session-actor.js');
 const { demuxSessionStreamPayload } = await load('vs/platform/universeAgent/node/sessionStreamDemux.js');
 const { historyFillRowFromGetHistoryEnvelope } = await load('vs/platform/universeAgent/node/sessionViewHostHistoryFill.js');
 const envelopes = [
  { id:'user', seq:3, role:'USER', turn_id:'user-turn', blocks:[{block_type:1,text_block:{text:'Read fixture'}}] },
  { id:'preamble', seq:5, role:'ASSISTANT', turn_id:'preamble-turn', blocks:[{block_type:1,text_block:{text:'I will read it.'}},{block_type:2,tool_call_block:{tool_call_id:'call',tool_name:'file_read',arguments_json:'{}'}}] },
  { id:'tool-result', seq:7, role:'TOOL', turn_id:'tool-turn', blocks:[{block_type:3,tool_result_block:{tool_call_id:'call',tool_name:'file_read',content:'fixture',is_error:false}}] },
  { id:'final', seq:12, role:'ASSISTANT', turn_id:'final-turn', blocks:[{block_type:1,text_block:{text:'FINAL_FIXTURE_MARKER'}}] }
 ];
 const variants = [];
 for (const route of ['live','history']) {
  const intents = [], snapshots = []; let serial = 0;
  const next = () => `${route}:${++serial}`;
  const actor = new SessionActor({sessionId:'session',ids:{nextChunkId:next,nextEffectId:next,nextAttemptId:next,nextWriteId:next},diagnostics:{count(){},warn(){}},mailboxCapacity:64,lingerMs:30000,chatFlushTimeoutMs:30000,chatTurnWatchMs:30000,emitIntent:intent=>intents.push(intent)});
  actor.enqueue({t:'acquireLease',leaseId:'lease',sink:{enqueue(){},acknowledge(){}}});
  actor.enqueue({t:'connectionUp',connectionGeneration:1});
  const attemptId = intents.find(intent=>intent.do==='openStream').attemptId;
  for (const envelope of envelopes) {
   const events = route==='live' ? demuxSessionStreamPayload({envelope_appended:{envelope}}) : [historyFillRowFromGetHistoryEnvelope({cursorSeq:String(envelope.seq),payload:envelope})];
   for (const event of events) assert.equal(actor.enqueue({t:'streamEvent',attemptId,event}),true);
   snapshots.push(structuredClone(actor.snapshot));
  }
  assert(actor.snapshot.timeline.some(item=>item.id==='final'));
  variants.push({route,snapshots});
 }
 const server = http.createServer((request,response)=>{
  const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  if(pathname==='/'){response.setHeader('content-type','text/html; charset=utf-8');response.end('<!doctype html><html></html>');return;}
  // Styles do not participate in this ordering/mounting regression.
  if(pathname.endsWith('.css')){response.setHeader('content-type','text/javascript');response.end('export {};');return;}
  const filename=path.join(out,pathname);
  if(!filename.startsWith(out+path.sep)){response.statusCode=403;response.end();return;}
  response.setHeader('content-type','text/javascript');fs.createReadStream(filename).on('error',()=>{response.statusCode=404;response.end();}).pipe(response);
 });
 let browser;
 try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  process.once('SIGTERM',()=>void browser.close().finally(()=>process.exit(143)));
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port);
  const results=await page.evaluate(async variants=>{
   const {projectSnapshotToEntries}=await import('/vs/workbench/contrib/conversation/browser/conversationSessionView.js');
   const {ConversationTimelineHost}=await import('/vs/workbench/contrib/conversation/browser/conversationTimelineHost.js');
   const attribution=new Map([['user',{role:'user'}],['preamble',{role:'assistant'}],['final',{role:'assistant'}]]);
   return variants.map(({route,snapshots})=>{
    const parent=document.createElement('div');document.body.appendChild(parent);
    const host=new ConversationTimelineHost(parent,{contentAdapter:{renderTurnBody(turn,container){container.textContent=turn.text;return {dispose(){}};}}},{createInstance(){throw new Error('unexpected dependency');},invokeFunction(){}},{});
    try {
     host.show();let entries;
     // Establish the existing user/preamble/tool window before the later final answer.
     for(const snapshot of snapshots.slice(0,3)){entries=projectSnapshotToEntries(snapshot,attribution,new Map());host.applyEntries(entries,{kind:'baseline'});}
     const before=Array.from(host.domNode.querySelectorAll('article[data-root-id]'),node=>node.getAttribute('data-root-id'));
     entries=projectSnapshotToEntries(snapshots[3],attribution,new Map());host.applyEntries(entries,{kind:'patches',changedIds:new Set(['final'])});
     const after=Array.from(host.domNode.querySelectorAll('article[data-root-id]'),node=>node.getAttribute('data-root-id'));
     return {route,before,entryIds:entries.map(entry=>entry.id),after,finalText:host.domNode.querySelector('[data-root-id="final"]')?.textContent};
    }finally{host.dispose();parent.remove();}
   });
  },variants);
  console.log(JSON.stringify(results));
  for(const result of results){assert.deepEqual(result.before,['user','preamble:body','fold:preamble']);assert.deepEqual(result.entryIds,['user','preamble:body','preamble','final'],result.route+' entry sequence');assert.deepEqual(result.after,['user','preamble:body','fold:preamble','final'],result.route+' mounted sequence');assert(result.finalText.includes('FINAL_FIXTURE_MARKER'));}
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
'''


class SessionTimelineOrderTest(unittest.TestCase):
    def test_actor_projection_and_chromium_host_keep_later_final_answer(self):
        with tempfile.TemporaryDirectory(prefix="timeline-order-") as temporary:
            process = subprocess.Popen(
                ["node", "-"], text=True, stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                env=dict(os.environ, SCENARIO_REPO=str(REPO_ROOT)),
                cwd=temporary, start_new_session=True,
            )
            try:
                stdout, stderr = process.communicate(FIXTURE, timeout=30)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    stdout, stderr = process.communicate(timeout=2)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    stdout, stderr = process.communicate()
                self.fail("Actor/Chromium fixture timed out: " + stdout + stderr)
            self.assertEqual(process.returncode, 0, stdout + stderr)
            self.assertEqual([row["route"] for row in json.loads(stdout)], ["live", "history"])


if __name__ == "__main__":
    unittest.main()
