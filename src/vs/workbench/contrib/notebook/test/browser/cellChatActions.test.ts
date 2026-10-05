/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService, type ContextKeyExpression, type ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { InputFocusedContextKey } from '../../../../../platform/contextkey/common/contextkeys.js';
import type { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { KeybindingsRegistry } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { isNotebookCellChatAllowed, NotebookCellChatStartAction, NotebookCellChatStartAtTopAction } from '../../browser/controller/chat/cellChatActions.js';
import { CTX_NOTEBOOK_CHAT_HAS_AGENT } from '../../browser/controller/chat/notebookChatContext.js';
import { CellKind, NotebookSetting } from '../../common/notebookCommon.js';
import { INotebookKernelHistoryService } from '../../common/notebookKernelService.js';
import { NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_EDITOR_FOCUSED } from '../../common/notebookContextKeys.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function getMenuItem(menuId: MenuId, commandId: string) {
	return MenuRegistry.getMenuItems(menuId)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const notebookChatReady: Record<string, ContextKeyValue> = {
	[NOTEBOOK_EDITOR_EDITABLE.key]: true,
	[CTX_NOTEBOOK_CHAT_HAS_AGENT.key]: true,
	[`config.${NotebookSetting.cellChat}`]: true,
	[`config.${NotebookSetting.cellGenerate}`]: true,
	'config.notebook.insertToolbarLocation': 'notebookToolbar',
};

const defaultWindow: Record<string, ContextKeyValue> = {
	...notebookChatReady,
	[IsSessionsWindowContext.key]: false,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...notebookChatReady,
	[IsSessionsWindowContext.key]: true,
};

const generateCodeMenuTargets: { menuId: MenuId; commandId: string; label: string }[] = [
	{ menuId: MenuId.NotebookCellBetween, commandId: 'notebook.cell.chat.start', label: 'NotebookCellBetween Generate' },
	{ menuId: MenuId.NotebookCellListTop, commandId: 'notebook.cell.chat.startAtTop', label: 'NotebookCellListTop Generate' },
	{ menuId: MenuId.NotebookToolbar, commandId: 'notebook.cell.chat.start', label: 'NotebookToolbar Generate' },
];

suite('NotebookCellChatActions - default window chrome (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default Code window hides Generate / Start Chat notebook cell menu items', () => {
		for (const { menuId, commandId, label } of generateCodeMenuTargets) {
			const item = getMenuItem(menuId, commandId);
			assert.ok(item, `${label} should remain registered for Agents Window`);
			assert.ok(item.when, `${label} menu item should have a when clause`);

			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${label}`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindow),
				true,
				`Agents Window may show ${label}`
			);
		}
	});

	test('Generate commands are allowed and preconditioned only in the Agents window', () => {
		assert.strictEqual(isNotebookCellChatAllowed(contextKeyService(false)), false);
		assert.strictEqual(isNotebookCellChatAllowed(contextKeyService(true)), true);

		const actions = [new NotebookCellChatStartAction(), new NotebookCellChatStartAtTopAction()];
		for (const action of actions) {
			assert.ok(action.desc.precondition, action.desc.id);
			assert.ok(action.desc.precondition.keys().includes(IsSessionsWindowContext.key), action.desc.id);
			assert.strictEqual(evalWhen(action.desc.precondition, defaultWindow), false, action.desc.id);
			assert.strictEqual(evalWhen(action.desc.precondition, agentsWindow), true, action.desc.id);
		}

		const focusedAgents = {
			...agentsWindow,
			[NOTEBOOK_EDITOR_FOCUSED.key]: true,
			[InputFocusedContextKey]: false,
		};
		const bindings = KeybindingsRegistry.getDefaultKeybindings().filter(item => item.command === 'notebook.cell.chat.start');
		assert.ok(bindings.length >= 1);
		for (const binding of bindings) {
			assert.strictEqual(evalWhen(binding.when ?? undefined, focusedAgents), true);
			assert.strictEqual(evalWhen(binding.when ?? undefined, { ...focusedAgents, [IsSessionsWindowContext.key]: false }), false);
			assert.strictEqual(evalWhen(binding.when ?? undefined, {
				...focusedAgents,
				[`config.${NotebookSetting.cellChat}`]: false,
				[`config.${NotebookSetting.cellGenerate}`]: false,
			}), false);
		}
	});

	test('default Code window does not insert a cell or start inline chat', async () => {
		for (const action of [new NotebookCellChatStartAction(), new NotebookCellChatStartAtTopAction()]) {
			const run = await runCellChat(action, false, true);
			assert.strictEqual(run.edits, 0, action.desc.id);
			assert.strictEqual(run.languageGets, 0, action.desc.id);
			assert.strictEqual(run.kernelGets, 0, action.desc.id);
			assert.strictEqual(run.detections, 0, action.desc.id);
			assert.strictEqual(run.lineReveals, 0, action.desc.id);
			assert.strictEqual(run.editorFocuses, 0, action.desc.id);
			assert.deepStrictEqual(run.commands, [], action.desc.id);
		}
	});

	test('Agents window still inserts a cell and starts inline chat when Generate is enabled', async () => {
		for (const action of [new NotebookCellChatStartAction(), new NotebookCellChatStartAtTopAction()]) {
			const run = await runCellChat(action, true, true);
			assert.strictEqual(run.edits, 1, action.desc.id);
			assert.strictEqual(run.languageGets, 1, action.desc.id);
			assert.strictEqual(run.kernelGets, 1, action.desc.id);
			assert.strictEqual(run.detections, 1, action.desc.id);
			assert.strictEqual(run.lineReveals, 1, action.desc.id);
			assert.strictEqual(run.editorFocuses, 1, action.desc.id);
			assert.deepStrictEqual(run.commands, ['inlineChat.start'], action.desc.id);
		}
	});

	test('Agents window does not insert or start inline chat when Generate is off', async () => {
		for (const action of [new NotebookCellChatStartAction(), new NotebookCellChatStartAtTopAction()]) {
			const run = await runCellChat(action, true, false);
			assert.strictEqual(run.edits, 0, action.desc.id);
			assert.strictEqual(run.languageGets, 0, action.desc.id);
			assert.deepStrictEqual(run.commands, [], action.desc.id);
		}
	});
});

function contextKeyService(isSessionsWindow: boolean): IContextKeyService {
	return {
		getContextKeyValue: <T>(key: string) => (key === IsSessionsWindowContext.key ? isSessionsWindow : undefined) as T | undefined,
	} as IContextKeyService;
}

interface ICellChatRun {
	readonly edits: number;
	readonly languageGets: number;
	readonly kernelGets: number;
	readonly detections: number;
	readonly lineReveals: number;
	readonly editorFocuses: number;
	readonly commands: readonly string[];
}

function createGenerateEditor(): {
	notebookEditor: object;
	readonly edits: number;
	readonly detections: number;
	readonly lineReveals: number;
	readonly editorFocuses: number;
} {
	let edits = 0;
	let detections = 0;
	let lineReveals = 0;
	let editorFocuses = 0;
	const inserted = {
		enableAutoLanguageDetection() { detections++; },
	};
	const codeEditor = { focus() { editorFocuses++; } };
	const notebookEditor = {
		getActiveCell: () => ({ getTextLength: () => 8 }),
		getFocus: () => ({ end: 1 }),
		cellAt: () => ({ cellKind: CellKind.Code, language: 'python' }),
		activeKernel: { supportedLanguages: ['python'] },
		getViewModel: () => ({
			options: { isReadOnly: false },
			length: 1,
			getNextVisibleCellIndex: (index: number) => index + 1,
			getFocus: () => ({ start: 0, end: 1 }),
			getSelections: () => [{ start: 0, end: 1 }],
			notebookDocument: { applyEdits() { edits++; } },
			cellAt: () => inserted,
		}),
		codeEditors: [[inserted, codeEditor]],
		revealFirstLineIfOutsideViewport: async () => { lineReveals++; },
	};
	return {
		notebookEditor,
		get edits() { return edits; },
		get detections() { return detections; },
		get lineReveals() { return lineReveals; },
		get editorFocuses() { return editorFocuses; },
	};
}

async function runCellChat(action: NotebookCellChatStartAction | NotebookCellChatStartAtTopAction, isSessionsWindow: boolean, chatEnabled: boolean): Promise<ICellChatRun> {
	const editor = createGenerateEditor();
	const commands: string[] = [];
	let languageGets = 0;
	let kernelGets = 0;
	const accessor = {
		get(id: unknown) {
			if (id === IContextKeyService) {
				return contextKeyService(isSessionsWindow);
			}
			if (id === ITelemetryService) {
				return { publicLog2() { } };
			}
			if (id === IConfigurationService) {
				return {
					getValue(key: string) {
						if (!chatEnabled) {
							return false;
						}
						return key === NotebookSetting.cellChat || key === NotebookSetting.cellGenerate;
					},
				};
			}
			if (id === ICommandService) {
				return {
					executeCommand(commandId: string) { commands.push(commandId); },
				};
			}
			if (id === ILanguageService) {
				languageGets++;
				return { getRegisteredLanguageIds: () => ['python'] };
			}
			if (id === INotebookKernelHistoryService) {
				kernelGets++;
				return {};
			}
			throw new Error(`unexpected service ${String(id)}`);
		},
	} as ServicesAccessor;

	await action.run(accessor, { notebookEditor: editor.notebookEditor });
	return {
		get edits() { return editor.edits; },
		get languageGets() { return languageGets; },
		get kernelGets() { return kernelGets; },
		get detections() { return editor.detections; },
		get lineReveals() { return editor.lineReveals; },
		get editorFocuses() { return editor.editorFocuses; },
		commands,
	};
}
