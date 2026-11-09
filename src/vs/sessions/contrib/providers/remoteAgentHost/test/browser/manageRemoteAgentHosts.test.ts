/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise, raceTimeout, timeout } from '../../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { mock, upcastPartial } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IMenuService, MenuItemAction } from '../../../../../../platform/actions/common/actions.js';
import { IRemoteAgentHostLocationPreferenceService } from '../../../../../../platform/agentHost/common/remoteAgentHostLocationPreference.js';
import { IRemoteAgentHostService } from '../../../../../../platform/agentHost/common/remoteAgentHostService.js';
import { ISSHRemoteAgentHostService } from '../../../../../../platform/agentHost/common/sshRemoteAgentHost.js';
import { IClipboardService } from '../../../../../../platform/clipboard/common/clipboardService.js';
import { CommandsRegistry, ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IQuickInputButton, IQuickInputHideEvent, IQuickInputService, IQuickPick, IQuickPickDidAcceptEvent, IQuickPickItem, IQuickPickItemButtonEvent, IQuickPickSeparator, QuickInputHideReason } from '../../../../../../platform/quickinput/common/quickInput.js';
import { IPreferencesService } from '../../../../../../workbench/services/preferences/common/preferences.js';
import { workbenchInstantiationService } from '../../../../../../workbench/test/browser/workbenchTestServices.js';
import { IAgentHostSessionsProvider } from '../../../../../common/agentHostSessionsProvider.js';
import { ISessionsProvidersService } from '../../../../../services/sessions/browser/sessionsProvidersService.js';
import '../../browser/manageRemoteAgentHosts.js';
import { RemoteAgentHostCommandIds } from '../../browser/remoteAgentHostActions.js';

const MANAGE_TITLE = 'Manage Remote Agent Hosts';
const REMOTE_ITEM_LABEL = '$(remote) Test Host';
const MENU_ACTION_ID = 'test.manageRemoteAgentHosts.menuAction';
const MENU_ACTION_LABEL = 'Test Menu Action';

class FakeQuickPick extends Disposable {
	title: string | undefined;
	placeholder: string | undefined;
	matchOnDescription = false;
	matchOnDetail = false;
	value = '';
	buttons: readonly IQuickInputButton[] = [];
	items: readonly (IQuickPickItem | IQuickPickSeparator)[] = [];
	selectedItems: readonly IQuickPickItem[] = [];
	visible = false;

	private readonly _onDidAccept = this._register(new Emitter<IQuickPickDidAcceptEvent>());
	readonly onDidAccept = this._onDidAccept.event;
	private readonly _onDidHide = this._register(new Emitter<IQuickInputHideEvent>());
	readonly onDidHide = this._onDidHide.event;
	private readonly _onDidTriggerButton = this._register(new Emitter<IQuickInputButton>());
	readonly onDidTriggerButton = this._onDidTriggerButton.event;
	private readonly _onDidTriggerItemButton = this._register(new Emitter<IQuickPickItemButtonEvent<IQuickPickItem>>());
	readonly onDidTriggerItemButton = this._onDidTriggerItemButton.event;

	show(): void {
		this.visible = true;
	}

	// QuickInputController.hide fires onDidHide before it returns.
	hide(): void {
		if (!this.visible) {
			return;
		}
		this.visible = false;
		this._onDidHide.fire({ reason: QuickInputHideReason.Other });
	}

	accept(label: string): void {
		const item = this.items.find((candidate): candidate is IQuickPickItem => candidate.type !== 'separator' && candidate.label === label);
		assert.ok(item, `no quick pick item labelled ${label}`);
		this.selectedItems = [item];
		this._onDidAccept.fire({ inBackground: false });
	}

	triggerButton(button: IQuickInputButton): void {
		this._onDidTriggerButton.fire(button);
	}

	override dispose(): void {
		this.hide();
		super.dispose();
	}
}

class FakeQuickInputService extends mock<IQuickInputService>() {
	override readonly backButton: IQuickInputButton = { iconClass: 'back', tooltip: 'Back' };
	readonly pickers: FakeQuickPick[] = [];
	private readonly creations: DeferredPromise<void>[] = [];

	constructor(private readonly disposables: Pick<DisposableStore, 'add'>) {
		super();
	}

	override createQuickPick<T extends IQuickPickItem>(options: { useSeparators: true }): IQuickPick<T, { useSeparators: true }>;
	override createQuickPick<T extends IQuickPickItem>(options?: { useSeparators: boolean }): IQuickPick<T, { useSeparators: false }>;
	override createQuickPick<T extends IQuickPickItem>(_options: { useSeparators: boolean } = { useSeparators: false }): IQuickPick<T, { useSeparators: boolean }> {
		const picker = this.disposables.add(new FakeQuickPick());
		this.pickers.push(picker);
		this.creation(this.pickers.length).complete();
		return picker as unknown as IQuickPick<T, { useSeparators: boolean }>;
	}

	whenCreated(count: number): Promise<void> {
		return this.creation(count).p;
	}

	private creation(count: number): DeferredPromise<void> {
		let deferred = this.creations[count];
		if (!deferred) {
			deferred = new DeferredPromise<void>();
			this.creations[count] = deferred;
		}
		return deferred;
	}
}

class FakeCommandService extends mock<ICommandService>() {
	readonly calls: { readonly id: string; readonly args: readonly unknown[] }[] = [];
	execute: () => Promise<unknown> = async () => undefined;

