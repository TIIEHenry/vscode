/*---------------------------------------------------------------------------------------------
	*  Copyright (c) Microsoft Corporation. All rights reserved.
	*  Licensed under the MIT License. See License.txt in the project root for license information.
	*--------------------------------------------------------------------------------------------*/
'use strict';

// Matrix-only observation. No engine subscription, acquire, resync or product DTO.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fileURLToPath } = require('node:url');
const KIND = 'ua-real-editor-dom-frame-provenance';
const GLOBAL = '__uaRealEditorProvenance';
const ROLES = Object.freeze({
	mainActor: 'out/vs/platform/universeAgent/node/sessionCore/session-actor.js',
	frameSource: 'out/vs/workbench/contrib/conversation/browser/conversationEngineFrameSource.js',
	lens: 'out/vs/workbench/contrib/conversation/browser/conversationLens.js',
	timelineHost: 'out/vs/workbench/contrib/conversation/browser/conversationTimelineHost.js',
	itemHost: 'out/vs/workbench/contrib/conversation/browser/conversationTimelineItemHost.js'
});
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = (code, unavailable = false) => { const error = new Error(code); error.code = unavailable ? 'dom-frame-provenance-unavailable' : 'dom-frame-provenance-invalid'; throw error; };
function moduleFile(url) {
	const parsed = new URL(url);
	if (parsed.protocol === 'file:') { return fileURLToPath(parsed); }
	if (parsed.protocol === 'vscode-file:' && parsed.hostname === 'vscode-app') { return decodeURIComponent(parsed.pathname); }
	fail('provenance-module-url-not-local');
}
function chooseExecutionContext(contexts, matches, frameId = null) {
	const selected = contexts.filter(context => matches.includes(context.id) && Number.isSafeInteger(context.id)
		&& typeof context.uniqueId === 'string' && context.uniqueId.length > 0
		&& (frameId === null ? context.auxData?.isDefault !== false
			: context.auxData?.isDefault === true && context.auxData.frameId === frameId));
	if (selected.length !== 1) { fail('provenance-current-context-unavailable', true); }
	const context = selected[0];
	return { id: context.id, uniqueId: context.uniqueId, frameId, isDefault: true };
}
function createContextFence(context) {
	let invalid = false;
	return {
		created(value) { if (value.id === context.id && value.uniqueId !== context.uniqueId) { invalid = true; } },
		destroyed(id) { if (id === context.id) { invalid = true; } },
		cleared() { invalid = true; },
		navigated(id) { if (context.frameId !== null && id === context.frameId) { invalid = true; } },
		assert() { if (invalid) { fail('provenance-context-destroyed-or-navigated', true); } }
	};
}
function selectLoadedModules(repo, expected, scripts, roles, context = null) {
	if (!Array.isArray(expected) || expected.length !== Object.keys(ROLES).length) { fail('provenance-module-seal-missing', true); }
	const selected = [];
	for (const role of roles) {
		const seal = expected.filter(item => item.role === role && item.path === ROLES[role]);
		if (seal.length !== 1 || !/^[a-f0-9]{64}$/u.test(seal[0].sha256 || '')) { fail('provenance-module-seal-invalid'); }
		const file = path.join(repo, ROLES[role]);
		const matches = scripts.filter(script => {
			try { return script.isModule === true && (!context || script.executionContextId === context.id) && moduleFile(script.url) === file; } catch { return false; }
		});
		if (matches.length !== 1) { fail(`provenance-module-not-already-loaded:${role}`, true); }
		const match = matches[0];
		// The debugger's source is the actual parsed script, not a file merely present
		// on disk. Both that source and the current bytes must match the sealed file.
		if (digest(match.source) !== seal[0].sha256 || digest(fs.readFileSync(file)) !== seal[0].sha256) { fail('provenance-loaded-module-digest-mismatch'); }
		selected.push({ ...seal[0], url: match.url, loaded: true, ...(context ? { executionContext: { ...context } } : {}) });
	}
	return selected;
}

