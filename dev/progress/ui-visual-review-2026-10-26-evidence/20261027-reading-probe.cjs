const {chromium}=require('playwright-core'),fs=require('fs'),{execFileSync}=require('child_process');const dir=process.env.READING_EVIDENCE_DIR||__dirname;
const long=`# 阅读节奏与空间预算

这是一份隔离的视觉取样，内容没有提交给引擎。我们用同一段中文和英文比较阅读宽度、段落节奏与标题层次，不借助放大字号补偿空间不足。长路径示例：src/vs/workbench/contrib/conversation/browser/conversationTimelineRenderer.ts。

## 当前观察

正文负责表达判断，过程负责展示步骤，权限座位负责明确下一步。一个事实出现在不同位置时，应该先核对它们的任务，而不是直接删除其中一处。

### Checks and boundaries

A reading surface should retain useful context while leaving enough horizontal room for code, paths, and structured answers. This fixture uses the production renderer and styles without changing CSS or connecting an engine.

- 保留进行中、完成、失败、取消与待确认的区分。
- 对齐图标与文字，并保留键盘焦点。
  - 嵌套项核对缩进和换行。
  - 长内容不能挤掉操作入口。

> A visual preference is a hypothesis until it is checked in the actual task and layout.

## Code sample

\`\`\`typescript
const checkpoint = { source: 'fixture', connected: false };
const path = 'src/vs/workbench/contrib/conversation/browser/conversationTimelineRenderer.ts';
console.log(checkpoint, path);
\`\`\`

| Item | Expected | 状态 |
| --- | --- | --- |
| Reading width | Measured per leaf | 待比较 |
| Paragraph rhythm | Existing tokens | 不放大字号 |

### 下一步

使用相同内容比较单组、双组以及 Preview 有无内容。观察窄列的换行和段落之间的分组，区分空间限制与排版层次。所有结果仅属于此处的隔离 fixture。`;
(async()=>{const info=JSON.parse(fs.readFileSync(dir+'/launch.json'));const b=await chromium.connectOverCDP('http://127.0.0.1:'+info.cdpPort);const p=b.contexts()[0].pages().find(p=>p.url().includes('workbench-dev'));await p.waitForFunction(()=>!!window.driver);await p.evaluate(()=>window.driver.whenWorkbenchRestored());
const settle=async()=>{await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.waitForTimeout(350)};
await p.evaluate(async text=>{const base=location.href.split('/out/')[0]+'/out/';const {CommandsRegistry}=await import(base+'vs/platform/commands/common/commands.js');const {IConversationRosterService}=await import(base+'vs/workbench/contrib/conversation/browser/conversationStubService.js');const {IConversationSessionWindowService}=await import(base+'vs/workbench/contrib/conversation/browser/conversationSessionWindowService.js');const {IWorkbenchThemeService}=await import(base+'vs/workbench/services/themes/common/workbenchThemeService.js');const reg=CommandsRegistry.registerCommand('visual.sol.fixture',a=>{window.reviewRoster=a.get(IConversationRosterService);window.reviewWindows=a.get(IConversationSessionWindowService);window.reviewThemes=a.get(IWorkbenchThemeService)});await window.driver.executeCommand('visual.sol.fixture');reg.dispose();const cb=window.reviewRoster.createTestFrameSourceCallback();const sessions=['untitled','visualize'].map((id,i)=>({id,title:i?'English and Chinese fixture B':'Reading fixture A',source:'local',turns:[{id:id+'-u',kind:'user',text:'Compare reading layout / 比较阅读布局'},{id:id+'-a',kind:'assistant',text,stubEcho:true}]}));cb.model.replaceSessionCatalog(sessions,'untitled');for(const s of sessions){cb.refresh(s.id);cb.onSessionChanged(s.id)}await window.reviewWindows.ensurePrimaryWindow('untitled');},long);
await settle(); const result=[];
async function capture(label){await p.evaluate(()=>{for(const el of document.querySelectorAll('.conversation-timeline-viewport')){el.scrollTop=0;el.dispatchEvent(new Event('scroll'))}});await settle();const r=await p.evaluate(()=>{const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};const items=sel=>[...document.querySelectorAll(sel)].filter(visible).map(e=>({class:e.className,id:e.id,tag:e.tagName,text:e.textContent.slice(0,100),box:e.getBoundingClientRect().toJSON(),client:e.clientWidth,scroll:e.scrollWidth,style:{font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight,gap:getComputedStyle(e).gap,marginTop:getComputedStyle(e).marginTop,marginBottom:getComputedStyle(e).marginBottom}}));return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,visualScale:visualViewport.scale,theme:document.querySelector('.monaco-workbench').className,engineNotConnected:document.body.innerText.includes('Engine not connected'),connectionText:[...document.querySelectorAll('.conversation-identity-strip')].map(e=>e.textContent),scrollPositions:[...document.querySelectorAll('.conversation-timeline-viewport')].map(e=>({class:e.className,scrollTop:e.scrollTop})),windows:window.reviewWindows.getVisibleSessionKeys(),parts:items('[id^="workbench.parts."]'),leaves:items('.part.conversation .editor-group-container'),reading:items('.conversation-lens-timeline-content'),body:items('.conversation-lens-turn-body'),blocks:items('.conversation-lens-turn-body.rendered-markdown > *'),controls:items('.conversation-lens-dock-bottom-bar > *'),stylesheets:[...document.styleSheets].map(s=>s.href).filter(Boolean)}});result.push({label,...r});await p.screenshot({path:dir+'/'+label+'.png'});fs.writeFileSync(dir+'/matrix.json',JSON.stringify(result,null,2));console.log(label,JSON.stringify({part:r.parts.find(x=>x.id==='workbench.parts.conversation')?.box.width,leaves:r.leaves.map(x=>x.box.width),reading:r.reading.map(x=>x.box.width),bodies:r.body.map(x=>x.box.width),windows:r.windows}));}
for(const theme of ['UniverseAgentStudio Light','UniverseAgentStudio Dark']){await p.evaluate(async theme=>{const themes=await window.reviewThemes.getColorThemes();const t=themes.find(t=>t.settingsId===theme);if(!t)throw Error('theme missing '+theme);await window.reviewThemes.setColorTheme(t.id,undefined)},theme);await p.waitForFunction(t=>document.querySelector('.monaco-workbench').classList.contains(t),theme.endsWith('Light')?'vs':'vs-dark');
for(const width of [1440,1024]){execFileSync('xdotool',['windowsize','2097155',String(width),'1000'],{env:{...process.env,DISPLAY:':0'}});await p.waitForFunction(w=>innerWidth===w,width);await settle();for(const key of windowKeys=await p.evaluate(()=>window.reviewWindows.getVisibleSessionKeys()))if(key!=='untitled')await p.evaluate(key=>window.reviewWindows.hideSessionWindow(key),key);
await capture((theme.endsWith('Light')?'light':'dark')+'-'+width+'-single-empty-preview');
await p.evaluate(()=>window.driver.executeCommand('workbench.action.files.newUntitledFile'));await capture((theme.endsWith('Light')?'light':'dark')+'-'+width+'-single-content-preview');
await p.evaluate(()=>window.driver.executeCommand('workbench.action.revertAndCloseActiveEditor'));
await p.evaluate(()=>window.reviewWindows.openSessionBeside('visualize'));await capture((theme.endsWith('Light')?'light':'dark')+'-'+width+'-double-empty-preview');
await p.evaluate(()=>window.driver.executeCommand('workbench.action.toggleEditorVisibility'));await capture((theme.endsWith('Light')?'light':'dark')+'-'+width+'-double-preview-hidden');await p.evaluate(()=>window.driver.executeCommand('workbench.action.toggleSources'));await capture((theme.endsWith('Light')?'light':'dark')+'-'+width+'-double-right-hidden');await p.evaluate(()=>window.driver.executeCommand('workbench.action.toggleSources'));await p.evaluate(()=>window.driver.executeCommand('workbench.action.toggleEditorVisibility'));
}}
await b.close();})().catch(e=>{console.error(e);process.exit(1)});