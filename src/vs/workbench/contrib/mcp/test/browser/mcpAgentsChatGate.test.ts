/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { constObservable, observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { CodeLensList, CodeLensProvider } from '../../../../../editor/common/languages.js';
import { SuggestController } from '../../../../../editor/contrib/suggest/browser/suggestController.js';
import { createTextModel } from '../../../../../editor/test/common/testTextModel.js';
import { localize } from '../../../../../nls.js';
import { type ContextKeyExpression, type ContextKeyValue, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService, type ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuickPick, IQuickPickItem, type IQuickPickItemButtonEvent } from '../../../../../platform/quickinput/common/quickInput.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { ChatViewId, IChatWidgetService } from '../../../chat/browser/chat.js';
import { ContributionEnablementState } from '../../../chat/common/enablement.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { McpStartPromptingServerCommand } from '../../browser/mcpCommands.js';
import { McpLanguageFeatures } from '../../browser/mcpLanguageFeatures.js';
import { AbstractMcpResourceAccessPick } from '../../browser/mcpResourceQuickAccess.js';
import { McpCommandIds } from '../../common/mcpCommandIds.js';
import { IMcpServer, isMcpAgentsChatAllowed, McpConnectionState } from '../../common/mcpTypes.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function contextKeyService(isSessionsWindow: boolean): IContextKeyService {
	return {
		getContextKeyValue: <T>(key: string) => (key === IsSessionsWindowContext.key ? isSessionsWindow : undefined) as T | undefined,
	} as IContextKeyService;
}

function accessorFor(isSessionsWindow: boolean, getOther: (id: unknown) => unknown): ServicesAccessor {
	const context = contextKeyService(isSessionsWindow);
	return {
		get(id: unknown) {
			if (id === IContextKeyService) {
				return context;
			}
			return getOther(id);
		},
	} as ServicesAccessor;
}

function commandIds(list: CodeLensList | null | undefined): string[] {
	return (list?.lenses ?? []).flatMap(lens => lens.command?.id ? [lens.command.id] : []);
}

class TestMcpResourceAccess extends AbstractMcpResourceAccessPick {
	constructor(
		instantiationService: IInstantiationService,
		editorService: IEditorService,
		chatWidgetService: IChatWidgetService,
		viewsService: IViewsService,
		contextKeyService: IContextKeyService,
	) {
		super(undefined, instantiationService, editorService, chatWidgetService, viewsService, contextKeyService);
	}

	expose(picker: IQuickPick<IQuickPickItem, { useSeparators: true }>, token: CancellationToken) {
		return this.applyToPick(picker, token);
	}
}