	override executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined> {
		this.calls.push({ id: commandId, args });
		return this.execute() as Promise<R | undefined>;
	}
}

suite('Manage Remote Agent Hosts command', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function setup(options?: { readonly withMenuAction?: boolean }) {
		const store = disposables.add(new DisposableStore());
		const instantiationService = workbenchInstantiationService(undefined, store);
		const quickInput = new FakeQuickInputService(store);
		const commandService = new FakeCommandService();
		const provider = upcastPartial<IAgentHostSessionsProvider>({ id: 'agenthost-test', label: 'Test Host', remoteAddress: 'localhost:4321' });
		instantiationService.stub(IQuickInputService, quickInput);
		instantiationService.stub(ICommandService, commandService);
		instantiationService.stub(ISessionsProvidersService, new class extends mock<ISessionsProvidersService>() {
			override readonly onDidChangeProviders = Event.None;
			override getProviders() { return [provider]; }
		}());
		instantiationService.stub(IRemoteAgentHostService, new class extends mock<IRemoteAgentHostService>() { }());
		instantiationService.stub(IClipboardService, new class extends mock<IClipboardService>() { }());
		instantiationService.stub(IPreferencesService, new class extends mock<IPreferencesService>() { }());
		instantiationService.stub(ISSHRemoteAgentHostService, new class extends mock<ISSHRemoteAgentHostService>() { }());
		instantiationService.stub(IRemoteAgentHostLocationPreferenceService, new class extends mock<IRemoteAgentHostLocationPreferenceService>() { }());
		if (options?.withMenuAction) {
			const menuAction = new MenuItemAction({ id: MENU_ACTION_ID, title: MENU_ACTION_LABEL }, undefined, undefined, undefined, undefined, instantiationService.get(IContextKeyService), commandService);
			instantiationService.stub(IMenuService, new class extends mock<IMenuService>() {
				override getMenuActions(): ReturnType<IMenuService['getMenuActions']> {
					return [['navigation', [menuAction]]];
				}
			}());
		}
		return { instantiationService, quickInput, commandService };
	}

	async function runManageCommand(instantiationService: TestInstantiationService): Promise<void> {
		const command = CommandsRegistry.getCommand(RemoteAgentHostCommandIds.manageRemoteAgentHosts);
		assert.ok(command);
		await instantiationService.invokeFunction(accessor => command.handler(accessor));
	}

	test('Back in the host options reopens the manage list', async () => {
		const { instantiationService, quickInput } = setup();
		await runManageCommand(instantiationService);
		quickInput.pickers[0].accept(REMOTE_ITEM_LABEL);
		const hostOptions = quickInput.pickers[1];
		assert.ok(hostOptions?.visible, 'host options did not open');

		hostOptions.triggerButton(quickInput.backButton);
		const reopened = await raceTimeout(quickInput.whenCreated(3).then(() => true), 1000);
		const manage = quickInput.pickers[2];
		const state = { reopened, pickerCount: quickInput.pickers.length, title: manage?.title, visible: manage?.visible };
		manage?.hide();

		assert.deepStrictEqual(state, { reopened: true, pickerCount: 3, title: MANAGE_TITLE, visible: true });
	});

	test('closing the host options without Back does not reopen the manage list', async () => {
		const { instantiationService, quickInput } = setup();
		await runManageCommand(instantiationService);
		quickInput.pickers[0].accept(REMOTE_ITEM_LABEL);
		const hostOptions = quickInput.pickers[1];
		assert.ok(hostOptions?.visible, 'host options did not open');

		hostOptions.hide();
		const reopened = await raceTimeout(quickInput.whenCreated(3).then(() => true), 50);

		assert.deepStrictEqual({ reopened, pickerCount: quickInput.pickers.length }, { reopened: undefined, pickerCount: 2 });
	});

	test('a menu action runs its command and its back callback reopens the manage list', async () => {
		const { instantiationService, quickInput, commandService } = setup({ withMenuAction: true });
		await runManageCommand(instantiationService);
		quickInput.pickers[0].accept(MENU_ACTION_LABEL);

		const calls = commandService.calls.map(call => ({ id: call.id, hasBackCallback: typeof call.args[0] === 'function' }));
		const onBack = commandService.calls[0]?.args[0] as (() => void) | undefined;
		onBack?.();
		const manage = quickInput.pickers[1];
		const state = { calls, pickerCount: quickInput.pickers.length, title: manage?.title, visible: manage?.visible };
		manage?.hide();

		assert.deepStrictEqual(state, {
			calls: [{ id: MENU_ACTION_ID, hasBackCallback: true }],
			pickerCount: 2,
			title: MANAGE_TITLE,
			visible: true,
		});
	});

	test('a failing menu command reaches onUnexpectedError instead of leaking an unhandled rejection', async () => {
		const { instantiationService, quickInput, commandService } = setup({ withMenuAction: true });
		const failure = new Error('menu command failed');
		commandService.execute = () => Promise.reject(failure);
		await runManageCommand(instantiationService);

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const unexpectedErrors: unknown[] = [];
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => unexpectedErrors.push(error));
		try {
			quickInput.pickers[0].accept(MENU_ACTION_LABEL);
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedErrors }, { unhandledRejections: [], unexpectedErrors: [failure] });
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
