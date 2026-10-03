/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../base/browser/window.js';
import { toDisposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { ILanguageService } from '../../../editor/common/languages/language.js';
import { ITextFileService } from '../../../workbench/services/textfile/common/textfiles.js';
import { IFileDiffViewData, MobileDiffView, shouldCommitMobileDiffFileSwipe } from '../../browser/parts/mobile/contributions/mobileDiffView.js';

suite('MobileDiffView', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const swipe = {
		dy: 0,
		elapsedMs: 80,
		viewportWidth: 400,
	};

	test('keeps a long line pan from opening the next file', () => {
		assert.strictEqual(shouldCommitMobileDiffFileSwipe({
			...swipe,
			dx: -220,
			scrollLeft: 0,
			scrollWidth: 900,
			clientWidth: 400,
		}), false);
		assert.strictEqual(shouldCommitMobileDiffFileSwipe({
			...swipe,
			dx: 220,
			scrollLeft: 180,
			scrollWidth: 900,
			clientWidth: 400,
		}), false);
	});

	test('changes files only from the edge the line cannot scroll past', () => {
		assert.strictEqual(shouldCommitMobileDiffFileSwipe({
			...swipe,
			dx: -220,
			scrollLeft: 500,
			scrollWidth: 900,
			clientWidth: 400,
		}), true, 'left swipe at the right edge opens the next file');
		assert.strictEqual(shouldCommitMobileDiffFileSwipe({
			...swipe,
			dx: 220,
			scrollLeft: 0,
			scrollWidth: 900,
			clientWidth: 400,
		}), true, 'right swipe at the left edge opens the previous file');
		assert.strictEqual(shouldCommitMobileDiffFileSwipe({
			...swipe,
			dx: -220,
			scrollLeft: 499,
			scrollWidth: 900,
			clientWidth: 400,
		}), true, 'one pixel of leftover scroll still counts as the edge');
		assert.strictEqual(shouldCommitMobileDiffFileSwipe({
			...swipe,
			dx: -220,
			scrollLeft: 0,
			scrollWidth: 400,
			clientWidth: 400,
		}), true, 'a line that does not overflow still swipes to the next file');
	});

	test('ignores vertical pans and short drags', () => {
		assert.strictEqual(shouldCommitMobileDiffFileSwipe({
			...swipe,
			dx: -40,
			dy: -200,
			scrollLeft: 0,
			scrollWidth: 400,
			clientWidth: 400,
		}), false);
		assert.strictEqual(shouldCommitMobileDiffFileSwipe({
			...swipe,
			dx: -20,
			elapsedMs: 400,
			scrollLeft: 0,
			scrollWidth: 400,
			clientWidth: 400,
		}), false);
	});

	test('a touch pan across a long line stays on the current file until the edge', async () => {
		const originalA = URI.parse('inmemory://original/src/long-line.ts');
		const modifiedA = URI.parse('inmemory://modified/src/long-line.ts');
		const originalB = URI.parse('inmemory://original/src/next-file.ts');
		const modifiedB = URI.parse('inmemory://modified/src/next-file.ts');
		const longLine = `export const value = ${'x'.repeat(400)};`;
		const files = new Map<string, string>([
			[originalA.toString(), 'export const value = 1;\n'],
			[modifiedA.toString(), `${longLine}\n`],
			[originalB.toString(), 'export const other = 1;\n'],
			[modifiedB.toString(), 'export const other = 2;\n'],
		]);
		const diffs: IFileDiffViewData[] = [
			{ originalURI: originalA, modifiedURI: modifiedA, identical: false, added: 1, removed: 1 },
			{ originalURI: originalB, modifiedURI: modifiedB, identical: false, added: 1, removed: 1 },
		];
		const textFileService = {
			read(uri: URI) {
				return Promise.resolve({ value: files.get(uri.toString()) ?? '' });
			}
		} as unknown as ITextFileService;
		const languageService = {
			guessLanguageIdByFilepathOrFirstLine(): string {
				return 'typescript';
			}
		} as unknown as ILanguageService;

		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));

		const view = store.add(new MobileDiffView(container, {
			diff: diffs[0],
			siblings: diffs,
			index: 0,
		}, textFileService, languageService));
		await waitForCondition(() => !!container.querySelector('.mobile-diff-line'), 'the first file should render');

		const title = container.querySelector('.mobile-overlay-header-title');
		const scroll = container.querySelector('.mobile-overlay-scroll') as HTMLElement | null;
		assert.ok(title, 'title should exist');
		assert.ok(scroll, 'scroll wrapper should exist');
		assert.strictEqual(title.textContent, 'long-line.ts');

		const swipeLeft = () => {
			scroll.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 320, clientY: 80, pointerId: 1 }));
			scroll.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', clientX: 20, clientY: 82, pointerId: 1 }));
		};

		const maxScrollLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
		if (maxScrollLeft > 1) {
			scroll.scrollLeft = 0;
			swipeLeft();
			assert.strictEqual(title.textContent, 'long-line.ts', 'panning a long line should stay on this file');
			scroll.scrollLeft = maxScrollLeft;
			swipeLeft();
		} else {
			swipeLeft();
		}
		assert.strictEqual(title.textContent, 'next-file.ts', 'swiping from the edge should open the next file');

		view.dispose();
	});
});

function animationFrame(): Promise<void> {
	return new Promise(resolve => mainWindow.requestAnimationFrame(() => resolve()));
}

async function waitForCondition(condition: () => boolean, message: string): Promise<void> {
	for (let i = 0; i < 60; i++) {
		if (condition()) {
			return;
		}
		await animationFrame();
	}
	assert.fail(message);
}
