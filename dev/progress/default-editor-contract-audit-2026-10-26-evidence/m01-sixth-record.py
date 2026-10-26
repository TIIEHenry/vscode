from pathlib import Path
import hashlib,json,subprocess,shutil,datetime,os,re
repo=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');e=repo/'dev/progress/default-editor-contract-audit-2026-10-26-evidence';sha=lambda b:hashlib.sha256(b).hexdigest();now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
native=json.loads(Path('/tmp/vscode-m01-sixth-native-build.json').read_text());extra=json.loads(Path('/tmp/vscode-m01-sixth-E-related-full.json').read_text())['additionalTestOutputsOutside156Scope'];assert native['exitCode']==0 and len(extra)==7
outputs=[{'sourcePath':x['sourcePath'],'sourceSha256':x['sourceSha256'],'outputPath':x['outputPath'],'outputSha256':x['afterOutputSha256'],'identityOrigin':'actual-full-compile6-156-record'}for x in native['outputs']]+[{**x,'identityOrigin':'actual-E11-additional-output-record-after-full-compile6'}for x in extra]
assert len(outputs)==163 and len({x['outputPath']for x in outputs})==163
for x in outputs:assert sha((repo/x['sourcePath']).read_bytes())==x['sourceSha256']and sha((repo/x['outputPath']).read_bytes())==x['outputSha256']
scope={'phase':'compile6-unfrozen-complete-identity-scope163','sourceHead':native['sourceHead'],'sourceTree':native['sourceTree'],'nativeCompileOrdinal':6,'nativeCompileExit':0,'checkedAtUtc':now(),'originalCompileManifestScope':156,'actualE11AddedScope':7,'outputs':outputs,'all163ActualSourceNativeMatch':True,'outFrozen':False,'claim':'Identity only: M01 runtime24/2 and J410/2 remain failed, no UI/freeze.'};Path('/tmp/vscode-m01-sixth-source-native-scope163.json').write_text(json.dumps(scope,ensure_ascii=False,indent=2)+'\n')
cache=json.loads(Path('/tmp/vscode-m01-fifth-cache-relocation.json').read_text());oldCache=json.loads((e/'m01-fifth-cache-relocation.json').read_text());assert cache['postCompileMirrorInventoryExact']and len(cache['directories'])==3
cacheStatus={'phase':'same-compile-window-owned-ignored-cache-mirrors-still-verified-not-restored','recordedAtUtc':now(),'verificationCompletedAtUtc':cache['postCompileVerifiedAtUtc'],'fullOriginalRepositoryInventory':'dev/progress/default-editor-contract-audit-2026-10-26-evidence/m01-fifth-cache-relocation.json','fullOriginalRepositoryInventorySha256':sha((e/'m01-fifth-cache-relocation.json').read_bytes()),'directories':[],'homeAvailableBytes':os.statvfs(repo).f_bavail*os.statvfs(repo).f_frsize,'tmpAvailableBytes':os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize,'sourceOutEvidenceNotMigrated':True,'parentAuthorizedSameBuildWindowPendingNextRepair':True,'restored':False}
for c,o in zip(cache['directories'],oldCache['directories']):
 assert c['entries']==o['entries']and Path(c['sourceDirectory']).is_symlink()and str(Path(c['sourceDirectory']).resolve())==c['destinationDirectory'];cacheStatus['directories'].append({k:v for k,v in c.items()if k!='entries'}|{'entriesCount':len(c['entries']),'originalAndCurrentEntryInventoryExact':True})
Path('/tmp/vscode-m01-sixth-cache-status.json').write_text(json.dumps(cacheStatus,ensure_ascii=False,indent=2)+'\n')
parent={'phase':'parent-reported-independent-read-only-checks-not-business-reruns','recordedAtUtc':now(),'source':'Explicit parent collaboration messages in this session; this is a structured derivative, not an invented tool log.','checks':{'old0daHarnessFourBusinessRedsAnd156FinallyRestorationJsonActuallyRead':True,'compile6Exit0ZeroDiagnosticsBothGlobalScansAnd156SourceNativeHashesRecomputed':True,'bb41And0daSourceTreeD5ecaAndD91Peer25bfAncestorsVerified':True,'formal252InventoryBytesShaAllRecomputed':True,'typesSource82AndTypesPeer338ModeTypeBlobRowsRecomputedAgainstRealGitTrees':True,'Astra597ProductI1AcceptedForLocalPaneOwnerRepair':True},'noParentBusinessRerunClaim':True};Path('/tmp/vscode-m01-sixth-parent-read-verification.json').write_text(json.dumps(parent,ensure_ascii=False,indent=2)+'\n')
invpath=e/'je-formal-artifact-inventory.json';inv=json.loads(invpath.read_text());assert len(inv['artifacts'])==252
for a in inv['artifacts']:
 b=(repo/a['repositoryPath']).read_bytes();assert len(b)==a['bytes']and sha(b)==a['sha256']
