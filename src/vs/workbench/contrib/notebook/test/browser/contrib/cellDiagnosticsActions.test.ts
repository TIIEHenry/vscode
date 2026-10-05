/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import { IContextKeyService, type ContextKeyExpression, type ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import type { ServicesAccessor } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { IChatWidgetService } from '../../../../chat/browser/chat.js';
import { INLINE_CHAT_ID } from '../../../../inlineChat/common/inlineChat.js';
import { ExplainCellErrorAction, FixCellErrorAction, isNotebookCellErrorChatAllowed } from '../../../browser/contrib/cellDiagnostics/cellDiagnosticsActions.js';
import type { INotebookCellActionContext } from '../../../browser/controller/coreActions.js';
import { CodeCellViewModel } from '../../../browser/viewModel/codeCellViewModel.js';
import { NOTEBOOK_CELL_EDITOR_FOCUSED, NOTEBOOK_CELL_FOCUSED, NOTEBOOK_CELL_HAS_ERROR_DIAGNOSTICS } from '../../../common/notebookContextKeys.js';

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

interface IChatSideEffectCounts {
	revealWidget: number;
	acceptInput: number;
	inlineChatRun: number;
	acceptedQuery: string | undefined;
	fixMessage: string | undefined;
}

function emptyCounts(): IChatSideEffectCounts {
	return { revealWidget: 0, acceptInput: 0, inlineChatRun: 0, acceptedQuery: undefined, fixMessage: undefined };
}

function errorCellContext(counts: IChatSideEffectCounts): INotebookCellActionContext {
	const uri = URI.from({ scheme: 'test', path: '/cell' });
	const cell = Object.create(CodeCellViewModel.prototype, {
		uri: { value: uri },
		executionErrorDiagnostic: {
			value: {
				get: () => ({
					name: 'ZeroDivisionError',
					message: 'boom',
					stack: undefined,
					uri,
					location: { startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 4 },
				}),
			},
		},
	});
	const editor = {
		getModel: () => ({ uri }),
		getContribution: (id: string) => id === INLINE_CHAT_ID ? {
			run: async (args: { message: string }) => {
				counts.inlineChatRun++;
				counts.fixMessage = args.message;
			},
		} : undefined,
	};
	return {
		cell,
		notebookEditor: {
			setCellEditorSelection() { },
			codeEditors: [[cell, editor]],
		},
	} as unknown as INotebookCellActionContext;
}

function accessorFor(isSessionsWindow: boolean, counts: IChatSideEffectCounts): ServicesAccessor {
	const context = contextKeyService(isSessionsWindow);
	return {
		get(id: unknown) {
			if (id === IContextKeyService) {
				return context;
			}
			if (id === IChatWidgetService) {
				return {
					revealWidget: async () => {
						counts.revealWidget++;
						return {
							acceptInput: async (query?: string) => {
								counts.acceptInput++;
								counts.acceptedQuery = query;
							},
						};
					},
				};
			}
			throw new Error(`unexpected service ${String(id)}`);
		},
	} as ServicesAccessor;
}

const cellErrorReady: Record<string, ContextKeyValue> = {
	[NOTEBOOK_CELL_FOCUSED.key]: true,
	[NOTEBOOK_CELL_HAS_ERROR_DIAGNOSTICS.key]: true,
	[NOTEBOOK_CELL_EDITOR_FOCUSED.key]: false,
};

suite('Notebook cell error chat commands - default window', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('cell error chat is allowed only in the Agents window', () => {
		assert.strictEqual(isNotebookCellErrorChatAllowed(contextKeyService(false)), false);
		assert.strictEqual(isNotebookCellErrorChatAllowed(contextKeyService(true)), true);
	});

	test('fix and explain preconditions require the Agents window', () => {
		const defaultWindow = { ...cellErrorReady, [IsSessionsWindowContext.key]: false };
		const agentsWindow = { ...cellErrorReady, [IsSessionsWindowContext.key]: true };
		const actions = [new FixCellErrorAction(), new ExplainCellErrorAction()];

		for (const action of actions) {
			assert.ok(action.desc.precondition, action.desc.id);
			assert.strictEqual(evalWhen(action.desc.precondition, defaultWindow), false, action.desc.id);
			assert.strictEqual(evalWhen(action.desc.precondition, agentsWindow), true, action.desc.id);
			assert.strictEqual(evalWhen(action.desc.precondition, { ...agentsWindow, [NOTEBOOK_CELL_HAS_ERROR_DIAGNOSTICS.key]: false }), false, action.desc.id);
			assert.strictEqual(evalWhen(action.desc.precondition, { ...agentsWindow, [NOTEBOOK_CELL_EDITOR_FOCUSED.key]: true }), false, action.desc.id);

			const paletteItem = MenuRegistry.getMenuItems(MenuId.CommandPalette)
				.filter(isIMenuItem)
				.find(item => item.command.id === action.desc.id);
			assert.ok(paletteItem, action.desc.id);
			assert.strictEqual(evalWhen(paletteItem.command.precondition, defaultWindow), false, action.desc.id);
			assert.strictEqual(evalWhen(paletteItem.command.precondition, agentsWindow), true, action.desc.id);
		}
	});

	test('default Code window returns before revealWidget, acceptInput, and inline chat run', async () => {
		const counts = emptyCounts();
		const context = errorCellContext(counts);
		const accessor = accessorFor(false, counts);

		await new ExplainCellErrorAction().runWithContext(accessor, context);
		await new FixCellErrorAction().runWithContext(accessor, context);

		assert.strictEqual(counts.revealWidget, 0);
		assert.strictEqual(counts.acceptInput, 0);
		assert.strictEqual(counts.inlineChatRun, 0);
		assert.strictEqual(counts.acceptedQuery, undefined);
		assert.strictEqual(counts.fixMessage, undefined);
	});

	test('Agents window still explains and fixes the cell error', async () => {
		const counts = emptyCounts();
		const context = errorCellContext(counts);
		const accessor = accessorFor(true, counts);

		await new ExplainCellErrorAction().runWithContext(accessor, context);
		await new FixCellErrorAction().runWithContext(accessor, context);

		assert.strictEqual(counts.revealWidget, 1);
		assert.strictEqual(counts.acceptInput, 1);
		assert.strictEqual(counts.inlineChatRun, 1);
		assert.strictEqual(counts.acceptedQuery, '@workspace /explain ZeroDivisionError: boom');
		assert.strictEqual(counts.fixMessage, '/fix ZeroDivisionError: boom');
	});
});
