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
const DEFAULT_LOG_LEVELS_REL = 'src/vs/workbench/services/log/common/defaultLogLevels.ts';
const OUTPUT_SVC_IFACE_REL = 'src/vs/workbench/services/output/common/output.ts';
const LOGS_ACTIONS_REL = 'src/vs/workbench/contrib/logs/common/logsActions.ts';
const LOGS_CONTRIB_REL = 'src/vs/workbench/contrib/logs/common/logs.contribution.ts';
const LOGS_CLEANER_REL = 'src/vs/workbench/contrib/logs/common/logsDataCleaner.ts';
const LOGS_ELECTRON_ACTIONS_REL = 'src/vs/workbench/contrib/logs/electron-browser/logsActions.ts';
const OUTPUT_SERVICES_REL = 'src/vs/workbench/contrib/output/browser/outputServices.ts';
const OUTPUT_CONTRIB_REL = 'src/vs/workbench/contrib/output/browser/output.contribution.ts';
const OUTPUT_MODEL_REL = 'src/vs/workbench/contrib/output/common/outputChannelModel.ts';
const OUTPUT_VIEW_REL = 'src/vs/workbench/contrib/output/browser/outputView.ts';

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

const setDefaultAllCall = 'this.defaultLogLevelsService.setDefaultLogLevel((<LogLevelQuickPickItem>e.item).level)';
const setDefaultChannelCall = 'this.defaultLogLevelsService.setDefaultLogLevel((<LogLevelQuickPickItem>e.item).level, logChannel.channel.extensionId)';
const registerLoopCall = 'this.onDidRegisterChannel(channelIdentifier.id)';
const registerEventCall = 'this.onDidRegisterChannel(id)';
const setLevelCall = 'this.setLevelIsDefaultContext()';
const showRemovedCall = 'this.showChannel(channels[0].id)';
const showDisposeCall = 'this.showChannel(channel.id)';

