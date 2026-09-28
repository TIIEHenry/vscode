/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as marked from '../../../../../base/common/marked/marked.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { appendPrefixText, createConversationStreamingMarkdown, type ConversationStreamingRenderTarget } from '../../browser/conversationStreamingMarkdown.js';

interface RenderCall {
	readonly markdown: string;
	readonly fillInIncomplete: boolean;
}

function createFakeRenderer(): { calls: RenderCall[]; decorations: HTMLElement[]; renderer: ConversationStreamingRenderTarget } {
	const calls: RenderCall[] = [];
	const decorations: HTMLElement[] = [];
	return {
		calls,
		decorations,
		renderer: {
			render(markdown, target, fillInIncompleteTokens) {
				calls.push({ markdown, fillInIncomplete: fillInIncompleteTokens });
				target.textContent = markdown;
			},
			decorate(target) {
				decorations.push(target);
			},
		},
	};
}

function isProperPrefix(tokenRaw: string, markdown: string): boolean {
	return markdown.length > 0 && markdown.length < tokenRaw.length && tokenRaw.startsWith(markdown);
}

suite('ConversationStreamingMarkdown', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('re-renders only the last two tokens after four paragraphs and keeps frozen nodes', () => {
		const { calls, decorations, renderer } = createFakeRenderer();
		const container = document.createElement('div');
		const handle = createConversationStreamingMarkdown(container, renderer);

		let text = '';
		for (const piece of ['a', '\n\n ', 'b', '\n\n ', 'c', '\n\n ', 'd']) {
			text += piece;
			handle.update(text);
		}
		assert.strictEqual(text, 'a\n\n b\n\n c\n\n d');
		assert.strictEqual(marked.lexer(text).filter(token => token.type === 'paragraph').length, 4);

		const frozen = [...container.children].slice(0, -1);
		assert.ok(frozen.length > 0);
		assert.strictEqual(decorations.length, frozen.length);
		for (let i = 0; i < frozen.length; i++) {
			assert.strictEqual(decorations[i], frozen[i]);
		}

		const callsBefore = calls.length;
		const decorationCount = decorations.length;
		text += 'x';
		handle.update(text);

		for (let i = 0; i < frozen.length; i++) {
			assert.strictEqual(container.children[i], frozen[i]);
		}
		assert.strictEqual(decorations.length, decorationCount);
		const added = calls.slice(callsBefore);
		assert.strictEqual(added.length, 1);
		assert.strictEqual(added[0].fillInIncomplete, true);
		assert.notStrictEqual(added[0].markdown, text);
		handle.dispose();
	});

	test('prefix append does not clear frozen nodes', () => {
		const { calls, renderer } = createFakeRenderer();
		const container = document.createElement('div');
		const handle = createConversationStreamingMarkdown(container, renderer);
		const text = 'a\n\n b\n\n c\n\n d';
		handle.update(text);
		const first = container.firstElementChild;
		assert.ok(first);
		assert.strictEqual(first.textContent, 'a');

		const callsBefore = calls.length;
		const next = text + '\n\ne';
		handle.update(next);

		assert.strictEqual(container.firstElementChild, first);
		assert.strictEqual(first.textContent, 'a');
		assert.strictEqual(container.textContent, next);
		for (const call of calls.slice(callsBefore)) {
			assert.notStrictEqual(call.markdown, next);
		}
		handle.dispose();
	});

	test('non-prefix replacement clears frozen nodes and starts over', () => {
		const { renderer } = createFakeRenderer();
		const container = document.createElement('div');
		const handle = createConversationStreamingMarkdown(container, renderer);
		handle.update('a\n\n b\n\n c\n\n d');
		const frozen = [...container.children];
		assert.ok(frozen.length > 0);

		const next = 'Z\n\n b\n\n c\n\n d';
		handle.update(next);

		for (const node of frozen) {
			assert.strictEqual(container.contains(node), false);
		}
		assert.strictEqual(container.textContent, next);
		handle.dispose();
	});

	test('unclosed fence in the tail is rendered with fillInIncompleteTokens', () => {
		const { calls, renderer } = createFakeRenderer();
		const container = document.createElement('div');
		const handle = createConversationStreamingMarkdown(container, renderer);
		const text = 'before\n\n```\ncode';
		handle.update(text);

		const incomplete = calls.filter(call => call.fillInIncomplete);
		assert.strictEqual(incomplete.length, 1);
		assert.strictEqual(incomplete[0].fillInIncomplete, true);
		assert.ok(incomplete[0].markdown.endsWith('```\ncode'));
		assert.ok(text.endsWith('```\ncode'));
		handle.dispose();
	});

	test('finalize renders the full text once with fillInIncomplete false', () => {
		const { calls, renderer } = createFakeRenderer();
		const container = document.createElement('div');
		const handle = createConversationStreamingMarkdown(container, renderer);
		const text = 'a\n\n b\n\n c\n\n d';
		handle.update(text);
		calls.length = 0;

		handle.finalize();

		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0].markdown, text);
		assert.strictEqual(calls[0].fillInIncomplete, false);
		assert.strictEqual(container.textContent, text);
		handle.dispose();
		handle.dispose();
	});

	test('list continuation, indented code, and tilde fence are not split', () => {
		const markdown = [
			'a',
			'',
			'b',
			'',
			'- item',
			'  continuation',
			'',
			'~~~',
			'code',
			'~~~',
			'',
			'    indented',
			'    more',
			'',
			'tail',
		].join('\n');
		const tokens = marked.lexer(markdown);
		const list = tokens.find(token => token.type === 'list');
		const fence = tokens.find(token => token.type === 'code' && token.raw.startsWith('~~~'));
		const indented = tokens.find(token => token.type === 'code' && token.raw.startsWith('    '));
		assert.ok(list);
		assert.ok(fence);
		assert.ok(indented);
		assert.ok(list.raw.includes('continuation'));
		assert.strictEqual(tokens.filter(token => token.type === 'list').length, 1);
		assert.strictEqual(tokens.filter(token => token.type === 'code' && token.raw.startsWith('~~~')).length, 1);

		const tailStart = Math.max(0, tokens.length - 2);
		const tailTokens = tokens.slice(tailStart);
		assert.ok(tailTokens.includes(indented));
		assert.strictEqual(tailTokens.includes(list), false);
		assert.strictEqual(tailTokens.includes(fence), false);

		const { calls, renderer } = createFakeRenderer();
		const container = document.createElement('div');
		const handle = createConversationStreamingMarkdown(container, renderer);
		handle.update(markdown);

		const tailCalls = calls.filter(call => call.fillInIncomplete);
		assert.strictEqual(tailCalls.length, 1);
		assert.strictEqual(tailCalls[0].markdown, tailTokens.map(token => token.raw).join(''));
		assert.ok(tailCalls[0].markdown.includes(indented.raw));
		assert.ok(calls.some(call => !call.fillInIncomplete && call.markdown === list.raw));
		assert.ok(calls.some(call => !call.fillInIncomplete && call.markdown === fence.raw));
		for (const token of [list, fence, indented]) {
			for (const call of calls) {
				assert.strictEqual(isProperPrefix(token.raw, call.markdown), false);
			}
		}
		handle.dispose();

		const growing = 'a\n\n- item\n  continuation';
		const growingTokens = marked.lexer(growing);
		const growingList = growingTokens.find(token => token.type === 'list');
		assert.ok(growingList);
		assert.ok(growingList.raw.includes('continuation'));
		const growingTail = growingTokens.slice(Math.max(0, growingTokens.length - 2));
		assert.ok(growingTail.includes(growingList));

		const tailCase = createFakeRenderer();
		const tailContainer = document.createElement('div');
		const tailHandle = createConversationStreamingMarkdown(tailContainer, tailCase.renderer);
		tailHandle.update(growing);
		const growingTailCalls = tailCase.calls.filter(call => call.fillInIncomplete);
		assert.strictEqual(growingTailCalls.length, 1);
		assert.strictEqual(growingTailCalls[0].markdown, growingTail.map(token => token.raw).join(''));
		assert.ok(growingTailCalls[0].markdown.includes(growingList.raw));
		for (const call of tailCase.calls) {
			assert.strictEqual(isProperPrefix(growingList.raw, call.markdown), false);
		}
		tailHandle.dispose();
	});

	test('appendPrefixText appends only the new suffix', () => {
		const node = document.createTextNode('hello');
		assert.strictEqual(appendPrefixText(node, 'hello', 'hello world'), true);
		assert.strictEqual(node.data, 'hello world');
		assert.strictEqual(appendPrefixText(node, 'hello world', 'hello world'), true);
		assert.strictEqual(node.data, 'hello world');
		assert.strictEqual(appendPrefixText(node, 'other', 'hello world!'), false);
		assert.strictEqual(node.data, 'hello world');
	});
});
