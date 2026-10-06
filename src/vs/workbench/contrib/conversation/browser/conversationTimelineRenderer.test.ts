/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ITreeNode } from '../../../../base/browser/ui/tree/tree.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { IWebviewService } from '../../webview/browser/webview.js';
import { ConversationTimelineRenderer } from './conversationTimelineRenderer.js';
import type { ConversationStubTurn } from './conversationStubModel.js';
import type { ConversationTimelineItem } from './conversationTimelineTypes.js';

suite('ConversationTimelineRenderer row height generation', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function turnNode(turn: ConversationStubTurn): ITreeNode<ConversationTimelineItem, void> {
		return {
			element: { variant: 'turn', turn },
			children: [],
			depth: 0,
			visibleChildrenCount: 0,
			visibleChildIndex: 0,
			collapsible: false,
			collapsed: false,
			filterData: undefined,
		} as unknown as ITreeNode<ConversationTimelineItem, void>;
	}

	function flushAnimationFrames(): Promise<void> {
		return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	}

	test('stale rAF after row recycle does not apply height to the previous item', async () => {
		const reported: { turnId: string; height: number }[] = [];
		const renderer = new ConversationTimelineRenderer(
			{
				renderTurnBody: (turn, body) => {
					body.replaceChildren();
					const probe = document.createElement('div');
					probe.style.height = turn.id === 'tall-turn' ? '240px' : '24px';
					probe.style.width = '1px';
					body.appendChild(probe);
					return Disposable.None;
				},
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			() => undefined,
			undefined,
			() => undefined,
			() => false,
			() => true,
			() => false,
			{} as IWebviewService,
			() => undefined,
			(item, height) => reported.push({ turnId: item.turn.id, height }),
		);

		const host = document.createElement('div');
		document.body.appendChild(host);
		const template = renderer.renderTemplate(host);

		renderer.renderElement(turnNode({ id: 'tall-turn', kind: 'assistant', text: 'long body' }), 0, template);
		renderer.renderElement(turnNode({ id: 'short-turn', kind: 'assistant', text: 'x' }), 0, template);

		await flushAnimationFrames();

		assert.ok(!reported.some(entry => entry.turnId === 'tall-turn'), `unexpected stale height for tall-turn: ${JSON.stringify(reported)}`);
		assert.ok(reported.some(entry => entry.turnId === 'short-turn' && entry.height > 0), `expected height for short-turn: ${JSON.stringify(reported)}`);

		template.disposables.dispose();
		host.remove();
	});
});
