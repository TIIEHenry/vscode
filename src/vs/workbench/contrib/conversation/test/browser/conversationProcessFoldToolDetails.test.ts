/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ProcessFoldDomOptions, conversationProcessFoldToolCancel, renderProcessFoldSpan } from '../../browser/conversationProcessFold.js';
import { ProcessFoldSpan } from '../../browser/conversationProcessFoldModel.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS } from '../../common/uaClientSettingsKeys.js';
import { shouldShowClientToolInvocationDetails } from '../../common/uaClientSettingsHelpers.js';

suite('ConversationProcessFoldToolDetails', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function toolTurn(overrides?: Partial<ConversationStubTurn>): ConversationStubTurn {
		return {
			id: 'tool1',
			kind: 'tool',
			text: 'read file',
			toolName: 'read',
			summary: 'completed',
			payload: '{ "path": "README.md" }',
			toolStatus: 'completed',
			...overrides,
		};
	}

	function toolSpan(turn: ConversationStubTurn = toolTurn()): ProcessFoldSpan {
		return {
			id: 'fold:tool1',
			startIndex: 0,
			endIndex: 1,
			turnIds: [turn.id],
			nodes: [{ kind: 'tool', turn }],
		};
	}

	function foldOptions(overrides?: Partial<ProcessFoldDomOptions>): ProcessFoldDomOptions {
		return {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => true,
			setThinkingExpanded: () => { },
			isToolExpanded: () => true,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: false,
			showToolInvocationDetails: true,
			...overrides,
		};
	}

	function renderFold(options: ProcessFoldDomOptions, span: ProcessFoldSpan = toolSpan()): HTMLElement {
		const container = document.createElement('div');
		const disposables = store.add(new DisposableStore());
		renderProcessFoldSpan(container, span, options, disposables);
		return container;
	}

	test('helper reads ua.client.clientTools.showToolInvocationDetails', () => {
		assert.strictEqual(shouldShowClientToolInvocationDetails(), true);
		assert.strictEqual(shouldShowClientToolInvocationDetails(new TestConfigurationService({
			[UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS]: false,
		})), false);
		assert.strictEqual(shouldShowClientToolInvocationDetails(new TestConfigurationService({
			[UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS]: true,
		})), true);
	});

	test('tool row with details on renders expandable payload body', () => {
		const container = renderFold(foldOptions({ showToolInvocationDetails: true }));
		const row = container.querySelector('.conversation-process-fold-tool') as HTMLElement;
		assert.ok(row);
		const header = row.querySelector('.conversation-process-fold-tool-header') as HTMLElement;
		assert.strictEqual(header.tagName, 'BUTTON');
		assert.ok(header.textContent?.includes('read'));
		assert.ok(header.textContent?.includes('completed'));
		const body = row.querySelector('.conversation-process-fold-tool-body') as HTMLElement;
		assert.ok(body);
		assert.strictEqual(body.hidden, false);
		assert.ok(body.textContent?.includes('README.md'));
	});

	test('tool row with details off shows only name and status', () => {
		const container = renderFold(foldOptions({ showToolInvocationDetails: false }));
		const row = container.querySelector('.conversation-process-fold-tool') as HTMLElement;
		assert.ok(row);
		const header = row.querySelector('.conversation-process-fold-tool-header') as HTMLElement;
		assert.strictEqual(header.tagName, 'DIV');
		assert.ok(header.textContent?.includes('read'));
		assert.ok(header.textContent?.includes('completed'));
		assert.strictEqual(header.getAttribute('role'), null);
		assert.strictEqual(header.getAttribute('aria-expanded'), null);
		assert.strictEqual(row.querySelector('.conversation-process-fold-tool-body'), null);
		assert.ok(!(header as HTMLButtonElement).onclick);
	});

	test('executing live tool row shows Cancel tool and fires onCancelToolCall', () => {
		const cancelled: string[] = [];
		const turn = toolTurn({ toolStatus: 'running', streaming: true, agentId: 'sub:a' });
		const container = renderFold(foldOptions({
			showLiveChrome: true,
			onCancelToolCall: called => cancelled.push(called.id),
		}), toolSpan(turn));
		const button = container.querySelector('.conversation-process-fold-tool-cancel') as HTMLButtonElement;
		assert.ok(button);
		assert.strictEqual(button.getAttribute('aria-label'), conversationProcessFoldToolCancel);
		button.click();
		assert.deepStrictEqual(cancelled, [turn.id]);
	});

	test('completed or stub tool row omits Cancel tool', () => {
		const liveCompleted = renderFold(foldOptions({
			showLiveChrome: true,
			onCancelToolCall: () => { },
		}));
		assert.strictEqual(liveCompleted.querySelector('.conversation-process-fold-tool-cancel'), null);

		const stubRunning = renderFold(foldOptions({
			showLiveChrome: false,
			onCancelToolCall: () => { },
		}), toolSpan(toolTurn({ toolStatus: 'running', streaming: true })));
		assert.strictEqual(stubRunning.querySelector('.conversation-process-fold-tool-cancel'), null);
	});

	test('file_edit tool row with metadata.diff renders diff stats badge and expandable diff body', () => {
		const turn = toolTurn({
			toolName: 'file_edit',
			summary: 'edited file.ts',
			metadata: {
				diff: '--- a/file.ts\n+++ b/file.ts\n-one\n+two',
				filediff: { file: 'file.ts', additions: 3, deletions: 1 },
			},
		});
		const container = renderFold(foldOptions({ showToolInvocationDetails: true }), toolSpan(turn));
		const row = container.querySelector('.conversation-process-fold-tool') as HTMLElement;
		assert.ok(row);

		const diffStats = row.querySelector('.conversation-process-fold-tool-diff-stats');
		assert.ok(diffStats);
		assert.strictEqual(diffStats.textContent, '+3 \u22121');

		const body = row.querySelector('.conversation-process-fold-tool-body') as HTMLElement;
		assert.ok(body);
		const diffArea = body.querySelector('.conversation-process-fold-tool-diff') as HTMLElement;
		assert.ok(diffArea);
		assert.ok(diffArea.textContent?.includes('-one'));
		assert.ok(diffArea.textContent?.includes('+two'));
	});

	test('file_edit tool row without metadata keeps plain tool summary without diff stats', () => {
		const turn = toolTurn({
			toolName: 'file_edit',
			summary: 'edited file.ts',
		});
		const container = renderFold(foldOptions({ showToolInvocationDetails: true }), toolSpan(turn));
		const row = container.querySelector('.conversation-process-fold-tool') as HTMLElement;
		assert.ok(row);

		const diffStats = row.querySelector('.conversation-process-fold-tool-diff-stats');
		assert.strictEqual(diffStats, null);
	});
});
