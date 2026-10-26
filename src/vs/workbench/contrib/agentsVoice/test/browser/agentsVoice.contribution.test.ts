/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { observableValue, transaction } from '../../../../../base/common/observable.js';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { AGENTS_VOICE_CONNECTED, AGENTS_VOICE_ENTITLED } from '../../common/agentsVoice.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { SHOW_VOICE_MODE_ONBOARDING_COMMAND } from '../../../chat/browser/speechToText/micButtonMenuActions.js';
import { IChatWidget, IChatWidgetService, IChatWidgetViewModelChangeEvent } from '../../../chat/browser/chat.js';
import { IChatViewModel } from '../../../chat/common/model/chatViewModel.js';
import { IVoiceSessionController, VoiceState } from '../../../chat/browser/voiceClient/voiceSessionController.js';

import '../../browser/agentsVoice.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function findCommandPaletteItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const defaultWindow: Record<string, ContextKeyValue> = {
	[IsSessionsWindowContext.key]: false,
	[ChatContextKeys.enabled.key]: true,
	'config.agents.voice.enabled': true,
	[AGENTS_VOICE_ENTITLED.key]: true,
	[AGENTS_VOICE_CONNECTED.key]: true,
};

const agentsWindowVoiceReady: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

const sessionsWindowOnlyCommandIds = [
	'agentsVoice.openSettings',
	SHOW_VOICE_MODE_ONBOARDING_COMMAND,
	'agentsVoice.pushToTalk',
	'agentsVoice.disconnect',
	'agentsVoice.simulateConnection',
	'agentsVoice.resetOnboarding',
];

