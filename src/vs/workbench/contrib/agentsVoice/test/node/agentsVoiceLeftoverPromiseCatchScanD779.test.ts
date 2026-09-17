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
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const CONTROLLER_REL = 'src/vs/workbench/contrib/chat/browser/voiceClient/voiceSessionController.ts';
const SESSIONS_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsModel.ts';
const WIDGET_REL = 'src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceWidget.ts';
const WINDOW_REL = 'src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceWindowService.ts';
const PICKER_REL = 'src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceSessionsPicker.ts';
const ONBOARDING_REL = 'src/vs/workbench/contrib/agentsVoice/browser/voiceModeOnboarding.ts';
const TRANSCRIPTS_REL = 'src/vs/workbench/contrib/agentsVoice/browser/transcriptsView/voiceTranscriptsView.ts';
const EVENT_STREAM_REL = 'src/vs/workbench/contrib/agentsVoice/browser/transcriptsView/voiceEventStreamView.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/agentsVoice/browser/agentsVoice.contribution.ts';
const BINDING_REL = 'src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceWidgetBinding.ts';

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

const submitFeedbackThen = `this.callbacks.submitFeedback(text).then(result => {
			if (result.ok) {
				this._feedbackDialogState.set({ isSubmitting: false, submitted: true }, undefined);
				setTimeout(() => { this._feedbackDialogState.set(null, undefined); }, 3000);
			} else {
				this._feedbackDialogState.set({ isSubmitting: false, submitted: false, error: result.error ?? localize('agentsVoice.feedbackError', "Failed to submit") }, undefined);
			}
		})`;
const switchToSessionCall = `this.commandService.executeCommand('_chat.voice.switchToSession', resource.toString())`;
const focusCall = 'this.hostService.focus(mainWindow)';
const pickerShowCall = 'picker.show()';

const d779Calls: Array<[string, string, number]> = [
	[WIDGET_REL, submitFeedbackThen, 1],
	[WINDOW_REL, switchToSessionCall, 2],
	[WINDOW_REL, focusCall, 1],
	[WINDOW_REL, pickerShowCall, 1],
];

suite('agentsVoice leftover Promise fire-and-forget catch scan (D779)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers five leftover Promise double-chain sites in agentsVoice only', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d779Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
	});

	test('agentsVoice leftover submitFeedback then is Promise double-chain', () => {
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const controller = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		assertPromiseSignature(widget, 'submitFeedback(feedbackText: string): Promise<{ ok: boolean; error?: string }>;');
		assertPromiseSignature(controller, 'async submitFeedback(feedbackText: string): Promise<{ ok: boolean; error?: string }> {');
		assert.ok(widget.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(widget, submitFeedbackThen);
		assert.ok(!widget.includes(`${submitFeedbackThen};`));
		assert.ok(!widget.includes(`${submitFeedbackThen}.catch(onUnexpectedError);`));
	});

	test('agentsVoice leftover switchToSession / focus / picker.show fire-and-forgets are Promise double-chain', () => {
		const windowSource = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const picker = fs.readFileSync(resolveSource(PICKER_REL), 'utf8');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(host, 'focus(targetWindow: Window, options?: { mode?: FocusMode }): Promise<void>;');
		assertPromiseSignature(picker, 'async show(): Promise<void> {');
		assert.ok(windowSource.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(windowSource, switchToSessionCall);
		assert.strictEqual(countIncludes(windowSource, `${switchToSessionCall}${doubleCatch}`), 2);
		assertWrapped(windowSource, focusCall);
		assertWrapped(windowSource, pickerShowCall);
		assert.ok(!windowSource.includes(`${switchToSessionCall};`));
		assert.ok(!windowSource.includes(`${switchToSessionCall}.catch(() => { /* ignore */ });`));
		assert.ok(!windowSource.includes(`${focusCall};`));
		assert.ok(!windowSource.includes('\t\t\t\tpicker.show();'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Connect / Watch / Resolve / Pty / D145 stay skipped', () => {
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const windowSource = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const picker = fs.readFileSync(resolveSource(PICKER_REL), 'utf8');
		const onboarding = fs.readFileSync(resolveSource(ONBOARDING_REL), 'utf8');
		const transcripts = fs.readFileSync(resolveSource(TRANSCRIPTS_REL), 'utf8');
		const eventStream = fs.readFileSync(resolveSource(EVENT_STREAM_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const binding = fs.readFileSync(resolveSource(BINDING_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const controller = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		const sessionsModel = fs.readFileSync(resolveSource(SESSIONS_MODEL_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(controller, 'connect(window: Window & typeof globalThis): Promise<void>;');
		assertPromiseSignature(sessionsModel, 'resolve(provider: string | string[] | undefined): Promise<void>;');

		assert.ok(onboarding.includes('void this.refreshMicrophones().catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(transcripts.includes('void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(eventStream.includes('void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);'));

		assert.ok(windowSource.includes('this.voiceSessionController.connect(mainWindow);'));
		assert.ok(!windowSource.includes(`this.voiceSessionController.connect(mainWindow)${doubleCatch}`));
		assert.ok(windowSource.includes('this.voiceSessionController.connect(mainWindow).then(() => {'));
		assert.ok(!windowSource.includes(`this.voiceSessionController.connect(mainWindow).then(() => {${doubleCatch}`));
		assert.ok(windowSource.includes('this.agentSessionsService.model.resolve(undefined);'));
		assert.ok(!windowSource.includes(`this.agentSessionsService.model.resolve(undefined)${doubleCatch}`));

		assert.ok(windowSource.includes("openPttKeySettings: () => this.commandService.executeCommand('workbench.action.openGlobalKeybindings', 'agentsVoice.pushToTalk'),"));
		assert.ok(!windowSource.includes(`openPttKeySettings: () => this.commandService.executeCommand('workbench.action.openGlobalKeybindings', 'agentsVoice.pushToTalk')${doubleCatch}`));
		assert.ok(windowSource.includes('submitFeedback: (text) => this.voiceSessionController.submitFeedback(text),'));
		assert.ok(!windowSource.includes(`submitFeedback: (text) => this.voiceSessionController.submitFeedback(text)${doubleCatch}`));

		assert.ok(picker.includes('picker.show();'));
		assert.ok(!picker.includes(`picker.show()${doubleCatch}`));
		assert.ok(onboarding.includes("void context.close().catch(() => { /* already closing */ })"));
		assert.ok(!onboarding.includes(`void context.close()${doubleCatch}`));
		assert.ok(onboarding.includes('audio.play().catch(error => {'));
		assert.ok(!onboarding.includes(`audio.play()${doubleCatch}`));

		assert.ok(binding.includes('void environmentService;'));
		assert.ok(!binding.includes(`void environmentService${doubleCatch}`));
		assert.ok(windowSource.includes('void pill.offsetWidth;'));
		assert.ok(!windowSource.includes(`void pill.offsetWidth${doubleCatch}`));

		assert.ok(contrib.includes('async run(): Promise<void> {'));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(!contrib.includes(`async run(): Promise<void> {${doubleCatch}`));
		assert.ok(!contrib.includes(doubleCatch));

		assert.ok(!widget.includes('.then(undefined,'));
		assert.ok(!windowSource.includes('.then(undefined,'));
		assert.ok(!widget.includes(` = ${submitFeedbackThen}${doubleCatch}`));

		for (const source of [widget, windowSource, picker, onboarding, transcripts, eventStream, contrib, binding]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