known={x.get('originalPath')for x in inv['artifacts']};originals=sorted(p for p in Path('/tmp').glob('vscode-m01-sixth-*')if p.is_file()and str(p)not in known)
originals += [Path('/tmp/vscode-je-formal-m01-vm-rootcause-peer'+s)for s in ['-pre-merge.json','-merge.log','-conflict-resolutions.json','-merge-identity.json']]
for original in originals:
 dest=e/original.name.removeprefix('vscode-');assert not dest.exists();data=original.read_bytes();shutil.copyfile(original,dest);assert dest.read_bytes()==data;inv['artifacts'].append({'originalPath':str(original),'repositoryPath':str(dest.relative_to(repo)),'bytes':len(data),'sha256':sha(data),'bytePreservingCopy':True})
inv['phase']='compile6-actual-zero-TS-M01-runtime-VM-product-I1-unfrozen-E11-actual163-scope';invpath.write_text(json.dumps(inv,ensure_ascii=False,indent=2)+'\n')
p=e/'je-formal-integration-verification.md';s=p.read_text();s=re.sub(r'^summary:.*$','summary: "第六完整compile0/0TS，新M01 24过2afterEach败与完整J410/2为产品Pane VM I1；E44/Roster190过、E11实际255/1旧红，163身份记录，修订待。"',s,count=1,flags=re.M);s+='''
## 第六完整编译0与新运行Pane VM产品I1

实际producer `bb41f815236afc5073df1699a0c97c696d7ee028` / src `d5eca6c1557b921827c2585104d54871936212ae` 精确受审0da，唯一lane全局scan空/共享锁实跑完整 `npm run compile-client` **exit0 / 0 TS**，HEAD/src/clean不变。[完整raw log](m01-sixth-native-build.log)、[156初始manifest/时间/命令JSON](m01-sixth-native-build.json)和脚本/两进程原件保留。六TS ESLint实际0error/21warning（Panel1+Wiring20），与第五同六路径告警位置一致，不冒充旧113文件重跑。

| 第六原生实际运行 | 结果 | 准确边界 |
| --- | --- | --- |
| [M01新测试](m01-sixth-M01-focused.json) | 24过 / 2败，exit1 | 23受控+首真实button empty global业务本体通过；afterEach六资源泄漏及console连带，余14未跑，不是38green |
| [J focused](m01-sixth-J-focused.json) | 29过，exit0 | 现有宿主/并发公共边界实际重跑 |
| [完整11 J/Sources](m01-sixth-J-complete-11.json) | 410过 / 2败，exit1 | 与focus同首真实入口后的6-disposable/console，未见另一业务断言失败；新余14仍未达 |
| [E response](m01-sixth-E-response-focused.json) | 44过，exit0 | 实际重跑 |
| [E完整Roster](m01-sixth-E-roster-full.json) | 190过，exit0 | 实际重跑 |
| [Node wiring](m01-sixth-J-wiring-scan.json) | 23过 / 1败，exit1 | 新Move typed context/双catch实过；唯一失败为既有Accept builder排除parseSourcesGitUnifiedDiff原断言，未弱化 |
| [E完整相关11](m01-sixth-E-related-full.json) | 255过 / 1败，exit1 | 实际额外单次补跑；原reasoning THINKING vs hmm\\nthen this断言保持 |

两浏览器失败是同一所有权问题和console连带，不能计两项独立产品错误。原Astra独立读三份raw/JSON后出不可变 `5972836d932ff0cbde50c970b672743e0eee8563` §15 **C0/I1/M0**：Pane向widget传raw text models，widget创建RefCounted VM的初始base悬置，detach只撤clone；两个真实Pane对应2 DiffEditorViewModel及4子资源，等待tick不能补所有权，禁止测试窥私有VM代dispose/关闭leak检测。父已授权原J最小局部Pane自有VM，不扩展全局widget/模块/合同。现已实读并真三路接报告，[352路径mode/type/blob门禁](je-formal-m01-vm-rootcause-peer-merge-identity.json)PASS，仅INDEX合成并保留双方整文，报告blob精确incoming；静态类型§14闭合不覆盖此新运行I1。

旧154 manifest没有覆盖7个E11测试产物，连续性helper实际拒绝缺身份，不能据此宣称11个测试old/native全连续。故按父明确授权仅单次补E11，未重复44/Roster或Node880。官方full compile6实际写出的额外7测试各核Git源SHA、native SHA及mtime晚于compile开始，run后不变；与原156分开记录并汇合为[完整163身份](m01-sixth-source-native-scope163.json)，**不是改写原156 compile记录**。后续生命周期临时JS finally/compile7/runtime须覆盖全部163。

[只读精确连续性](m01-sixth-continuity.json)在共享锁内核61个Node测试与50个相关生产source/native均与第四编译实际记录相同，universeAgent/conversation两个Git子树精确一致，整src差异仅Sources六路径；复用第四实际Node880及外部browser133，不机械重跑。E11因7测试native缺旧身份未作全套复用，已实际重跑；reasoning既有红和Wiring既有红都保留，不能借无新源删原断言。

[父独立只读核验范围](m01-sixth-parent-read-verification.json)明确父实际核新harness旧4/finally、compile6身份、252库存及82/338真实Git mode/type/blob行，不冒称父重跑业务或运行不存在的门禁脚本。全部252历史artifact精确保留，含首夹具败/各旧红/compile5失败/旧52 freeze/250成员29图。运行orchestrator退出0只表示收集结束，各runner exit1分别保留，不签green。

[本窗口缓存状态](m01-sixth-cache-status.json)记录三个自有ignored镜像逐entry仍精确、原路径symlink仍在，source/out/evidence未迁；为即将局部修订的下一完整编译按父授权保留，未声称已恢复，窗口完成条件允许才按原方案还原/核全。D候选/ordinal静态准备不当执行：没有新notice/freeze/UI/E授权，D1387 open、不push/主ff不重试。下一a166所有权修订仍须新增生命周期准确旧红、真实peer原件后合源/compile7及完整39/相关运行。
''';p.write_text(s)
p=repo/'dev/progress/status.md';s=p.read_text();s=re.sub(r'^summary:.*$','summary: "compile6实际0/0TS；M01 24/2及完整J410/2暴露Pane VM产品I1，E44/Roster190过、E11实际255/1旧红，163身份完整；修订待，无freeze/E UI。"',s,count=1,flags=re.M);lines=s.splitlines();i=next(i for i,x in enumerate(lines)if x.startswith('- **0da新真实命令旧四红'));lines[i]='- **compile6运行Pane VM I1（2026-10-27）**：bb41/srcd5eca实际完整compile0/0TS；M01 24过2afterEach败、完整J410/2同六资源泄漏+console，首真实按钮业务过/余14未达，不是38green。原Astra597 C0/I1产品owner缺口，父授权J局部VM自有修复。J29/E44/Roster190过；Wiring23/1既有Accept红；E11因7测试无旧native身份仅补跑一次255/1原reasoning红，原156+7=163全核。Node880/外部133仅精确连续性，缓存窗口内未还原，新freeze/UI/E均无。[完整原件](default-editor-contract-audit-2026-10-26-evidence/je-formal-integration-verification.md#第六完整编译0与新运行pane-vm产品i1)。';p.write_text('\n'.join(lines)+'\n');assert len(lines)<=200
p=repo/'dev/parallel/active/default-editor-contract-audit-2026-10-26.md';s=p.read_text();s=re.sub(r'^summary:.*$','summary: "compile6实际0/0TS但M01 24/2与完整J410/2暴露Pane VM产品I1，163身份记录；J29/E44/Roster190过，局部修订待，D1387/E after仍待。"',s,count=1,flags=re.M);s=s.replace('## M01最新增量（2026-10-27，0da正式合源 / 第六完整编译待）','## M01最新增量（2026-10-27，第六编译0 / 新运行Pane VM I1）');s=s.replace('M01/J/Sources/E受影响新green未跑。','实际compile6完整0/0TS，但M01 24/2与完整J410/2同首真实入口pass后的VM所有权leak/console；余14未达，Astra597产品C0/I1、父授权原J局部修复，未签39green。J29/E44/Roster190实际过，E11仅补一次255/1旧reasoning红，Wiring23/1旧Accept红；163身份完整，后续准确生命周期旧红/新peer/compile7待。');p.write_text(s)
p=e/'INDEX.md';s=p.read_text();s=s.replace('srcd5eca待第六完整compile/新green/E未跑','compile6实际0/0TS但M01 24/2与完整J410/2为Pane VM产品I1；E44/Roster190过、E11实际255/1旧红，163身份记录，新freeze/E UI仍无');p.write_text(s)
print(json.dumps({'old252Preserved':True,'newArtifacts':len(originals),'totalArtifacts':len(inv['artifacts']),'scope':163,'statusLines':len(lines)},ensure_ascii=False))
