/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const PROCESS_REL = 'src/vs/platform/process/common/process.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const NATIVE_REL = 'src/vs/platform/native/common/native.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const GITHUB_REL = 'src/vs/workbench/contrib/issue/browser/githubUploadService.ts';
const OVERLAY_REL = 'src/vs/workbench/contrib/issue/browser/issueReporterOverlay.ts';
const BASE_REPORTER_REL = 'src/vs/workbench/contrib/issue/browser/baseIssueReporterService.ts';
const FORM_REL = 'src/vs/workbench/contrib/issue/browser/issueFormService.ts';
const TROUBLESHOOT_REL = 'src/vs/workbench/contrib/issue/browser/issueTroubleshoot.ts';
const ISSUE_SERVICE_REL = 'src/vs/workbench/contrib/issue/electron-browser/issueService.ts';
const REPORTER_REL = 'src/vs/workbench/contrib/issue/electron-browser/issueReporterService.ts';
const PANE_REL = 'src/vs/workbench/contrib/issue/electron-browser/issueReporterEditorPane.ts';
const KEYBINDINGS_REL = 'src/vs/workbench/contrib/issue/electron-browser/issueReporterKeybindings.ts';
const RECORDING_REL = 'src/vs/workbench/contrib/issue/electron-browser/nativeRecordingService.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/issue/electron-browser/issue.contribution.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function countIncludes(source: string, needle: string): number {
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const systemInfoThen = `this.processService.getSystemInfo().then(info => {
			this.issueReporterModel.update({ systemInfo: info });
			this.receivedSystemInfo = true;

			this.updateSystemInfo(this.issueReporterModel.getData());
			this.updateButtonStates();
		})`;
const performanceInfoThenCtor = `this.processService.getPerformanceInfo().then(info => {
				this.updatePerformanceInfo(info as Partial<IssueReporterData>);
			})`;
const performanceInfoThenHandler = `this.processService.getPerformanceInfo().then(info => {
					this.updatePerformanceInfo(info as Partial<IssueReporterData>);
				})`;
const checkUpdatesCall = 'this.checkForUpdates()';
const executeCommandCall = 'void this.commandService.executeCommand(commandId)';
const populateSystemInfoCall = 'void this.populateSystemInfo()';
const updateExtensionPresetCall = 'void this.updateSelectedExtension(this.data.extensionId, false)';
const updateExtensionSelectedCall = 'void this.updateSelectedExtension(this.selectedExtension.id)';
const updateExtensionSelectCall = 'void this.updateSelectedExtension(this.extensionOptions[e.index]?.value)';
const searchSimilarCall = '() => this.doSearchSimilarIssues()';

const d773Calls: Array<[string, string, number]> = [
	[REPORTER_REL, systemInfoThen, 1],
	[REPORTER_REL, performanceInfoThenCtor, 1],
	[REPORTER_REL, performanceInfoThenHandler, 1],
	[REPORTER_REL, checkUpdatesCall, 1],
	[KEYBINDINGS_REL, executeCommandCall, 1],
	[PANE_REL, populateSystemInfoCall, 1],
	[OVERLAY_REL, updateExtensionPresetCall, 2],
	[OVERLAY_REL, updateExtensionSelectedCall, 1],
	[OVERLAY_REL, updateExtensionSelectCall, 1],
	[OVERLAY_REL, searchSimilarCall, 1],
];