suite('AgentsVoiceContribution - default window Command Palette', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Voice F1 commands stay in Command Palette for Agents Window only', () => {
		for (const commandId of sessionsWindowOnlyCommandIds) {
			const item = findCommandPaletteItem(commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);

			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${commandId} in Command Palette`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindowVoiceReady),
				true,
				`Agents Window may list ${commandId} in Command Palette`
			);
		}
	});
});

suite('AgentsVoiceContribution - startVoiceInChat', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	const sessionA = URI.parse('chat-session://workspace/folder/session-a');
	const sessionB = URI.parse('chat-session://workspace/folder/session-b');

	class Composer extends mock<IChatWidget>() {
		readonly changed = disposables.add(new Emitter<IChatWidgetViewModelChangeEvent>());
		readonly hidden = disposables.add(new Emitter<void>());
		override readonly onDidChangeViewModel = this.changed.event;
		override readonly onDidHide = this.hidden.event;
		override visible = true;
		override viewModel: IChatViewModel | undefined;

		constructor(resource?: URI) {
			super();
			this.viewModel = resource ? this.model(resource) : undefined;
		}

		private model(resource: URI): IChatViewModel {
			return new class extends mock<IChatViewModel>() {
				override readonly sessionResource = resource;
			}();
		}

		showSession(resource: URI): void {
			const previousSessionResource = this.viewModel?.sessionResource;
			this.viewModel = this.model(resource);
			this.changed.fire({ previousSessionResource, currentSessionResource: resource });
		}
	}

	class Controller extends mock<IVoiceSessionController>() {
		override readonly isConnected = observableValue('connected', false);
		override readonly isConnecting = observableValue('connecting', false);
		override readonly isReconnecting = observableValue('reconnecting', false);
		override readonly voiceState = observableValue<VoiceState>('state', 'idle');
		override readonly targetSession = observableValue<URI | undefined>('target', undefined);
		override readonly hasDraftTarget = observableValue('draft', false);
		readonly holds: boolean[] = [];
		readonly targets: (string | undefined)[] = [];
		readonly ups: { source: 'explicit' | 'internal' | undefined; forceFinish: boolean | undefined }[] = [];
		downCalls = 0;
		connectCalls = 0;
		discardCalls = 0;
		held = false;
		readonly connectEntered = new DeferredPromise<void>();
		connectStep: () => Promise<void> = async () => { this.isConnecting.set(true, undefined); };
		override setActiveWindow(): void { }
		override activateSession(): void { }
		override setTargetSession(resource: URI | undefined): void {
			this.targets.push(resource?.toString());
			this.targetSession.set(resource, undefined);
			this.hasDraftTarget.set(false, undefined);
		}
		override setDraftTarget(): void {
			this.targetSession.set(undefined, undefined);
			this.hasDraftTarget.set(true, undefined);
		}
		override setAutoListenHeld(held: boolean): void {
			this.holds.push(held);
			this.held = held;
		}
		override connect(): Promise<void> {
			this.connectCalls++;
			this.connectEntered.complete();
			return this.connectStep();
		}
		override pttDown(): void { this.downCalls++; }
		override pttUp(source?: 'explicit' | 'internal', forceFinish?: boolean): void { this.ups.push({ source, forceFinish }); }
		override discardListening(): void { this.discardCalls++; }
		admit(): void {
			transaction(tx => {
				this.isConnecting.set(false, tx);
				this.isReconnecting.set(false, tx);
				this.isConnected.set(true, tx);
			});
		}
	}

	function createHarness(options: {
		readonly handsFree?: boolean;
		readonly hold?: Promise<void>;
		readonly focused?: Composer | null;
		readonly bridge?: () => Promise<string | undefined>;
	} = {}) {
		const a = options.focused ?? new Composer(sessionA);
		const b = new Composer(sessionB);
		const focusChanged = disposables.add(new Emitter<IChatWidget | undefined>());
		const removed = disposables.add(new Emitter<IChatWidget>());
		const controller = new Controller();
		let focused: IChatWidget | undefined = options.focused === null ? undefined : a;
		let hold = options.hold;
		let bridgeCalls = 0;
		const widgets: IChatWidget[] = [a, b];
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IConfigurationService, new TestConfigurationService({
			'agents.voice.handsFree': options.handsFree ?? true,
		}));
		instantiationService.stub(IKeybindingService, new class extends mock<IKeybindingService>() {
			override enableKeybindingHoldMode(): Promise<void> | undefined { return hold; }
		});
		instantiationService.stub(ICommandService, new class extends mock<ICommandService>() {
			override async executeCommand<T>(commandId: string): Promise<T> {
				assert.strictEqual(commandId, '_chat.voice.getCurrentSession');
				bridgeCalls++;
				return (await (options.bridge?.() ?? Promise.resolve(a.viewModel?.sessionResource?.toString()))) as T;
			}
		});
		instantiationService.stub(IChatWidgetService, new class extends mock<IChatWidgetService>() {
			override get lastFocusedWidget(): IChatWidget | undefined { return focused; }
			override readonly onDidChangeFocusedWidget = focusChanged.event;
			override readonly onDidRemoveWidget = removed.event;
			override getWidgetBySessionResource(resource: URI): IChatWidget | undefined {
				return widgets.find(widget => isEqual(widget.viewModel?.sessionResource, resource));
			}
		});
		instantiationService.stub(IVoiceSessionController, controller);
		const command = CommandsRegistry.getCommand('agentsVoice.startVoiceInChat');
		assert.ok(command);
		return {
			a, b, controller,
			run: (widget?: IChatWidget) => instantiationService.invokeFunction(accessor => Promise.resolve(command.handler(accessor, widget ? { widget } : undefined))),
			focus: (widget: IChatWidget | undefined) => { focused = widget; focusChanged.fire(widget); },
			remove: (widget: IChatWidget) => { widgets.splice(widgets.indexOf(widget), 1); removed.fire(widget); },
			setHold: (value: Promise<void> | undefined) => { hold = value; },
			get bridgeCalls() { return bridgeCalls; },
			assertReleased: () => assert.deepStrictEqual([
				focusChanged.hasListeners(), removed.hasListeners(),
				a.changed.hasListeners(), a.hidden.hasListeners(), b.changed.hasListeners(), b.hidden.hasListeners(),
			], [false, false, false, false, false, false]),
		};
	}

	async function flush(): Promise<void> {
		for (let step = 0; step < 8; step++) {
			await Promise.resolve();
		}
	}

	test('connect resolve does not release the hands-free gate before admission', async () => {
		const h = createHarness();
		const run = h.run();
		await h.controller.connectEntered.p;
		await flush();
		assert.deepStrictEqual({ held: h.controller.held, down: h.controller.downCalls, ups: h.controller.ups }, { held: true, down: 0, ups: [] });
		h.controller.admit();
		await run;
		assert.deepStrictEqual({ held: h.controller.held, down: h.controller.downCalls, ups: h.controller.ups, target: h.controller.targetSession.get()?.toString(), bridge: h.bridgeCalls }, { held: false, down: 0, ups: [], target: sessionA.toString(), bridge: 0 });
		h.assertReleased();
	});

	for (const timing of ['before-connect-resolve', 'after-connect-resolve', 'return-to-A'] as const) {
		test(`composer departure cancels once: ${timing}`, async () => {
			const connect = new DeferredPromise<void>();
			const h = createHarness();
			h.controller.connectStep = () => { h.controller.isConnecting.set(true, undefined); return connect.p; };
			const run = h.run();
			await h.controller.connectEntered.p;
			if (timing !== 'before-connect-resolve') {
				connect.complete();
				await flush();
			}
			h.focus(h.b);
			if (timing === 'return-to-A') {
				h.focus(h.a);
			}
			await run;
			connect.complete();
			h.controller.admit();
			await flush();
			assert.deepStrictEqual({ held: h.controller.held, down: h.controller.downCalls, target: h.controller.targetSession.get() }, { held: true, down: 0, target: undefined });
			h.assertReleased();
		});
	}

	for (const change of ['view-model', 'draft-materialized', 'hidden', 'removed'] as const) {
		test(`owner lifecycle cancels admission: ${change}`, async () => {
			const h = createHarness({ focused: new Composer(change === 'draft-materialized' ? undefined : sessionA) });
			const run = h.run();
			await h.controller.connectEntered.p;
			if (change === 'hidden') {
				h.a.visible = false;
				h.a.hidden.fire();
			} else if (change === 'removed') {
				h.remove(h.a);
			} else {
				h.a.showSession(sessionB);
			}
			await run;
			h.controller.admit();
			assert.deepStrictEqual([h.controller.held, h.controller.downCalls, h.controller.hasDraftTarget.get()], [true, 0, false]);
			h.assertReleased();
		});
	}

	for (const origin of ['pane', 'editor'] as const) {
		test(`toolbar uses the actual ${origin} widget rather than the pane bridge`, async () => {
			const h = createHarness();
			const owner = origin === 'pane' ? h.a : h.b;
			const run = h.run(owner);
			await h.controller.connectEntered.p;
			assert.strictEqual(h.controller.targetSession.get()?.toString(), owner.viewModel?.sessionResource.toString());
			h.controller.admit();
			await run;
			assert.deepStrictEqual([h.bridgeCalls, h.controller.held], [0, false]);
			h.assertReleased();
		});
	}

	test('pane session change cancels while a different editor is last focused', async () => {
		const h = createHarness();
		h.focus(h.b);
		const run = h.run(h.a);
		await h.controller.connectEntered.p;
		h.a.showSession(sessionB);
		await run;
		h.controller.admit();
		assert.strictEqual(h.controller.held, true);
		h.assertReleased();
	});

	test('legacy async revalidation keeps the gate while owner changes after admission', async () => {
		const revalidate = new DeferredPromise<string | undefined>();
		let queries = 0;
		const h = createHarness({ focused: null, bridge: () => ++queries === 1 ? Promise.resolve(sessionA.toString()) : revalidate.p });
		const run = h.run();
		await h.controller.connectEntered.p;
		h.controller.admit();
		await flush();
		assert.deepStrictEqual([queries, h.controller.held], [2, true]);
		h.focus(h.b);
		await run;
		revalidate.complete(sessionA.toString());
		await flush();
		assert.strictEqual(h.controller.held, true);
		h.assertReleased();
	});

	for (const bridge of [async () => undefined, async () => 'chat-session:/not-open', async () => { throw new Error('missing bridge'); }]) {
		test(`unidentifiable legacy owner stays silent: ${bridge.toString()}`, async () => {
			const h = createHarness({ focused: null, bridge });
			await h.run();
			assert.deepStrictEqual([h.controller.connectCalls, h.controller.downCalls, h.controller.held], [0, 0, true]);
			h.assertReleased();
		});
	}

	test('a cancelled late legacy lookup cannot clear or release the new editor intent', async () => {
		const lookup = new DeferredPromise<string | undefined>();
		const h = createHarness({ focused: null, bridge: () => lookup.p });
		const a = h.run();
		h.focus(h.b);
		const b = h.run(h.b);
		await h.controller.connectEntered.p;
		lookup.complete(sessionA.toString());
		await a;
		assert.deepStrictEqual([h.controller.targetSession.get()?.toString(), h.controller.held], [sessionB.toString(), true]);
		h.controller.admit();
		await b;
		assert.deepStrictEqual([h.controller.targetSession.get()?.toString(), h.controller.held], [sessionB.toString(), false]);
		h.assertReleased();
	});

	test('late connect failure is observed after cancellation and does not affect a new intent', async () => {
		const firstConnect = new DeferredPromise<void>();
		const h = createHarness();
		let calls = 0;
		h.controller.connectStep = () => { h.controller.isConnecting.set(true, undefined); return ++calls === 1 ? firstConnect.p : Promise.resolve(); };
		const a = h.run();
		await h.controller.connectEntered.p;
		h.focus(h.b);
		await a;
		const b = h.run(h.b);
		firstConnect.error(new Error('old connect failed'));
		await flush();
		assert.deepStrictEqual([h.controller.targetSession.get()?.toString(), h.controller.held], [sessionB.toString(), true]);
		h.controller.admit();
		await b;
		h.assertReleased();
	});

	test('cold manual toolbar click only connects', async () => {
		const h = createHarness({ handsFree: false });
		const run = h.run();
		await h.controller.connectEntered.p;
		h.controller.admit();
		await run;
		assert.deepStrictEqual([h.controller.downCalls, h.controller.ups, h.controller.held], [0, [], false]);
		h.assertReleased();
	});

	test('an explicit press after a cancelled admission restores the quiet connected session for B', async () => {
		const h = createHarness();
		const a = h.run();
		await h.controller.connectEntered.p;
		h.focus(h.b);
		await a;
		h.controller.admit();
		assert.strictEqual(h.controller.held, true);
		await h.run(h.b);
		assert.deepStrictEqual({ held: h.controller.held, target: h.controller.targetSession.get()?.toString(), down: h.controller.downCalls },
			{ held: false, target: sessionB.toString(), down: 0 });
		h.assertReleased();
	});

	for (const handsFree of [false, true]) {
		test(`cold hold released before admission never records (handsFree=${handsFree})`, async () => {
			const hold = new DeferredPromise<void>();
			const h = createHarness({ handsFree, hold: hold.p });
			const run = h.run();
			await h.controller.connectEntered.p;
			hold.complete();
			await run;
			h.controller.admit();
			assert.deepStrictEqual([h.controller.downCalls, h.controller.ups, h.controller.held], [0, [], true]);
			h.assertReleased();
		});
	}

	test('cold manual hold release force-finishes even immediately after delayed admission', async () => {
		const hold = new DeferredPromise<void>();
		const h = createHarness({ handsFree: false, hold: hold.p });
		const run = h.run();
		await h.controller.connectEntered.p;
		await flush();
		h.controller.admit();
		await flush();
		assert.strictEqual(h.controller.downCalls, 1);
		hold.complete();
		await run;
		assert.deepStrictEqual(h.controller.ups, [{ source: 'explicit', forceFinish: true }]);
		h.assertReleased();
	});

	test('a replaced cold hold release cannot finish a newer warm press', async () => {
		const oldHold = new DeferredPromise<void>();
		const newHold = new DeferredPromise<void>();
		const h = createHarness({ handsFree: false, hold: oldHold.p });
		const a = h.run();
		await h.controller.connectEntered.p;
		h.controller.admit();
		await flush();
		h.setHold(newHold.p);
		const b = h.run();
		await a;
		oldHold.complete();
		await flush();
		assert.deepStrictEqual(h.controller.ups, []);
		newHold.complete();
		await b;
		assert.deepStrictEqual(h.controller.ups, [{ source: 'explicit', forceFinish: false }]);
		h.assertReleased();
	});

	for (const terminal of ['early-return', 'failed', 'reconnect-ended', 'rejected'] as const) {
		test(`terminal connection settles the command and its listeners: ${terminal}`, async () => {
			const h = createHarness();
			if (terminal === 'early-return') {
				h.controller.connectStep = async () => { };
			} else if (terminal === 'rejected') {
				h.controller.connectStep = async () => { throw new Error('connection rejected'); };
			}
			const run = h.run();
			if (terminal === 'rejected') {
				await assert.rejects(run, /connection rejected/);
			} else {
				await h.controller.connectEntered.p;
				if (terminal !== 'early-return') {
					if (terminal === 'reconnect-ended') {
						h.controller.isReconnecting.set(true, undefined);
					}
					h.controller.isConnecting.set(false, undefined);
					h.controller.isReconnecting.set(false, undefined);
				}
				await run;
			}
			assert.deepStrictEqual([h.controller.downCalls, h.controller.held], [0, true]);
			h.assertReleased();
		});
	}

	test('initial connecting=false is not an early failure during an async connection request', async () => {
		const auth = new DeferredPromise<void>();
		const h = createHarness();
		h.controller.connectStep = async () => { await auth.p; h.controller.isConnecting.set(true, undefined); };
		const run = h.run();
		await h.controller.connectEntered.p;
		await flush();
		assert.strictEqual(h.a.changed.hasListeners(), true);
		auth.complete();
		await flush();
		h.controller.admit();
		await run;
		assert.strictEqual(h.controller.held, false);
		h.assertReleased();
	});

	test('disconnect after a cold hold admission cancels its pending release', async () => {
		const hold = new DeferredPromise<void>();
		const h = createHarness({ handsFree: false, hold: hold.p });
		const run = h.run();
		await h.controller.connectEntered.p;
		h.controller.admit();
		await flush();
		h.controller.isConnected.set(false, undefined);
		await run;
		hold.complete();
		assert.deepStrictEqual([h.controller.ups, h.controller.held], [[], true]);
		h.assertReleased();
	});

	test('warm toolbar tap and second tap keep PTT toggling without a hold/unhold restart', async () => {
		const h = createHarness();
		h.controller.admit();
		await h.run();
		await h.run();
		assert.deepStrictEqual({ down: h.controller.downCalls, ups: h.controller.ups, gates: h.controller.holds, connects: h.controller.connectCalls }, {
			down: 2, ups: [{ source: undefined, forceFinish: undefined }, { source: undefined, forceFinish: undefined }], gates: [], connects: 0,
		});
		h.assertReleased();
	});

	test('warm hold keeps the original tap/hold decision in the controller', async () => {
		const hold = new DeferredPromise<void>();
		const h = createHarness({ handsFree: false, hold: hold.p });
		h.controller.admit();
		const run = h.run();
		hold.complete();
		await run;
		assert.deepStrictEqual(h.controller.ups, [{ source: 'explicit', forceFinish: false }]);
		h.assertReleased();
	});
});