suite('Logs leftover remaining Promise fire-and-forget catch scan (D764)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('logs had fewer than four legal leftovers so this knife overflowed to output leftover remaining', () => {
		const logsActions = fs.readFileSync(resolveSource(LOGS_ACTIONS_REL), 'utf8');
		const logsContrib = fs.readFileSync(resolveSource(LOGS_CONTRIB_REL), 'utf8');
		const logsLegal =
			countIncludes(logsActions, `${setDefaultAllCall}${doubleCatch}`) +
			countIncludes(logsActions, `${setDefaultChannelCall}${doubleCatch}`);
		assert.ok(logsLegal < 4, `expected logs legal leftover <4, got ${logsLegal}`);
		assert.strictEqual(logsLegal, 2);
		assert.ok(logsContrib.includes('return action.run().finally(() => action.dispose());'));
		assert.ok(!logsContrib.includes(`return action.run().finally(() => action.dispose())${doubleCatch}`));
	});

	test('this knife covers nine leftover Promise double-chain sites', () => {
		const logsActions = fs.readFileSync(resolveSource(LOGS_ACTIONS_REL), 'utf8');
		const outputServices = fs.readFileSync(resolveSource(OUTPUT_SERVICES_REL), 'utf8');
		const sites =
			countIncludes(logsActions, `${setDefaultAllCall}${doubleCatch}`) +
			countIncludes(logsActions, `${setDefaultChannelCall}${doubleCatch}`) +
			countIncludes(outputServices, `${registerLoopCall}${doubleCatch}`) +
			countIncludes(outputServices, `${registerEventCall}${doubleCatch}`) +
			countIncludes(outputServices, `${setLevelCall}${doubleCatch}`) +
			countIncludes(outputServices, `${showRemovedCall}${doubleCatch}`) +
			countIncludes(outputServices, `${showDisposeCall}${doubleCatch}`);
		assert.ok(sites >= 4, `expected >=4 leftover sites, got ${sites}`);
		assert.strictEqual(sites, 9);
	});

	test('logs leftover setDefaultLogLevel voids are Promise double-chain; pick argument / returned openEditor stay skipped', () => {
		const source = fs.readFileSync(resolveSource(LOGS_ACTIONS_REL), 'utf8');
		const levels = fs.readFileSync(resolveSource(DEFAULT_LOG_LEVELS_REL), 'utf8');
		assertPromiseSignature(levels, 'setDefaultLogLevel(logLevel: LogLevel, extensionId?: string): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, setDefaultAllCall);
		assertWrapped(source, setDefaultChannelCall);
		assert.ok(!source.includes(`${setDefaultAllCall};`));
		assert.ok(!source.includes(`${setDefaultChannelCall};`));
		assert.ok(source.includes('this.getSessions().then(sessions => sessions.map((s, index): IQuickPickItem => ({'));
		assert.ok(!source.includes(`this.getSessions().then(sessions => sessions.map((s, index): IQuickPickItem => ({${doubleCatch}`));
		assert.ok(source.includes('this.getLogFiles(URI.parse(sessionResult.id!)).then(logFiles => logFiles.map((s): IQuickPickItem => ({'));
		assert.ok(!source.includes(`this.getLogFiles(URI.parse(sessionResult.id!)).then(logFiles => logFiles.map((s): IQuickPickItem => ({${doubleCatch}`));
		assert.ok(source.includes('return this.editorService.openEditor({ resource: URI.parse(logFileResult.id!), options: { pinned: true } }).then(() => undefined);'));
		assert.ok(!source.includes(`return this.editorService.openEditor({ resource: URI.parse(logFileResult.id!), options: { pinned: true } }).then(() => undefined)${doubleCatch}`));
	});

	test('output leftover onDidRegisterChannel / setLevelIsDefaultContext / showChannel voids are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(OUTPUT_SERVICES_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(OUTPUT_SVC_IFACE_REL), 'utf8');
		assertPromiseSignature(source, 'private async onDidRegisterChannel(channelId: string): Promise<void> {');
		assertPromiseSignature(source, 'private async setLevelIsDefaultContext(): Promise<void> {');
		assertPromiseSignature(iface, 'showChannel(id: string, preserveFocus?: boolean): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, registerLoopCall);
		assertWrapped(source, registerEventCall);
		assertWrapped(source, setLevelCall);
		assertWrapped(source, showRemovedCall);
		assertWrapped(source, showDisposeCall);
		assert.strictEqual(countIncludes(source, `${setLevelCall}${doubleCatch}`), 3);
		assert.ok(!source.includes('\t\t\tthis.onDidRegisterChannel(channelIdentifier.id);'));
		assert.ok(!source.includes('this._register(registry.onDidRegisterChannel(id => this.onDidRegisterChannel(id)));'));
		assert.ok(!source.includes('\t\t\tthis.setLevelIsDefaultContext();'));
		assert.ok(!source.includes('\t\t\t\tthis.showChannel(channels[0].id);'));
		assert.ok(!source.includes('\t\t\t\t\tthis.showChannel(channel.id);'));
	});

	test('already-double outputChannelModel / outputView / logsDataCleaner wraps stay; Watch / assigned then / returned loadModel stay skipped', () => {
		const model = fs.readFileSync(resolveSource(OUTPUT_MODEL_REL), 'utf8');
		const view = fs.readFileSync(resolveSource(OUTPUT_VIEW_REL), 'utf8');
		const cleaner = fs.readFileSync(resolveSource(LOGS_CLEANER_REL), 'utf8');
		const services = fs.readFileSync(resolveSource(OUTPUT_SERVICES_REL), 'utf8');
		assert.ok(model.includes('this.outputChannelModel.then(outputChannelModel => outputChannelModel.append(output)).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(model.includes('this.outputChannelModel.then(outputChannelModel => outputChannelModel.update(mode, till, immediate)).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(model.includes('this.outputChannelModel.then(outputChannelModel => outputChannelModel.clear()).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(model.includes('this.outputChannelModel.then(outputChannelModel => outputChannelModel.replace(value)).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(model.includes('this.outputChannelModel.then(outputChannelModel => outputChannelModel.updateChannelSources(files)).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(model.includes(`loadModelPromise.then(() => {
			if (mode === OutputChannelUpdateMode.Clear || mode === OutputChannelUpdateMode.Replace) {`));
		assert.ok(model.includes(`})${doubleCatch};`));
		assert.ok(model.includes('return this.outputChannelModel.then(outputChannelModel => outputChannelModel.loadModel());'));
		assert.ok(!model.includes(`return this.outputChannelModel.then(outputChannelModel => outputChannelModel.loadModel())${doubleCatch}`));
		assert.ok(model.includes('const loop = () => this.doWatch().then(() => this.poll());'));
		assert.ok(!model.includes('this.doWatch().then(() => this.poll()).catch(onUnexpectedError)'));
		assert.ok(view.includes('this.editorPromise?.then(() => this.editor.focus())?.catch(onUnexpectedError)?.catch(onUnexpectedError);'));
		assert.ok(cleaner.includes('Promises.settled(toDelete.map(stat => this.fileService.del(stat.resource, { recursive: true }))).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(services.includes('this.outputFolderCreationPromise = this.fileService.createFolder(this.outputLocation).then(() => undefined);'));
		assert.ok(!services.includes(`this.outputFolderCreationPromise = this.fileService.createFolder(this.outputLocation).then(() => undefined)${doubleCatch}`));
	});

	test('opener / Action2.run / Connect / Watch / Resolve / Pty / D145 stay skipped', () => {
		const logsActions = fs.readFileSync(resolveSource(LOGS_ACTIONS_REL), 'utf8');
		const logsContrib = fs.readFileSync(resolveSource(LOGS_CONTRIB_REL), 'utf8');
		const electronActions = fs.readFileSync(resolveSource(LOGS_ELECTRON_ACTIONS_REL), 'utf8');
		const outputContrib = fs.readFileSync(resolveSource(OUTPUT_CONTRIB_REL), 'utf8');
		const outputServices = fs.readFileSync(resolveSource(OUTPUT_SERVICES_REL), 'utf8');
		assert.ok(logsContrib.includes('outputService.showChannel(windowLogId);'));
		assert.ok(!logsContrib.includes(`outputService.showChannel(windowLogId)${doubleCatch}`));
		assert.ok(logsContrib.includes('run(servicesAccessor: ServicesAccessor): Promise<void> {'));
		assert.ok(outputContrib.includes('accessor.get(IOutputService).showChannel(channelId, true);'));
		assert.ok(!outputContrib.includes(`accessor.get(IOutputService).showChannel(channelId, true)${doubleCatch}`));
		assert.ok(outputContrib.includes('outputService.showChannel(outputService.registerCompoundLogChannel(result));'));
		assert.ok(!outputContrib.includes(`outputService.showChannel(outputService.registerCompoundLogChannel(result))${doubleCatch}`));
		assert.ok(outputContrib.includes('that.openActiveOutput();'));
		assert.ok(!outputContrib.includes(`that.openActiveOutput()${doubleCatch}`));
		assert.ok(outputContrib.includes('accessibilitySignalService.playSignal(AccessibilitySignal.clear);'));
		assert.ok(!outputContrib.includes(`accessibilitySignalService.playSignal(AccessibilitySignal.clear)${doubleCatch}`));
		assert.ok(outputContrib.includes('outputService.showChannel(channelId);'));
		assert.ok(!outputContrib.includes(`outputService.showChannel(channelId)${doubleCatch}`));
		assert.ok(electronActions.includes('return this.nativeHostService.showItemInFolder('));
		for (const source of [logsActions, logsContrib, electronActions, outputContrib, outputServices]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