// This closure-free factory is serialized into the owned renderer. Offline
// controls instantiate exactly this implementation with small owning classes.
function createRuntime(options = {}) {
	const state = { active: true, realm: options.realm, acquisitions: [], frames: [], inputs: [], paints: [], diagnostics: [], sequence: 0 };
	const restores = [];
	const safe = fn => { try { return fn(); } catch (error) { if (state.diagnostics.length < 100) { state.diagnostics.push({ code: 'observer-failed', detail: String(error?.message || error) }); } return undefined; } };
	const copy = value => value === undefined ? null : JSON.parse(JSON.stringify(value));
	const cursorOf = value => {
		if (!value || typeof value.leaseId !== 'string' || !value.leaseId || !['generation','frameId','version'].every(key => Number.isSafeInteger(value[key]) && value[key] >= 0)) { return null; }
		return { leaseId: value.leaseId, generation: value.generation, frameId: value.frameId, version: value.version };
	};
	const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
	const paneOrdinals = new WeakMap(); let nextPaneOrdinal = 0;
	const paneElementOf = element => element?.closest?.('.conversation-session-leaf') || element?.closest?.('.conversation-subagent-overlay') || null;
	const paneOf = element => paneElementOf(element)?.getAttribute('data-session-key')?.trim() || null;
	const paneOrdinalOf = element => {
		const pane = paneElementOf(element); if (!pane) { return null; }
		if (!paneOrdinals.has(pane)) { paneOrdinals.set(pane, ++nextPaneOrdinal); }
		return paneOrdinals.get(pane);
	};
	function wrap(object, name, handler) {
		const descriptor = Object.getOwnPropertyDescriptor(object, name);
		if (!descriptor || typeof descriptor.value !== 'function' || descriptor.configurable === false) { throw new Error(`unwrappable:${name}`); }
		const original = descriptor.value;
		const wrapped = function (...args) { return !state.active ? Reflect.apply(original, this, args) : handler.call(this, original, args); };
		Object.defineProperty(object, name, { ...descriptor, value: wrapped });
		restores.push(() => {
			if (Object.getOwnPropertyDescriptor(object, name)?.value !== wrapped) { state.diagnostics.push({ code: 'hook-replaced', method: name }); return; }
			Object.defineProperty(object, name, descriptor);
		});
	}
	function installMain(Actor) {
		const sinks = new WeakMap();
		wrap(Actor.prototype, 'onAcquireLease', function (original, args) {
			const [leaseId, sink] = args;
			safe(() => {
				let entry = sinks.get(sink);
				if (!entry) {
					entry = { owners: new Map() }; sinks.set(sink, entry);
					const own = Object.getOwnPropertyDescriptor(sink, 'enqueue');
					let descriptor = own; let prototype = Object.getPrototypeOf(sink);
					while (!descriptor && prototype) { descriptor = Object.getOwnPropertyDescriptor(prototype, 'enqueue'); prototype = Object.getPrototypeOf(prototype); }
					const originalEnqueue = descriptor?.value;
					if (typeof originalEnqueue !== 'function' || own?.configurable === false || !Object.isExtensible(sink) && !own) { throw new Error('sink-not-wrappable'); }
					const wrapped = function (...enqueueArgs) {
						// Latch before the real callback; callback may synchronously mutate Actor.
						if (state.active) { safe(() => {
							const frame = enqueueArgs[0]; const actor = entry.owners.get(frame?.leaseId);
							const cursor = cursorOf(frame);
							if (state.frames.length >= 100000) { throw new Error('frame-evidence-limit'); }
							const epoch = actor?.lastRuntimeEpoch;
							const hello = copy(actor?.streamHelloAnchor);
							const raw = options.rawCut?.();
							state.frames.push({ ordinal: ++state.sequence, sessionId: actor?.sessionId ?? null,
								epoch: Number.isSafeInteger(epoch) && epoch >= 0 ? String(epoch) : null, hello,
								bound: !!actor && !!cursor && Number.isSafeInteger(epoch) && hello?.runtimeEpoch === epoch
									&& ['runtimeEpoch','headSeq','sessionVersion','lastMutatedFromSeq'].every(key => Number.isSafeInteger(hello?.[key]) && hello[key] >= 0),
								cursor, rawOrdinal: Number.isSafeInteger(raw) ? raw : null, bodyKind: frame?.body?.kind ?? null });
						}); }
						return Reflect.apply(originalEnqueue, this, enqueueArgs);
					};
					Object.defineProperty(sink, 'enqueue', { ...(own || { configurable: true, enumerable: true, writable: true }), value: wrapped });
					restores.push(() => {
						if (sink.enqueue !== wrapped) { state.diagnostics.push({ code: 'sink-hook-replaced' }); return; }
						if (own) { Object.defineProperty(sink, 'enqueue', own); } else { delete sink.enqueue; }
					});
				}
				if (entry.owners.has(leaseId) && entry.owners.get(leaseId) !== this) { throw new Error('lease-owner-conflict'); }
				entry.owners.set(leaseId, this);
			});
			// Identical sink object and complete original arguments. Never await/retry.
			return Reflect.apply(original, this, args);
		});
	}
	const knownLeases = new WeakSet();
	const rootScopes = new WeakMap(); const paintsByElement = new WeakMap();
	const pendingPaints = new Set(); const hostInputs = new WeakMap();
	let currentInput = null; let currentTimelineHost = null;
	function scopeOf(lens) {
		const lease = lens.sessionViewLease;
		const cursor = cursorOf(lease?.cursor);
		const bound = lens.getBoundSessionId?.();
		const paneSessionId = paneOf(lens.timelineTree?.viewport);
		const paneOrdinal = paneOrdinalOf(lens.timelineTree?.viewport);
		if (!lease || !knownLeases.has(lease) || lease.constructor?.name !== 'EngineSessionViewLease' || !cursor || !lease.sessionId || lease.sessionId !== bound
			|| paneSessionId !== bound || !paneOrdinal || lease.snapshot?.sessionId !== bound || lease.leaseId !== cursor.leaseId) { return null; }
		return { paneOrdinal, sessionId: lease.sessionId, boundSessionId: bound, snapshotSessionId: lease.snapshot.sessionId,
			cursor, leaseClass: lease.constructor.name };
	}
	function invalidate(input, reason) {
		if (input) { input.valid = false; input.reason = reason; }
	}
	function rootIdentity(root) {
		if (!root || !Array.isArray(root.turns)) { return []; }
		return root.turns.map(item => ({ rowId: item.id, agentId: item.turn?.agentId ?? null,
			turnId: item.turn?.turnId ?? null, kind: item.turn?.kind ?? null }));
	}
	function rendered(host, operation) {
		const input = rootScopes.get(host.root);
		if (!input || !input.valid) { return; }
		const article = host.article;
		// Save the actual render inputs, not a global latest cursor. New articles may
		// be inserted after render() returns; syncArticles closes that synchronous cut.
		pendingPaints.add({ host, article, root: host.root, input, identities: rootIdentity(host.root), operation });
	}
	function flushPaints() {
		for (const item of [...pendingPaints]) {
			if (item.host.root !== item.root) { pendingPaints.delete(item); continue; }
			if (!item.article?.isConnected) { continue; }
			pendingPaints.delete(item);
			const paneSessionId = paneOf(item.article);
			if (!item.input.valid || paneOrdinalOf(item.article) !== item.input.paneOrdinal || paneSessionId !== item.input.sessionId || item.article.getAttribute('data-root-id') !== item.root.id) { continue; }
			const rows = [...item.article.querySelectorAll('[data-turn-id][data-kind]')]
				.filter(row => !row.parentElement?.closest('[data-turn-id][data-kind]'));
			const paint = { realm: options.realm, ordinal: ++state.sequence, inputOrdinal: item.input.ordinal, paneOrdinal: item.input.paneOrdinal, sessionId: paneSessionId,
				cursor: copy(item.input.cursor), rootId: item.root.id, identities: item.identities,
				operation: item.operation, rowIds: rows.map(row => row.getAttribute('data-turn-id')) };
			if (state.paints.length >= 100000) { throw new Error('paint-evidence-limit'); }
			state.paints.push(paint);
			for (const row of rows) {
				// Missing input identity is not replaced with the DOM's requested row id.
				if (item.identities.some(identity => identity.rowId === row.getAttribute('data-turn-id'))) { paintsByElement.set(row, paint); }
			}
		}
	}
	function installRenderer(Lens, TimelineHost, ItemHost, FrameSource) {
		wrap(FrameSource.prototype, 'acquire', function (original, args) {
			const lease = Reflect.apply(original, this, args);
			safe(() => {
				if (!lease || lease.constructor?.name !== 'EngineSessionViewLease' || lease.sessionId !== args[0]) { throw new Error('unexpected-real-lease'); }
				knownLeases.add(lease);
				state.acquisitions.push({ realm: options.realm, ordinal: ++state.sequence, sessionId: lease.sessionId });
			});
			return lease;
		});
		wrap(Lens.prototype, 'applySessionViewTimeline', function (original, args) {
			const before = safe(() => scopeOf(this));
			const prior = currentInput; const priorHost = currentTimelineHost;
			const originalLease = this.sessionViewLease; const originalHost = this.timelineTree;
			const input = before ? { ...before, realm: options.realm, ordinal: ++state.sequence, valid: true } : null;
			if (input) { safe(() => { if (state.inputs.length >= 100000) { throw new Error('input-evidence-limit'); } state.inputs.push(input); }); }
			currentInput = input; currentTimelineHost = originalHost;
			try { return Reflect.apply(original, this, args); }
			catch (error) { invalidate(input, 'projection-threw'); throw error; }
			finally {
				safe(() => { if (this.sessionViewLease !== originalLease || this.timelineTree !== originalHost || !same(before, scopeOf(this))) { invalidate(input, 'owner-or-cursor-changed'); } });
				currentInput = prior; currentTimelineHost = priorHost;
			}
		});
		wrap(TimelineHost.prototype, 'applyEntries', function (original, args) {
			const previous = hostInputs.get(this);
			if (currentInput && this === currentTimelineHost) { hostInputs.set(this, currentInput); } else { hostInputs.delete(this); }
			try { return Reflect.apply(original, this, args); }
			finally { if (previous) { hostInputs.set(this, previous); } else { hostInputs.delete(this); } }
		});
		// project() is the first owning point for actual immutable root objects.
		wrap(TimelineHost.prototype, 'project', function (original, args) {
			const projected = Reflect.apply(original, this, args);
			safe(() => { const input = hostInputs.get(this); if (input) { for (const root of projected.roots) { rootScopes.set(root, input); } } });
			return projected;
		});
		wrap(TimelineHost.prototype, 'syncArticles', function (original, args) {
			const returned = Reflect.apply(original, this, args);
			safe(() => { flushPaints(); pendingPaints.clear(); });
			return returned;
		});
		for (const name of ['render', 'refreshProcessFold']) {
			wrap(ItemHost.prototype, name, function (original, args) {
				const root = this.root;
				const returned = Reflect.apply(original, this, args);
				safe(() => {
					// refreshProcessFold's guarded early return does not paint anything.
					if (name === 'refreshProcessFold' && !(root?.kind === 'process-fold' && root.span && this.foldHandle)) { return; }
					if (root !== this.root) { return; }
					rendered(this, name); flushPaints();
				});
				return returned;
			});
		}
	}
	function sampleRow(element) {
		const paint = paintsByElement.get(element);
		if (!paint) { return null; }
		const input = state.inputs.find(item => item.ordinal === paint.inputOrdinal);
		if (!input?.valid || !element.isConnected || paneOrdinalOf(element) !== paint.paneOrdinal || paneOf(element) !== paint.sessionId
			|| element.closest('article')?.getAttribute('data-root-id') !== paint.rootId
			|| !paint.rowIds.includes(element.getAttribute('data-turn-id'))) { return null; }
		return copy({ realm: options.realm, paneOrdinal: paint.paneOrdinal, paintOrdinal: paint.ordinal, inputOrdinal: input.ordinal, sessionId: paint.sessionId,
			cursor: paint.cursor, rootId: paint.rootId, identities: paint.identities });
	}
	return { state, installMain, installRenderer, sampleRow,
		snapshot: () => copy({ realm: options.realm, acquisitions: state.acquisitions, frames: state.frames, inputs: state.inputs, paints: state.paints, diagnostics: state.diagnostics }),
		restore() { state.active = false; for (const restore of restores.reverse()) { safe(restore); } pendingPaints.clear(); }
	};
}

