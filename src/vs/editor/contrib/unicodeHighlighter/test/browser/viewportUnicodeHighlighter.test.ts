/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { Event } from '../../../../../base/common/event.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { NullHoverService } from '../../../../../platform/hover/test/browser/nullHoverService.js';
import { IMarkdownRendererService } from '../../../../../platform/markdown/browser/markdownRenderer.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IWorkspaceTrustManagementService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import { withAsyncTestCodeEditor } from '../../../../test/browser/testCodeEditor.js';
import { DisableHighlightingOfAmbiguousCharactersAction, DisableHighlightingOfInvisibleCharactersAction, DisableHighlightingOfNonBasicAsciiCharactersAction, UnicodeHighlighter } from '../../browser/unicodeHighlighter.js';

suite('ViewportUnicodeHighlighter', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const serviceCollection = new ServiceCollection(
		[IWorkspaceTrustManagementService, new class extends mock<IWorkspaceTrustManagementService>() {
			override isWorkspaceTrusted(): boolean {
				return true;
			}
			override readonly onDidChangeTrust = Event.None;
		}],
		[IMarkdownRendererService, new class extends mock<IMarkdownRendererService>() { }],
		[IHoverService, NullHoverService],
	);

	function repeatChar(codePoint: number, count: number): string {
		return String.fromCodePoint(codePoint).repeat(count);
	}

	async function assertViewportBanner(
		charCodePoint: number,
		unicodeHighlight: { nonBasicASCII: boolean; invisibleCharacters: boolean; ambiguousCharacters: boolean },
		expectedMessage: string,
		expectedHref: string,
	): Promise<void> {
		const text = repeatChar(charCodePoint, 1001);
		await withAsyncTestCodeEditor(text, {
			serviceCollection,
			wordWrap: 'off',
			unicodeHighlight,
		}, async (editor) => {
			const model = editor.getModel()!;
			const visibleRanges = editor.getVisibleRanges();
			assert.strictEqual(visibleRanges.length, 1);
			assert.strictEqual(visibleRanges[0].startLineNumber, 1);
			assert.strictEqual(visibleRanges[0].endLineNumber, 1);
			assert.strictEqual(visibleRanges[0].endColumn, model.getLineMaxColumn(1));

			let capturedBanner: HTMLElement | null = null;
			editor.registerAndInstantiateContribution(UnicodeHighlighter.ID, UnicodeHighlighter);
			editor.setBanner = (domNode) => {
				capturedBanner = domNode;
			};

			await timeout(300);

			assert.ok(capturedBanner, 'expected unicode highlight banner');
			assert.ok(capturedBanner!.textContent?.includes(expectedMessage), `banner text should include: ${expectedMessage}`);
			const link = capturedBanner!.querySelector('a.monaco-link') as HTMLAnchorElement | null;
			assert.ok(link);
			assert.strictEqual(link.getAttribute('href'), expectedHref);
		});
	}

	test('ViewportUnicodeHighlighter: invisible characters banner uses disable invisible command', async () => {
		await assertViewportBanner(
			0x00A0,
			{ nonBasicASCII: false, invisibleCharacters: true, ambiguousCharacters: false },
			'This document contains many invisible unicode characters',
			`command:${DisableHighlightingOfInvisibleCharactersAction.ID}`,
		);
	});

	test('ViewportUnicodeHighlighter: ambiguous characters banner uses disable ambiguous command', async () => {
		await assertViewportBanner(
			0x03B1,
			{ nonBasicASCII: false, invisibleCharacters: false, ambiguousCharacters: true },
			'This document contains many ambiguous unicode characters',
			`command:${DisableHighlightingOfAmbiguousCharactersAction.ID}`,
		);
	});

	test('ViewportUnicodeHighlighter: nonBasicASCII banner unchanged when counts are fixed', async () => {
		await assertViewportBanner(
			0x00A0,
			{ nonBasicASCII: true, invisibleCharacters: false, ambiguousCharacters: false },
			'This document contains many non-basic ASCII unicode characters',
			`command:${DisableHighlightingOfNonBasicAsciiCharactersAction.ID}`,
		);
	});
});
