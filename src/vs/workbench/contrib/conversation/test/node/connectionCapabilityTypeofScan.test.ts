/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CONVERSATION_SRC_ROOT, collectConversationProductionFiles } from './conversationImportBoundaryScan.js';

/**
 * On the desktop every connection member is a function: the renderer-side
 * forwarding proxy answers any string property with an `async function`, so
 * `typeof connection.method === 'function'` cannot stand in for "the engine
 * advertised this RPC". Capability is read from the connection snapshot
 * (`isAdvertisedEngineRpc` and the dedicated snapshot fields) instead.
 *
 * This scan freezes the existing `typeof` sites so no new production code in
 * conversation / navigator / sources decides a capability that way. Three
 * shapes count as a hit, all compared with `=== 'function'` or `!== 'function'`:
 *
 * 1. dot member on a connection receiver: `typeof this.connection.listMemory`;
 * 2. bracket member on the same receivers: `typeof connection[method]`;
 * 3. a `const` / `let` in the same function whose initializer is one of the
 *    two forms above, later compared with `typeof name`.
 *
 * Receivers are `connection`, `uaConnection`, `connectionService` and
 * `connectionEvents`, with or without `this.`. Parameters (`typeof hook`
 * where `hook` is a parameter) and cross-function flow are not tracked.
 *
 * Keys are `<relative file>#<member>` for shapes 1, `#[expr]` for shape 2 and
 * `#<local>=<member>` for shape 3. Add a key only after the capability snapshot
 * cannot express the check (see the p1 plan, pending item 1).
 */

const CONTRIB_ROOT = path.resolve(CONVERSATION_SRC_ROOT, '..');
const SCAN_ROOTS = ['conversation', 'navigator', 'sources'] as const;
const MIN_FILES_PER_ROOT: Readonly<Record<typeof SCAN_ROOTS[number], number>> = { conversation: 80, navigator: 10, sources: 20 };

const RECEIVER = String.raw`(?:this\.)?(?:connection|uaConnection|connectionService|connectionEvents)`;
const FUNCTION_COMPARISON = String.raw`\s*(?:===|!==)\s*'function'`;
const DOT_MEMBER_TYPEOF = new RegExp(String.raw`typeof\s+${RECEIVER}\.(?<member>[A-Za-z_$][\w$]*)${FUNCTION_COMPARISON}`, 'g');
const BRACKET_MEMBER_TYPEOF = new RegExp(String.raw`typeof\s+${RECEIVER}\[(?<expr>[^\]]+)\]${FUNCTION_COMPARISON}`, 'g');
const LOCAL_TYPEOF = new RegExp(String.raw`typeof\s+(?<name>[A-Za-z_$][\w$]*)${FUNCTION_COMPARISON}`, 'g');
const RECEIVER_NAMES = new Set(['this', 'connection', 'uaConnection', 'connectionService', 'connectionEvents']);

