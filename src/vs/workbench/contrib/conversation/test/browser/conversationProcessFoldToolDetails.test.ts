/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ProcessFoldDomOptions, conversationProcessFoldToolCancel, fillProcessFoldDiffStats, renderProcessFoldSpan } from '../../browser/conversationProcessFold.js';
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
		const turn = toolTurn({ id: 'e-run', toolStatus: 'running', streaming: true, agentId: 'sub:a', toolCallId: 'tc-1' });
		const container = renderFold(foldOptions({
			showLiveChrome: true,
			onCancelToolCall: called => cancelled.push(called.toolCallId ?? called.id),
		}), toolSpan(turn));
		const button = container.querySelector('.conversation-process-fold-tool-cancel') as HTMLButtonElement;
		assert.ok(button);
		assert.strictEqual(button.getAttribute('aria-label'), conversationProcessFoldToolCancel);
		assert.strictEqual(button.getAttribute('data-tool-call-id'), 'tc-1');
		assert.notStrictEqual(button.getAttribute('data-tool-call-id'), turn.id);
		button.click();
		assert.deepStrictEqual(cancelled, ['tc-1']);
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
		const card = container.querySelector('.conversation-file-edit-card') as HTMLElement;
		assert.ok(card);
		assert.strictEqual(card.querySelector('.conversation-file-edit-title')?.textContent, 'Edited 1 file');

		const diffStats = card.querySelector('.conversation-file-edit-stats');
		assert.ok(diffStats);
		assert.strictEqual(diffStats.textContent, '+3 \u22121');
		assert.strictEqual(diffStats.querySelector('.conversation-diff-stat-add')?.textContent, '+3');
		assert.strictEqual(diffStats.querySelector('.conversation-diff-stat-del')?.textContent, '\u22121');
		assert.strictEqual(card.querySelector('.conversation-file-edit-path')?.textContent, 'file.ts');

		const diffArea = card.querySelector('.conversation-file-edit-diff') as HTMLElement;
		assert.ok(diffArea);
		assert.strictEqual(diffArea.hidden, false);
		assert.ok(diffArea.textContent?.includes('-one'));
		assert.ok(diffArea.textContent?.includes('+two'));
	});

	test('consecutive file edits share one card and sum the diff stats', () => {
		const first = toolTurn({
			id: 'edit-a',
			toolName: 'file_edit',
			metadata: {
				diff: '--- a\n+++ b\n-one\n+two',
				filediff: { file: 'docs/a.md', additions: 30, deletions: 10 },
			},
		});
		const second = toolTurn({
			id: 'edit-b',
			toolName: 'file_edit',
			metadata: {
				diff: '--- a\n+++ b\n-x\n+y',
				filediff: { file: 'scene/library.html', additions: 4, deletions: 3 },
			},
		});
		const span: ProcessFoldSpan = {
			id: 'fold:edit-a',
			startIndex: 0,
			endIndex: 2,
			turnIds: [first.id, second.id],
			nodes: [{ kind: 'tool', turn: first }, { kind: 'tool', turn: second }],
		};
		const container = renderFold(foldOptions({ isToolExpanded: () => false }), span);
		assert.strictEqual(container.querySelectorAll('.conversation-file-edit-card').length, 1);
		assert.strictEqual(container.querySelector('.conversation-file-edit-title')?.textContent, 'Edited 2 files');
		assert.strictEqual(container.querySelector('.conversation-file-edit-stats')?.textContent, '+34 \u221213');
		const paths = [...container.querySelectorAll('.conversation-file-edit-path')].map(item => item.textContent);
		assert.deepStrictEqual(paths, ['docs/a.md', 'scene/library.html']);
		const diffs = [...container.querySelectorAll<HTMLElement>('.conversation-file-edit-diff')];
		assert.strictEqual(diffs.length, 2);
		assert.ok(diffs.every(item => item.hidden));
		(container.querySelector('.conversation-file-edit-path') as HTMLButtonElement).click();
		assert.strictEqual(diffs[0]!.hidden, false);
		assert.strictEqual(diffs[1]!.hidden, true);
	});

	test('tool row keeps thinking text visible while the payload body is collapsed', () => {
		const turn = toolTurn({
			thinkingText: 'hmm before the tool',
			summary: 'running',
			toolStatus: 'running',
		});
		const container = renderFold(foldOptions({
			isOuterExpanded: () => true,
			isToolExpanded: () => false,
			showLiveChrome: true,
		}), toolSpan(turn));
		const row = container.querySelector('.conversation-process-fold-tool') as HTMLElement;
		assert.ok(row);
		const thought = row.querySelector('.conversation-process-fold-tool-thinking');
		assert.ok(thought);
		assert.strictEqual(thought.textContent, 'hmm before the tool');
		assert.strictEqual(thought.closest('.conversation-process-fold-tool-body'), null);
		const body = row.querySelector('.conversation-process-fold-tool-body') as HTMLElement;
		assert.ok(body);
		assert.strictEqual(body.hidden, true);
		assert.ok(!body.textContent?.includes('hmm before the tool'));
		const header = row.querySelector('.conversation-process-fold-tool-header') as HTMLElement;
		assert.ok(header.getAttribute('aria-label')?.includes('hmm before the tool'));
		assert.ok(!header.querySelector('.conversation-process-fold-tool-summary')?.textContent?.includes('hmm before the tool'));
	});

	test('whitespace thinking text does not add a thinking line', () => {
		const container = renderFold(foldOptions({
			isOuterExpanded: () => true,
			isToolExpanded: () => false,
		}), toolSpan(toolTurn({ thinkingText: '   \n\t' })));
		assert.strictEqual(container.querySelector('.conversation-process-fold-tool-thinking'), null);
	});

	test('tool details off keeps thinking text off the row and out of the name', () => {
		const container = renderFold(foldOptions({
			showToolInvocationDetails: false,
			isOuterExpanded: () => true,
			isToolExpanded: () => true,
		}), toolSpan(toolTurn({
			thinkingText: 'hmm before the tool',
			summary: 'completed',
		})));
		const row = container.querySelector('.conversation-process-fold-tool') as HTMLElement;
		assert.ok(row);
		assert.strictEqual(row.querySelector('.conversation-process-fold-tool-thinking'), null);
		assert.strictEqual(row.querySelector('.conversation-process-fold-tool-body'), null);
		const header = row.querySelector('.conversation-process-fold-tool-header') as HTMLElement;
		assert.strictEqual(header.tagName, 'DIV');
		assert.ok(header.textContent?.includes('read'));
		assert.ok(header.textContent?.includes('completed'));
		assert.ok(!header.getAttribute('aria-label')?.includes('hmm before the tool'));
		assert.ok(!row.textContent?.includes('hmm before the tool'));
	});

	test('thinking text that arrives while the fold is shut shows after expand', () => {
		const container = document.createElement('div');
		const disposables = store.add(new DisposableStore());
		let outerExpanded = false;
		const handle = renderProcessFoldSpan(container, toolSpan(toolTurn()), foldOptions({
			isOuterExpanded: () => outerExpanded,
			setOuterExpanded: (_spanId, expanded) => { outerExpanded = expanded; },
			isToolExpanded: () => false,
		}), disposables);
		handle.update(toolSpan(toolTurn({ thinkingText: 'hmm' })));
		assert.strictEqual(container.querySelector('.conversation-process-fold-tool-thinking'), null);

		const header = container.querySelector('.conversation-process-fold-header') as HTMLButtonElement;
		header.click();

		const thought = container.querySelector('.conversation-process-fold-tool-thinking');
		assert.ok(thought);
		assert.strictEqual(thought.textContent, 'hmm');
		const body = container.querySelector('.conversation-process-fold-tool-body') as HTMLElement;
		assert.strictEqual(body.hidden, true);
		assert.ok(!body.textContent?.includes('hmm'));
	});

	test('file_edit tool row with details off keeps the diff stats badge off the name', () => {
		const turn = toolTurn({
			toolName: 'file_edit',
			summary: 'edited file.ts',
			metadata: {
				diff: '--- a/file.ts\n+++ b/file.ts\n-one\n+two',
				filediff: { file: 'file.ts', additions: 3, deletions: 1 },
			},
		});
		const container = renderFold(foldOptions({ showToolInvocationDetails: false }), toolSpan(turn));
		const card = container.querySelector('.conversation-file-edit-card') as HTMLElement;
		assert.ok(card);
		assert.strictEqual(card.querySelector('.conversation-file-edit-title')?.textContent, 'Edited 1 file');
		assert.strictEqual(card.querySelector('.conversation-file-edit-path')?.textContent, 'file.ts');
		assert.strictEqual(card.querySelector('.conversation-file-edit-stats'), null);
		assert.ok(!card.textContent?.includes('+3'));
		assert.strictEqual(card.querySelector('.conversation-file-edit-diff'), null);
	});

	test('file_edit tool row without metadata keeps plain tool summary without diff stats', () => {
		const turn = toolTurn({
			toolName: 'file_edit',
			summary: 'edited file.ts',
		});
		const container = renderFold(foldOptions({ showToolInvocationDetails: true }), toolSpan(turn));
		const card = container.querySelector('.conversation-file-edit-card') as HTMLElement;
		assert.ok(card);
		assert.strictEqual(card.querySelector('.conversation-file-edit-path')?.textContent, 'edited file.ts');
		assert.strictEqual(card.querySelector('.conversation-file-edit-stats'), null);
		assert.strictEqual(card.querySelector('.conversation-file-edit-diff'), null);
	});

	test('fillProcessFoldDiffStats weakens zero counts and retains color classes for non-zero counts (V8)', () => {
		const host = document.createElement('span');

		// "+0 −3": plus span has no add class, minus span has del class
		fillProcessFoldDiffStats(host, '+0 \u22123');
		assert.strictEqual(host.textContent, '+0 \u22123');
		const spans03 = host.querySelectorAll('span');
		assert.strictEqual(spans03.length, 2);
		assert.strictEqual(spans03[0].textContent, '+0');
		assert.strictEqual(spans03[0].classList.contains('conversation-diff-stat-add'), false);
		assert.strictEqual(host.querySelector('.conversation-diff-stat-add'), null);
		assert.strictEqual(spans03[1].textContent, '\u22123');
		assert.strictEqual(spans03[1].classList.contains('conversation-diff-stat-del'), true);
		assert.strictEqual(host.querySelector('.conversation-diff-stat-del')?.textContent, '\u22123');

		// "+2 −0": opposite
		fillProcessFoldDiffStats(host, '+2 \u22120');
		assert.strictEqual(host.textContent, '+2 \u22120');
		const spans20 = host.querySelectorAll('span');
		assert.strictEqual(spans20.length, 2);
		assert.strictEqual(spans20[0].textContent, '+2');
		assert.strictEqual(spans20[0].classList.contains('conversation-diff-stat-add'), true);
		assert.strictEqual(host.querySelector('.conversation-diff-stat-add')?.textContent, '+2');
		assert.strictEqual(spans20[1].textContent, '\u22120');
		assert.strictEqual(spans20[1].classList.contains('conversation-diff-stat-del'), false);
		assert.strictEqual(host.querySelector('.conversation-diff-stat-del'), null);

		// "+1 −2": both spans have colored classes
		fillProcessFoldDiffStats(host, '+1 \u22122');
		assert.strictEqual(host.textContent, '+1 \u22122');
		const spans12 = host.querySelectorAll('span');
		assert.strictEqual(spans12.length, 2);
		assert.strictEqual(spans12[0].textContent, '+1');
		assert.strictEqual(spans12[0].classList.contains('conversation-diff-stat-add'), true);
		assert.strictEqual(host.querySelector('.conversation-diff-stat-add')?.textContent, '+1');
		assert.strictEqual(spans12[1].textContent, '\u22122');
		assert.strictEqual(spans12[1].classList.contains('conversation-diff-stat-del'), true);
		assert.strictEqual(host.querySelector('.conversation-diff-stat-del')?.textContent, '\u22122');

		// Fallback for non-matching text
		fillProcessFoldDiffStats(host, 'fallback plain');
		assert.strictEqual(host.textContent, 'fallback plain');
		assert.strictEqual(host.children.length, 0);
	});

	test('file_edit tool row with zero additions omits add class and keeps del class', () => {
		const turn = toolTurn({
			toolName: 'file_edit',
			summary: 'deleted lines',
			metadata: {
				diff: '--- a/file.ts\n+++ b/file.ts\n-one\n-two\n-three',
				filediff: { file: 'file.ts', additions: 0, deletions: 3 },
			},
		});
		const container = renderFold(foldOptions({ showToolInvocationDetails: true }), toolSpan(turn));
		const diffStats = container.querySelector('.conversation-file-edit-stats') as HTMLElement;
		assert.ok(diffStats);
		assert.strictEqual(diffStats.textContent, '+0 \u22123');
		assert.strictEqual(diffStats.querySelector('.conversation-diff-stat-add'), null);
		assert.strictEqual(diffStats.querySelector('.conversation-diff-stat-del')?.textContent, '\u22123');
	});
});