suite('MCP agents chat gate - default Code window', () => {

	const ds = ensureNoDisposablesAreLeakedInTestSuite();

	test('isMcpAgentsChatAllowed is true only in the Agents window', () => {
		assert.strictEqual(isMcpAgentsChatAllowed(false), false);
		assert.strictEqual(isMcpAgentsChatAllowed(true), true);
	});

	test('default Code window McpStartPromptingServerCommand does not open chat', async () => {
		const command = new McpStartPromptingServerCommand();
		assert.strictEqual(
			evalWhen(command.desc.precondition, { [IsSessionsWindowContext.key]: false }),
			false,
			'default Code window precondition must be false'
		);
		assert.strictEqual(
			evalWhen(command.desc.precondition, { [IsSessionsWindowContext.key]: true }),
			true,
			'Agents window precondition must allow the command'
		);

		await command.run(accessorFor(false, () => {
			throw new Error('default Code window must not open chat from MCP prompts');
		}), undefined as unknown as IMcpServer);
	});

	test('Agents window McpStartPromptingServerCommand still opens chat and writes the prompt', async () => {
		let openedView: string | undefined;
		let suggested = false;
		let focused = false;
		const applied: { text: string }[] = [];
		const model = {
			getFullModelRange: () => new Range(1, 1, 1, 1),
			applyEdits: (edits: { text: string }[]) => { applied.push(...edits); },
		};
		const editor = {
			getModel: () => model,
			getSelection: () => null,
			setSelection: () => { },
			getContribution: (id: string) => id === SuggestController.ID ? { triggerSuggest: () => { suggested = true; } } : null,
		};
		const widget = {
			inputEditor: editor,
			focusInput: () => { focused = true; },
		};

		await new McpStartPromptingServerCommand().run(accessorFor(true, (id) => {
			if (id === IViewsService) {
				return {
					openView: async (viewId: string) => {
						openedView = viewId;
						return undefined;
					},
				};
			}
			if (id === IChatWidgetService) {
				return { getWidgetsByLocations: () => [widget] };
			}
			throw new Error(`unexpected service ${String(id)}`);
		}), { definition: { id: 'demo', label: 'demo' } } as IMcpServer);

		assert.strictEqual(openedView, ChatViewId);
		assert.deepStrictEqual(applied.map(edit => edit.text), ['/mcp.demo.']);
		assert.strictEqual(focused, true);
		assert.strictEqual(suggested, true);
	});

	test('StartPromptForServer code lens is only produced in the Agents window when prompts exist', async () => {
		const uri = URI.file('/workspace/.mcp.json');
		const model = ds.add(createTextModel([
			'{',
			'  "mcpServers": {',
			'    "demo": { "command": "noop" }',
			'  }',
			'}',
		].join('\n'), 'json', {}, uri));
		const prompts = observableValue('mcpPrompts', [{ id: 'p', name: 'p' }]);
		const env = { isSessionsWindow: false };
		let provider: CodeLensProvider | undefined;
		const features = ds.add(new McpLanguageFeatures(
			{
				codeLensProvider: {
					register: (_selector: unknown, registered: CodeLensProvider) => {
						provider = registered;
						return { dispose() { } };
					},
				},
				inlayHintsProvider: { register: () => ({ dispose() { } }) },
			} as never,
			{
				collections: constObservable([{ id: 'col', label: 'col', order: 0, presentation: { origin: uri } }]),
				onDidChangeInputs: Event.None,
			} as never,
			{ getMcpConfigPath: async () => undefined } as never,
			{
				servers: constObservable([{
					collection: { id: 'col' },
					definition: { id: 'demo', label: 'demo' },
					enablement: constObservable(ContributionEnablementState.EnabledProfile),
					connectionState: constObservable({ state: McpConnectionState.Kind.Running }),
					readDefinitions: () => constObservable({ server: undefined, collection: undefined }),
					tools: constObservable([]),
					prompts,
				}]),
			} as never,
			{
				lastFocusedWidget: undefined,
				onDidChangeFocusedWidget: () => ({ dispose() { } }),
				onDidChangeFocusedSession: () => ({ dispose() { } }),
			} as never,
			{ onDidChangeCustomizations: () => ({ dispose() { } }), getMcpServers: () => [] } as never,
			{ connections: [], onDidChangeConnections: () => ({ dispose() { } }) } as never,
			{ changeOne() { }, remove() { } } as never,
			{ resolvableVariables: new Set<string>() } as never,
			{ onDidChangeSecret: () => ({ dispose() { } }), get: async () => undefined } as never,
			env as never,
		));
		assert.ok(provider, 'MCP code lens provider should register');
		assert.ok(features);

		const hidden = await provider!.provideCodeLenses(model, CancellationToken.None);
		try {
			assert.ok(!commandIds(hidden ?? undefined).includes(McpCommandIds.StartPromptForServer), 'default Code window must not produce the prompts code lens');
		} finally {
			hidden?.dispose?.();
		}

		env.isSessionsWindow = true;
		const shown = await provider!.provideCodeLenses(model, CancellationToken.None);
		try {
			assert.ok(commandIds(shown ?? undefined).includes(McpCommandIds.StartPromptForServer), 'Agents window must still produce the prompts code lens');
			assert.ok(commandIds(shown ?? undefined).includes(McpCommandIds.StopServer), 'other MCP server code lenses stay in the Agents window');
		} finally {
			shown?.dispose?.();
		}

		prompts.set([], undefined, undefined);
		const noPrompts = await provider!.provideCodeLenses(model, CancellationToken.None);
		try {
			assert.ok(!commandIds(noPrompts ?? undefined).includes(McpCommandIds.StartPromptForServer), 'Agents window omits the prompts code lens when there are no prompts');
		} finally {
			noPrompts?.dispose?.();
		}
	});

	test('Attach to chat does not open the chat view or add context in the default Code window', async () => {
		const probe = await triggerAttach(ds, false);
		assert.strictEqual(probe.openViews, 0, 'default Code window must not open the chat view');
		assert.strictEqual(probe.attachmentReads, 0, 'default Code window must not resolve an attachment');
		assert.deepStrictEqual(probe.added, [], 'default Code window must not add chat context');
	});

	test('Agents window Attach to chat still opens chat and adds the resource', async () => {
		const probe = await triggerAttach(ds, true);
		assert.strictEqual(probe.openViews, 1);
		assert.strictEqual(probe.openedView, ChatViewId);
		assert.strictEqual(probe.attachmentReads, 1);
		assert.deepStrictEqual(probe.added, [{ id: 'resource' }]);
	});
});

interface IAttachProbe {
	readonly openViews: number;
	readonly openedView: string | undefined;
	readonly attachmentReads: number;
	readonly added: readonly unknown[];
}

async function triggerAttach(store: { add: <T extends { dispose(): void }>(disposable: T) => T }, isSessionsWindow: boolean): Promise<IAttachProbe> {
	let openViews = 0;
	let openedView: string | undefined;
	let attachmentReads = 0;
	const added: unknown[] = [];
	const attachment = { id: 'resource' };
	const helper = {
		dispose() { },
		getPicks: () => constObservable({ picks: new Map(), isBusy: false }),
		checkIfNestedResources: () => false,
		toAttachment: () => {
			attachmentReads++;
			return Promise.resolve(attachment);
		},
	};
	const viewsService = {
		openView: async (viewId: string) => {
			openViews++;
			openedView = viewId;
			return undefined;
		},
	} as unknown as IViewsService;
	const chatWidgetService = {
		getWidgetsByLocations: () => [{
			attachmentModel: { addContext: (...entries: unknown[]) => added.push(...entries) },
		}],
	} as unknown as IChatWidgetService;
	const access = new TestMcpResourceAccess(
		{ createInstance: () => helper } as unknown as IInstantiationService,
		{} as IEditorService,
		chatWidgetService,
		viewsService,
		contextKeyService(isSessionsWindow),
	);
	const buttonEmitter = store.add(new Emitter<IQuickPickItemButtonEvent<IQuickPickItem>>());
	const hideEmitter = store.add(new Emitter<void>());
	const acceptEmitter = store.add(new Emitter<void>());
	const picker = {
		canAcceptInBackground: false,
		busy: false,
		keepScrollPosition: false,
		items: [] as IQuickPickItem[],
		hide() { },
		onDidTriggerItemButton: buttonEmitter.event,
		onDidHide: hideEmitter.event,
		onDidAccept: acceptEmitter.event,
	} as unknown as IQuickPick<IQuickPickItem, { useSeparators: true }>;
	store.add(access.expose(picker, CancellationToken.None));

	buttonEmitter.fire({
		button: { iconClass: '', tooltip: localize('mcp.quickaccess.attach', 'Attach to chat') },
		item: { label: 'resource' },
	});
	await new Promise(resolve => setTimeout(resolve, 0));

	return { openViews, openedView, attachmentReads, added };
}
