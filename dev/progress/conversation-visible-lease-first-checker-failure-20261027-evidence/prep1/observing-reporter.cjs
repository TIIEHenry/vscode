// Read-only observer around the byte-exact official reporter adapter. No test hooks or code injection.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { fileURLToPath } = require('node:url');
const CoreReporter = require('./reporter.cjs');
const { BrowserWindow } = require('electron');
const repo = '/home/clarence/Projects/Agents/vscode-WorkTrees/merge';
const scratch = __dirname;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const targets = new Set(JSON.parse(fs.readFileSync(path.join(scratch, 'policy.json'))).outputPaths);
module.exports = class AssetObservingReporter extends CoreReporter {
 constructor(runner, options) {
  super(runner, options);
  this.assets = [];
  this.observerErrors = [];
  this.windows = BrowserWindow.getAllWindows();
  if (this.windows.length !== 1) throw Error('Expected exactly the official test renderer window');
  this.debugger = this.windows[0].webContents.debugger;
  this.onMessage = (_event, method, params) => {
   if (method === 'Debugger.scriptParsed') this.assets.push({ kind: 'parsed-script', url: params.url, scriptId: params.scriptId, runtimeScriptHash: params.hash, sourceMapURL: params.sourceMapURL ?? null });
   if (method === 'CSS.styleSheetAdded') this.assets.push({ kind: 'registered-stylesheet', url: params.header.sourceURL, styleSheetId: params.header.styleSheetId, origin: params.header.origin, isInline: params.header.isInline });
  };
  this.debugger.on('message', this.onMessage);
  this.ready = (async () => {
   if (this.debugger.isAttached()) throw Error('Unexpected pre-attached debugger; coverage flags forbidden');
   this.debugger.attach('1.3');
   await this.debugger.sendCommand('DOM.enable');
   await this.debugger.sendCommand('CSS.enable');
   await this.debugger.sendCommand('Debugger.enable');
  })().catch(e => { this.observerErrors.push(String(e.stack ?? e)); });
 }
 async drain() {
  await super.drain();
  await this.ready;
  const observed = [], unmapped = [];
  try {
   for (const row of this.assets) {
    let absolute;
    try {
     const url = new URL(row.url);
     if (url.protocol !== 'file:' && url.protocol !== 'vscode-file:') continue;
     absolute = url.protocol === 'file:' ? fileURLToPath(url) : decodeURIComponent(url.pathname);
    } catch { if (row.kind === 'registered-stylesheet') unmapped.push(row); continue; }
    const relative = path.relative(repo, absolute).split(path.sep).join('/');
    if (!relative.startsWith('out/') || !/\.(?:js|css)$/.test(relative)) continue;
    const bytes = fs.readFileSync(absolute);
    const item = { ...row, path: relative, diskBytes: bytes.length, diskSha256: sha(bytes), observation: row.kind === 'parsed-script' ? 'CDP scriptParsed: loaded and parsed; not function-coverage' : 'CDP stylesheet registered; not applied-style or visual coverage' };
    if (row.kind === 'parsed-script' && targets.has(relative)) {
     const source = await this.debugger.sendCommand('Debugger.getScriptSource', { scriptId: row.scriptId });
     const loaded = Buffer.from(source.scriptSource);
     item.targetRuntimeSourceBytes = loaded.length;
     item.targetRuntimeSourceSha256 = sha(loaded);
     item.targetRuntimeSourceEqualsDiskBytes = loaded.equals(bytes);
    }
    observed.push(item);
   }
  } catch (error) { this.observerErrors.push(String(error.stack ?? error)); }
  finally {
   this.debugger.removeListener('message', this.onMessage);
   if (this.debugger.isAttached()) this.debugger.detach();
  }
  const label = process.env.VSCODE_SOURCES_NEW_VALIDATION_STAGE.slice('test:'.length);
  fs.writeFileSync(path.join(scratch, label + '.loaded-assets.json'), JSON.stringify({ atUtc: new Date().toISOString(), observer: 'Read-only CDP domains and exact target getScriptSource; official runner/reporters/tests unchanged', observed, unmappedRegisteredStylesheets: unmapped, observerErrors: this.observerErrors, noSourceInjection: true, noCoverageOrExtraEmit: true }, null, 2) + '\n', { flag: 'wx' });
 }
};