async function installMain(_electron, options) {
	if (typeof process.getBuiltinModule !== 'function') { throw new Error('dom-frame-provenance-unavailable'); }
	const nodeModule = process.getBuiltinModule('module');
	const inspector = process.getBuiltinModule('inspector');
	const nodeCrypto = process.getBuiltinModule('crypto');
	const nodePath = process.getBuiltinModule('path');
	const vm = process.getBuiltinModule('vm');
	if (typeof nodeModule?.createRequire !== 'function' || typeof inspector?.Session !== 'function'
		|| typeof nodeCrypto?.randomBytes !== 'function' || typeof nodePath?.join !== 'function'
		|| typeof vm?.compileFunction !== 'function' || typeof vm?.constants?.USE_MAIN_CONTEXT_DEFAULT_LOADER !== 'symbol') {
		throw new Error('dom-frame-provenance-unavailable');
	}
	const require = nodeModule.createRequire(options.packageJson);
	const helper = require(options.helperFile);
	const raw = globalThis.__uaRealEditorRawTap;
	if (!_electron.app.commandLine.hasSwitch('enable-smoke-test-driver') || process.env.UA_REAL_EDITOR_SCENE !== 'matrix'
		|| !raw?.active || raw.token !== options.token || !/^127\.0\.0\.1:[0-9]+$/u.test(options.address)
		|| options.address.endsWith(':50061') || process.env.UA_REAL_EDITOR_PORT !== options.address.split(':')[1] || Object.entries(options.identity).some(([key, value]) => process.env[`UA_REAL_EDITOR_${key.replace(/([A-Z])/gu, '_$1').toUpperCase()}`] !== value)) {
		throw new Error('dom-frame-provenance-unavailable');
	}
	if (globalThis.__uaRealEditorProvenance) { throw new Error('dom-frame-provenance-invalid'); }
	const pending = { token: options.token, active: true, runtime: null, modules: [] };
	globalThis.__uaRealEditorProvenance = pending;
	pending.probe = nodeCrypto.randomBytes(24).toString('hex');
	const session = new inspector.Session(); const scripts = []; const contexts = new Map(); let fence;
	session.connect();
	session.on('Debugger.scriptParsed', event => scripts.push(event.params));
	session.on('Runtime.executionContextCreated', event => { contexts.set(event.params.context.id, event.params.context); fence?.created(event.params.context); });
	session.on('Runtime.executionContextDestroyed', event => { contexts.delete(event.params.executionContextId); fence?.destroyed(event.params.executionContextId); });
	session.on('Runtime.executionContextsCleared', () => { contexts.clear(); fence?.cleared(); });
	const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
	const expression = `globalThis.__uaRealEditorProvenance?.probe === ${JSON.stringify(pending.probe)}`;
	const stillOwned = () => {
		fence?.assert();
		if (!pending.active || !raw.active || globalThis.__uaRealEditorProvenance !== pending) { throw new Error('dom-frame-provenance-unavailable'); }
	};
	try {
		await post('Runtime.enable');
		const matches = [];
		for (const context of contexts.values()) {
			const response = await post('Runtime.evaluate', { expression, contextId: context.id, returnByValue: true });
			if (!response.exceptionDetails && response.result?.value === true) { matches.push(context.id); }
		}
		const context = helper.chooseExecutionContext([...contexts.values()], matches);
		fence = helper.createContextFence(context);
		const probe = await post('Runtime.evaluate', { expression, uniqueContextId: context.uniqueId, returnByValue: true });
		if (probe.exceptionDetails || probe.result?.value !== true) { throw new Error('dom-frame-provenance-unavailable'); }
		await post('Debugger.enable'); stillOwned();
		const relevant = scripts.filter(script => script.executionContextId === context.id && (() => {
			try { return helper.moduleFile(script.url) === nodePath.join(options.repo, helper.ROLES.mainActor); } catch { return false; }
		})());
		for (const script of relevant) { script.source = (await post('Debugger.getScriptSource', { scriptId: script.scriptId })).scriptSource; stillOwned(); }
		const modules = helper.selectLoadedModules(options.repo, options.modules, relevant, ['mainActor'], context);
		const verified = await post('Runtime.evaluate', { expression, uniqueContextId: context.uniqueId, returnByValue: true });
		stillOwned();
		if (verified.exceptionDetails || verified.result?.value !== true) { throw new Error('dom-frame-provenance-unavailable'); }
		// ElectronApplication.evaluate has no native dynamic-import callback. This
		// explicit loader was verified in native Electron 42 / Node 24 with an already
		// loaded TLA graph (same namespace/constructor, one evaluation). Do not replace
		// it with sync require, or call it before current-context + loaded-byte gates.
		const importLoaded = vm.compileFunction('return import(specifier)', ['specifier'], {
			importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER
		});
		stillOwned();
		const namespace = await importLoaded(modules[0].url); stillOwned();
		const runtime = helper.createRuntime({ rawCut: () => raw.active ? raw.ordinal : null });
		try { runtime.installMain(namespace.SessionActor); } catch { runtime.restore(); throw new Error('dom-frame-provenance-unavailable'); }
		pending.runtime = runtime; pending.modules = modules; pending.executionContext = context;
		return { modules, executionContext: context };
	} finally { session.disconnect(); }
}
function readMain(_electron, options) {
	const registry = globalThis.__uaRealEditorProvenance;
	if (!registry) {
		if (options.restore && options.allowMissing) { return { frames: [], inputs: [], paints: [], acquisitions: [], diagnostics: [], modules: [] }; }
		throw new Error('dom-frame-provenance-unavailable');
	}
	if (registry.token !== options.token) { throw new Error('dom-frame-provenance-invalid'); }
	const installError = registry.installError;
	if (options.restore) { registry.active = false; registry.runtime?.restore(); delete globalThis.__uaRealEditorProvenance; }
	return { ...(registry.runtime?.snapshot() || { realm: registry.realm, frames: [], inputs: [], paints: [], acquisitions: [], diagnostics: [] }), modules: registry.modules, executionContext: registry.executionContext, ...(installError ? { installError } : {}) };
}
function beginRenderer(options) {
	if (!globalThis.driver || !options.token || options.mainGate !== true || globalThis.__uaRealEditorProvenance) { throw new Error('dom-frame-provenance-unavailable'); }
	globalThis.__uaRealEditorProvenance = { token: options.token, realm: options.realm, probe: options.probe,
		document, active: true, runtime: null, modules: [] };
}
function rendererOwnershipProbe(options) {
	const pending = globalThis.__uaRealEditorProvenance;
	return !!globalThis.driver && !!pending?.active && pending.token === options.token && pending.probe === options.probe
		&& pending.realm === options.realm && pending.document === document;
}
async function installRenderer(options, factory) {
	const pending = globalThis.__uaRealEditorProvenance;
	const owned = () => {
		if (!globalThis.driver || options.mainGate !== true || !pending || !pending.active || pending.token !== options.token
			|| pending.probe !== options.probe || pending.realm !== options.realm || pending.document !== document
			|| globalThis.__uaRealEditorProvenance !== pending) { throw new Error('dom-frame-provenance-unavailable'); }
	};
	owned();
	// Called only by CDP Runtime.evaluate(uniqueContextId) for the default context
	// which proved this marker. A new document/main world has no pending marker.
	pending.executionContext = options.executionContext;
	pending.modules = options.modules;
	const namespaces = {};
	for (const item of options.modules) {
		owned();
		if (item.executionContext?.uniqueId !== options.executionContext.uniqueId
			|| item.executionContext?.id !== options.executionContext.id || item.executionContext?.frameId !== options.executionContext.frameId) {
			throw new Error('dom-frame-provenance-unavailable');
		}
		namespaces[item.role] = await import(item.url); owned();
	}
	const runtime = factory({ realm: options.realm });
	try { runtime.installRenderer(namespaces.lens.ConversationLens, namespaces.timelineHost.ConversationTimelineHost, namespaces.itemHost.ConversationTimelineItemHost, namespaces.frameSource.ConversationEngineFrameSource); } catch { runtime.restore(); throw new Error('dom-frame-provenance-unavailable'); }
	owned(); pending.runtime = runtime;
	return { modules: options.modules, executionContext: options.executionContext };
}
function readRenderer(options) {
	const registry = globalThis.__uaRealEditorProvenance;
	if (!registry) {
		if (options.restore && options.allowMissing) { return { frames: [], inputs: [], paints: [], acquisitions: [], diagnostics: [], modules: [] }; }
		throw new Error('dom-frame-provenance-unavailable');
	}
	if (registry.token !== options.token) { throw new Error('dom-frame-provenance-invalid'); }
	const installError = registry.installError;
	if (options.restore) { registry.active = false; registry.runtime?.restore(); delete globalThis.__uaRealEditorProvenance; }
	return { ...(registry.runtime?.snapshot() || { realm: registry.realm, frames: [], inputs: [], paints: [], diagnostics: [] }), modules: registry.modules, executionContext: registry.executionContext, ...(installError ? { installError } : {}) };
}
async function observeRenderer(page, repo, expected, options) {
	const probe = crypto.randomBytes(24).toString('hex');
	// Establish ownership in Playwright's actual current page main world before
	// asking CDP about any scripts; merely matching a resource URL is insufficient.
	await page.evaluate(beginRenderer, { token: options.token, realm: options.realm, mainGate: options.mainGate, probe });
	const cdp = await page.context().newCDPSession(page);
	const scripts = []; const contexts = new Map(); let fence; let frameId; let changed = false;
	cdp.on('Debugger.scriptParsed', event => scripts.push(event));
	cdp.on('Runtime.executionContextCreated', event => { contexts.set(event.context.id, event.context); fence?.created(event.context); });
	cdp.on('Runtime.executionContextDestroyed', event => { contexts.delete(event.executionContextId); fence?.destroyed(event.executionContextId); });
	cdp.on('Runtime.executionContextsCleared', () => { contexts.clear(); changed = true; fence?.cleared(); });
	cdp.on('Page.frameNavigated', event => { if (!frameId || event.frame.id === frameId) { changed = true; } fence?.navigated(event.frame.id); });
	const expression = `globalThis.__uaRealEditorProvenance?.probe === ${JSON.stringify(probe)} && globalThis.__uaRealEditorProvenance.active === true`;
	const assertOwned = () => { fence?.assert(); if (changed || options.isActive?.() === false) { fail('provenance-context-ownership-lost', true); } };
	const evaluate = async (context, expression, awaitPromise = false) => {
		assertOwned();
		const response = await cdp.send('Runtime.evaluate', { expression, uniqueContextId: context.uniqueId, returnByValue: true, awaitPromise });
		assertOwned();
		if (response.exceptionDetails) { fail('provenance-current-context-evaluation-failed', true); }
		return response.result?.value;
	};
	try {
		await cdp.send('Page.enable');
		frameId = (await cdp.send('Page.getFrameTree')).frameTree.frame.id;
		await cdp.send('Runtime.enable'); assertOwned();
		const matches = [];
		for (const context of contexts.values()) {
			if (context.auxData?.frameId !== frameId || context.auxData?.isDefault !== true) { continue; }
			const response = await cdp.send('Runtime.evaluate', { expression, uniqueContextId: context.uniqueId, returnByValue: true });
			if (!response.exceptionDetails && response.result?.value === true) { matches.push(context.id); }
		}
		const context = chooseExecutionContext([...contexts.values()], matches, frameId);
		fence = createContextFence(context); assertOwned();
		if (await page.evaluate(rendererOwnershipProbe, { token: options.token, realm: options.realm, probe }) !== true) { fail('provenance-page-main-world-changed', true); }
		assertOwned();
		await cdp.send('Debugger.enable'); assertOwned();
		const roles = Object.keys(ROLES).filter(role => role !== 'mainActor');
		const relevant = scripts.filter(script => script.executionContextId === context.id && roles.some(role => {
			try { return moduleFile(script.url) === path.join(repo, ROLES[role]); } catch { return false; }
		}));
		for (const script of relevant) { script.source = (await cdp.send('Debugger.getScriptSource', { scriptId: script.scriptId })).scriptSource; assertOwned(); }
		const modules = selectLoadedModules(repo, expected, relevant, roles, context);
		const currentTree = await cdp.send('Page.getFrameTree'); assertOwned();
		if (currentTree.frameTree.frame.id !== frameId || await page.evaluate(rendererOwnershipProbe, { token: options.token, realm: options.realm, probe }) !== true
			|| await evaluate(context, expression) !== true) { fail('provenance-current-context-changed', true); }
		const args = { modules, token: options.token, realm: options.realm, mainGate: options.mainGate, probe, executionContext: context };
		// Bind the actual import to the attested unique context. page.evaluate after
		// this check could silently target a newer document, so it is not used here.
		return await evaluate(context, `(${installRenderer.toString()})(${JSON.stringify(args)}, (${options.factory}))`, true);
	} finally { await cdp.detach(); }
}
function artifact(identity, main, renderer, records, samples) {
	const value = { schemaVersion: 1, kind: KIND, ...Object.fromEntries(['campaignId','cellId','caseId','nonce'].map(key => [key, identity[key]])),
		status: 'unavailable', realms: renderer?.realms || [], rendererAttestations: renderer?.rendererAttestations || [], acquisitions: renderer?.acquisitions || [], modules: [...(main?.modules || []), ...(renderer?.modules || [])],
		frames: main?.frames || [], inputs: renderer?.inputs || [], paints: renderer?.paints || [], verifiedScopes: [],
		diagnostics: [...(main?.diagnostics || []), ...(renderer?.diagnostics || [])] };
	const modulesValid = Object.entries(ROLES).every(([role, modulePath]) => {
		const rows = value.modules.filter(item => item.role === role);
		const expected = identity.provenanceModules?.find(item => item.role === role);
		return rows.length === 1 && rows[0].path === modulePath && rows[0].loaded === true && rows[0].sha256 === expected?.sha256;
	}) && value.modules.length === Object.keys(ROLES).length;
	const cursors = new Map();
	for (const frame of value.frames) {
		if (!frame.cursor) { continue; }
		const key = JSON.stringify(frame.cursor); const prior = cursors.get(key);
		if (prior && (prior.sessionId !== frame.sessionId || prior.epoch !== frame.epoch || prior.bound !== frame.bound)) {
			value.diagnostics.push({ code: 'frame-cursor-owner-conflict', frameOrdinal: frame.ordinal });
		}
		cursors.set(key, frame);
	}
	const helloBefore = (sessionId, cut, anchor) => records.filter(record => record.ordinal <= cut && record.decoded?.session_id === sessionId && record.decoded?.hello
		&& [['runtimeEpoch','runtime_epoch'],['headSeq','head_seq'],['sessionVersion','session_version'],['lastMutatedFromSeq','last_mutated_from_seq']]
			.every(([local, wire]) => String(anchor?.[local]) === String(record.decoded.hello[wire] ?? '0'))).at(-1);
	for (const sample of samples) {
		for (const row of sample.rows) {
			const proof = row.provenance;
			if (!proof || !Number.isSafeInteger(sample.rawOrdinalBefore)) { continue; }
			const paint = value.paints.find(item => item.realm === proof.realm && item.ordinal === proof.paintOrdinal);
			const input = value.inputs.find(item => item.realm === proof.realm && item.ordinal === proof.inputOrdinal);
			if (paint && paint.realm !== proof.realm || input && input.realm !== proof.realm) { continue; }
			const frame = value.frames.findLast(item => item.bound && JSON.stringify(item.cursor) === JSON.stringify(proof.cursor));
			if (!paint || !input?.valid || !frame || proof.sessionId !== frame.sessionId || paint.sessionId !== frame.sessionId
				|| input.sessionId !== frame.sessionId || input.boundSessionId !== frame.sessionId || input.snapshotSessionId !== frame.sessionId
				|| proof.paneOrdinal !== paint.paneOrdinal || paint.paneOrdinal !== input.paneOrdinal || row.paneSessionId !== frame.sessionId || paint.inputOrdinal !== input.ordinal || paint.rootId !== row.rootId
				|| !paint.rowIds.includes(row.turnId) || JSON.stringify(paint.cursor) !== JSON.stringify(proof.cursor)
				|| JSON.stringify(input.cursor) !== JSON.stringify(proof.cursor) || frame.rawOrdinal > sample.rawOrdinalBefore) { continue; }
			const hello = helloBefore(frame.sessionId, frame.rawOrdinal, frame.hello);
			if (!hello || String(hello.decoded.hello.runtime_epoch ?? '0') !== frame.epoch || String(frame.hello?.runtimeEpoch) !== frame.epoch) { continue; }
			const owned = paint.identities.find(item => item.rowId === row.turnId);
			if (!owned) { continue; }
			const scope = { sampleOrdinal: sample.sampleOrdinal, realm: proof.realm, paneOrdinal: paint.paneOrdinal, rowId: row.turnId, rootId: row.rootId, sessionId: frame.sessionId,
				epoch: frame.epoch, frameOrdinal: frame.ordinal, inputOrdinal: input.ordinal, paintOrdinal: paint.ordinal,
				rawOrdinal: frame.rawOrdinal, helloOrdinal: hello.ordinal, cursor: proof.cursor, agentId: owned.agentId, turnId: owned.turnId };
			if (!value.verifiedScopes.some(item => JSON.stringify(item) === JSON.stringify(scope))) { value.verifiedScopes.push(scope); }
		}
	}
	value.counts = { mainFrames: value.frames.filter(item => item.bound === true).length, rendererInputs: value.inputs.filter(item => item.valid === true).length, paints: value.paints.length, matchedScopes: value.verifiedScopes.length };
	value.status = value.diagnostics.length ? 'invalid' : modulesValid && value.realms.length > 0 && value.realms.every(realm => value.acquisitions.some(item => item.realm === realm) && value.inputs.some(item => item.realm === realm && item.valid) && value.paints.some(item => item.realm === realm) && value.verifiedScopes.some(item => item.realm === realm)) && Object.values(value.counts).every(count => count > 0) ? 'available' : 'unavailable';
	return value;
}
function requireScope(value, sample, row, owner, sourceOrdinal) {
	const matches = value.verifiedScopes.filter(scope => scope.sampleOrdinal === sample.sampleOrdinal && scope.rowId === row.turnId
		&& scope.rootId === row.rootId && scope.sessionId === owner.sessionId && (owner.epoch === undefined || scope.epoch === owner.epoch)
		&& (!owner.agentId || scope.agentId === owner.agentId) && (!owner.turnId || scope.turnId === owner.turnId || scope.turnId === null && [`overlay:${owner.turnId}`, `overlay:${owner.turnId}:think`].includes(scope.rowId))
		&& scope.rawOrdinal >= sourceOrdinal && scope.rawOrdinal <= sample.rawOrdinalBefore);
	return matches.length > 0;
}
module.exports = { KIND, GLOBAL, ROLES, moduleFile, chooseExecutionContext, createContextFence, selectLoadedModules, createRuntime, installMain, readMain, beginRenderer, rendererOwnershipProbe, installRenderer, readRenderer, observeRenderer, artifact, requireScope };