suite('issue leftover Promise fire-and-forget catch scan (D773)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eleven leftover Promise double-chain sites in issue only', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d773Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 11);
		assert.ok(sites >= 4);
	});

	test('issue leftover getSystemInfo / getPerformanceInfo then and checkForUpdates are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(REPORTER_REL), 'utf8');
		const process = fs.readFileSync(resolveSource(PROCESS_REL), 'utf8');
		assertPromiseSignature(process, 'getSystemInfo(): Promise<SystemInfo>;');
		assertPromiseSignature(process, 'getPerformanceInfo(options?: { skipCache?: boolean; unbounded?: boolean }): Promise<PerformanceInfo>;');
		assertPromiseSignature(source, 'private async checkForUpdates(): Promise<void> {');
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, systemInfoThen);
		assertWrapped(source, performanceInfoThenCtor);
		assertWrapped(source, performanceInfoThenHandler);
		assertWrapped(source, checkUpdatesCall);
		assert.ok(!source.includes('this.processService.getSystemInfo().then(info => {\n\t\t\tthis.issueReporterModel.update({ systemInfo: info });\n\t\t\tthis.receivedSystemInfo = true;\n\n\t\t\tthis.updateSystemInfo(this.issueReporterModel.getData());\n\t\t\tthis.updateButtonStates();\n\t\t});'));
		assert.ok(!source.includes('this.checkForUpdates();'));
	});

	test('issue leftover executeCommand and populateSystemInfo voids are Promise double-chain', () => {
		const keybindings = fs.readFileSync(resolveSource(KEYBINDINGS_REL), 'utf8');
		const pane = fs.readFileSync(resolveSource(PANE_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(pane, 'private async populateSystemInfo(): Promise<void> {');
		assert.ok(keybindings.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(pane.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(keybindings, executeCommandCall);
		assertWrapped(pane, populateSystemInfoCall);
		assert.ok(!keybindings.includes('void this.commandService.executeCommand(commandId);'));
		assert.ok(!pane.includes('void this.populateSystemInfo();'));
	});

	test('issue leftover updateSelectedExtension voids and doSearchSimilarIssues timeout are Promise double-chain', () => {
		const overlay = fs.readFileSync(resolveSource(OVERLAY_REL), 'utf8');
		assertPromiseSignature(overlay, 'private async updateSelectedExtension(extensionId: string | undefined, loadExtensionData = true): Promise<void> {');
		assertPromiseSignature(overlay, 'private async doSearchSimilarIssues(): Promise<void> {');
		assert.ok(overlay.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(overlay, updateExtensionPresetCall);
		assertWrapped(overlay, updateExtensionSelectedCall);
		assertWrapped(overlay, updateExtensionSelectCall);
		assertWrapped(overlay, searchSimilarCall);
		assert.strictEqual(countIncludes(overlay, `${updateExtensionPresetCall}${doubleCatch}`), 2);
		assert.ok(!overlay.includes('void this.updateSelectedExtension(this.data.extensionId, false);'));
		assert.ok(!overlay.includes('void this.updateSelectedExtension(this.selectedExtension.id);'));
		assert.ok(!overlay.includes('void this.updateSelectedExtension(this.extensionOptions[e.index]?.value);'));
		assert.ok(!overlay.includes('() => this.doSearchSimilarIssues(), 300)'));
		assert.ok(overlay.includes('private searchSimilarIssues(): void {'));
		assert.ok(overlay.includes('this.searchSimilarIssues();'));
		assert.ok(!overlay.includes(`this.searchSimilarIssues()${doubleCatch}`));
	});

	test('opener / Action2.run / two-arg then / returned Promise / Resolve / openExternal / D145 stay skipped', () => {
		const reporter = fs.readFileSync(resolveSource(REPORTER_REL), 'utf8');
		const pane = fs.readFileSync(resolveSource(PANE_REL), 'utf8');
		const overlay = fs.readFileSync(resolveSource(OVERLAY_REL), 'utf8');
		const issueService = fs.readFileSync(resolveSource(ISSUE_SERVICE_REL), 'utf8');
		const recording = fs.readFileSync(resolveSource(RECORDING_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const troubleshoot = fs.readFileSync(resolveSource(TROUBLESHOOT_REL), 'utf8');
		const form = fs.readFileSync(resolveSource(FORM_REL), 'utf8');
		const base = fs.readFileSync(resolveSource(BASE_REPORTER_REL), 'utf8');
		const github = fs.readFileSync(resolveSource(GITHUB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(native, 'openExternal(url: string, defaultApplication?: string): Promise<boolean>;');
		assertPromiseSignature(github, 'resolveRepositoryId(owner: string, repo: string, token?: string): Promise<string>;');
		assertPromiseSignature(issueService, 'private async populateReporterDataAsync(data: IssueReporterData, dataOverrides: Partial<IssueReporterData>, extensionsLoaded?: DeferredPromise<void>): Promise<void> {');

		assert.ok(recording.includes("void this.nativeHostService.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');"));
		assert.ok(!recording.includes(`openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')${doubleCatch}`));
		assert.ok(overlay.includes('this.openExternalLink?.(issue.html_url);'));
		assert.ok(!overlay.includes(`this.openExternalLink?.(issue.html_url)${doubleCatch}`));
		assert.ok(overlay.includes('this.openExternalLink?.(perfWikiUrl);'));
		assert.ok(!overlay.includes(`this.openExternalLink?.(perfWikiUrl)${doubleCatch}`));
		assert.ok(pane.includes('async url => { await this.openerService.open(URI.parse(url), { openExternal: true }); },'));
		assert.ok(reporter.includes('await this.openerService.open(result.html_url, { openExternal: true });'));
		assert.ok(reporter.includes('await this.openerService.open(url, { openExternal: true });'));
		assert.ok(!reporter.includes(`openerService.open(result.html_url, { openExternal: true })${doubleCatch}`));
		assert.ok(form.includes('return this.openerService.open(issueTarget.url, { openExternal: true });'));
		assert.ok(!form.includes(`return this.openerService.open(issueTarget.url, { openExternal: true })${doubleCatch}`));

		assert.ok(issueService.includes('this.populateReporterDataAsync(issueReporterData, dataOverrides, extensionsLoaded).then(() => dataComplete.complete(), () => dataComplete.complete());'));
		assert.ok(!issueService.includes(`this.populateReporterDataAsync(issueReporterData, dataOverrides, extensionsLoaded).then(() => dataComplete.complete(), () => dataComplete.complete())${doubleCatch}`));

		assert.ok(contrib.includes('override async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(contrib.includes('return issueService.openReporter({ issueType: IssueType.PerformanceIssue });'));
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(troubleshoot.includes('run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(troubleshoot.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(troubleshoot.includes('return accessor.get(ITroubleshootIssueService).start();'));
		assert.ok(troubleshoot.includes('return accessor.get(ITroubleshootIssueService).stop();'));
		assert.ok(!troubleshoot.includes(doubleCatch));

		assert.ok(form.includes('repoId ??= await this.githubUploadService.resolveRepositoryId(gitHubDetails.owner, gitHubDetails.repositoryName, data.githubAccessToken);'));
		assert.ok(!form.includes(`resolveRepositoryId(gitHubDetails.owner, gitHubDetails.repositoryName, data.githubAccessToken)${doubleCatch}`));

		assert.ok(base.includes('fetch(`https://api.github.com/search/issues?q=${query}`).then((response) => {'));
		assert.ok(base.includes('}).catch(_ => {'));
		assert.ok(base.includes('this.updateExtensionStatus(targetExtension).catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(base.includes('this.updateExtensionStatus(matches[0]).catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(base.includes('this.close().catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.strictEqual((base.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 6);

		assert.ok(pane.includes('this.inputDisposables.add(this.recordingService.onDidChangeState(async (state) => {'));
		assert.ok(!pane.includes(`onDidChangeState(async (state) => {${doubleCatch}`));

		for (const source of [reporter, pane, overlay, issueService, recording, contrib, troubleshoot, form, base]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