/** A class member header (one tab) or a module-level function: walking back past it leaves the current function. */
const CLASS_MEMBER_HEADER = /^\t(?!\t)(?!\})(?!\/\/)(?!\*)(?!@)(?!(?:if|for|while|switch|return|const|let|var|else|try|catch|finally|throw|await|do|case|default|break|continue|new|yield|delete|void|typeof|export|import)\b)[^\t].*\(/;
const MODULE_FUNCTION_HEADER = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\b|^(?:export\s+)?(?:const|let)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\(/;

function isFunctionBoundary(line: string): boolean {
	return CLASS_MEMBER_HEADER.test(line) || MODULE_FUNCTION_HEADER.test(line);
}

function localDeclarationPattern(name: string): RegExp {
	const escaped = name.replace(/\$/g, '\\$');
	return new RegExp(String.raw`(?:const|let)\s+${escaped}\s*(?::[^=]+)?=\s*${RECEIVER}(?:\.(?<member>[A-Za-z_$][\w$]*)|\[(?<expr>[^\]]+)\])\s*;`);
}

/** Member the local was taken from, if a declaration sits in the same function above `lineIndex`. */
function findLocalMember(lines: readonly string[], lineIndex: number, name: string): string | undefined {
	const declaration = localDeclarationPattern(name);
	for (let i = lineIndex; i >= 0; i--) {
		const match = declaration.exec(lines[i]);
		if (match?.groups) {
			return match.groups.member ?? `[${match.groups.expr}]`;
		}
		if (i < lineIndex && isFunctionBoundary(lines[i])) {
			return undefined;
		}
	}
	return undefined;
}

export function scanConnectionTypeofHits(source: string): string[] {
	const hits = new Set<string>();
	const lines = source.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		for (const match of line.matchAll(DOT_MEMBER_TYPEOF)) {
			hits.add(match.groups!.member);
		}
		for (const match of line.matchAll(BRACKET_MEMBER_TYPEOF)) {
			hits.add(`[${match.groups!.expr}]`);
		}
		for (const match of line.matchAll(LOCAL_TYPEOF)) {
			const name = match.groups!.name;
			if (RECEIVER_NAMES.has(name)) {
				continue;
			}
			const member = findLocalMember(lines, i, name);
			if (member !== undefined) {
				hits.add(`${name}=${member}`);
			}
		}
	}
	return [...hits];
}

/**
 * Every current hit, by file then key. Dot and bracket members are the
 * capability `typeof`s the p1 plan leaves in place (pending item 1 keeps
 * Memory, Token Usage, Provider / Model writes and `listProviderPresetCatalog`
 * on `typeof`; `probeEngine` is a client probe; `onDidChangeConnection`,
 * `getConnectionSnapshot`, `getConnectionPhase` and `isEngineConnected` are
 * event / required-member null guards). Locals are the call-time checks that
 * follow a snapshot `SUPPORTED` decision.
 */
const ALLOWED_TYPEOF_SITES: readonly string[] = [
	'conversation/browser/agentSessionContext.ts#getConnectionPhase',
	'conversation/browser/agentSessionContext.ts#getConnectionSnapshot',
	'conversation/browser/agentSessionContext.ts#onDidChangeConnection',
	'conversation/browser/connectionPreferencesPane.ts#hook=listDevices',
	'conversation/browser/connectionPreferencesPane.ts#hook=listPending',
	'conversation/browser/connectionPreferencesPane.ts#probeEngine',
	'conversation/browser/engineClipboardSection.ts#hook=listClipboard',
	'conversation/browser/engineContextVariableSection.ts#hook=listContextVariable',
	'conversation/browser/engineHooksSection.ts#listHookPoints',
	'conversation/browser/engineMcpRuntimePanel.ts#mcpTools=getMcpServerTools',
	'conversation/browser/engineMemorySection.ts#deleteMemory',
	'conversation/browser/engineMemorySection.ts#deleteMemory=deleteMemory',
	'conversation/browser/engineMemorySection.ts#listMemory',
	'conversation/browser/engineMemorySection.ts#listMemory=listMemory',
	'conversation/browser/engineMemorySection.ts#saveMemory',
	'conversation/browser/engineMemorySection.ts#saveMemory=saveMemory',
	'conversation/browser/engineMemorySection.ts#searchMemory=searchMemory',
	'conversation/browser/enginePluginsSection.ts#[method]',
	'conversation/browser/enginePluginsSection.ts#pluginInfo=getPluginInfo',
	'conversation/browser/enginePreferencesPane.ts#probeEngine',
	'conversation/browser/engineProviderModelSection.ts#clearProviderCredentials',
	'conversation/browser/engineProviderModelSection.ts#deleteModel',
	'conversation/browser/engineProviderModelSection.ts#listProviderPresetCatalog',
	'conversation/browser/engineProviderModelSection.ts#listProviderStatus',
	'conversation/browser/engineProviderModelSection.ts#setModelEnabled',
	'conversation/browser/engineProviderModelSection.ts#testModelProfile',
	'conversation/browser/engineProviderModelSection.ts#upsertModel',
	'conversation/browser/engineProviderModelSection.ts#upsertProviderCredentials',
	'conversation/browser/engineRulesSection.ts#deleteProjectRule',
	'conversation/browser/engineRulesSection.ts#listProjectRules',
	'conversation/browser/engineRulesSection.ts#remove=deleteProjectRule',
	'conversation/browser/engineRulesSection.ts#upsert=upsertProjectRule',
	'conversation/browser/engineRulesSection.ts#upsertProjectRule',
	'conversation/browser/engineTokenUsageSection.ts#getGlobalUsage',
	'conversation/browser/engineTriggersSection.ts#hook=listTriggers',
	'navigator/browser/navigatorTeamList.ts#listTeams',
	'sources/browser/sourcesFilesExplorer.ts#connectionChanged=onDidChangeConnection',
	'sources/browser/sourcesFilesList.ts#connectionChanged=onDidChangeConnection',
	'sources/browser/sourcesFilesList.ts#listFiles=listFiles',
	'sources/browser/sourcesFilesList.ts#readFile=readFile',
	'sources/common/sourcesChangesReadModel.ts#hook=readGitChanges',
	'sources/common/sourcesChangesReadModel.ts#hook=readGitSummary',
	'sources/common/sourcesChangesReadModel.ts#isEngineConnected',
	'sources/common/sourcesChangesReadModel.ts#read=getCapabilitySnapshot',
];

function toContribRelative(filePath: string): string {
	return path.relative(CONTRIB_ROOT, filePath).split(path.sep).join('/');
}

suite('Connection capability typeof scan (p1)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('scanner recognises dot, bracket and same-function local shapes and skips parameters', () => {
		const source = [
			'export function fromParam(connected: boolean, hook: (() => void) | undefined): boolean {',
			'\treturn connected && typeof hook === \'function\';',
			'}',
			'class Section {',
			'\tprivate canList(): boolean {',
			'\t\treturn typeof this.connection.listThings === \'function\';',
			'\t}',
			'\tprivate hasMethod(method: string): boolean {',
			'\t\treturn typeof connection[method] !== \'function\';',
			'\t}',
			'\tprivate async load(): Promise<void> {',
			'\t\tconst hook = this.uaConnection.readThings;',
			'\t\tif (typeof hook !== \'function\') {',
			'\t\t\treturn;',
			'\t\t}',
			'\t\tconst ctor = ResizeObserver;',
			'\t\tif (typeof ctor !== \'function\') {',
			'\t\t\treturn;',
			'\t\t}',
			'\t}',
			'\tprivate other(hook: () => void): boolean {',
			'\t\treturn typeof hook === \'function\';',
			'\t}',
			'}',
		].join('\n');
		assert.deepStrictEqual(scanConnectionTypeofHits(source).sort(), ['[method]', 'hook=readThings', 'listThings']);
	});

	test('production typeof-on-connection sites in conversation / navigator / sources match the allow list', () => {
		const hits: string[] = [];
		for (const root of SCAN_ROOTS) {
			const files = collectConversationProductionFiles(path.join(CONTRIB_ROOT, root));
			assert.ok(files.length >= MIN_FILES_PER_ROOT[root], `expected >= ${MIN_FILES_PER_ROOT[root]} production .ts under ${root}, found ${files.length} (empty scan is a false green)`);
			for (const file of files) {
				const rel = toContribRelative(file);
				for (const key of scanConnectionTypeofHits(fs.readFileSync(file, 'utf8'))) {
					hits.push(`${rel}#${key}`);
				}
			}
		}
		assert.deepStrictEqual(hits.sort(), [...ALLOWED_TYPEOF_SITES].sort());
	});
});
