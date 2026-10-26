/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getWindow } from '../../../../../base/browser/dom.js';
import { Color, RGBA } from '../../../../../base/common/color.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationConfirmationSeat } from '../../browser/conversationConfirmationSeat.js';
import { ConversationQuestionSeat } from '../../browser/conversationQuestionSeat.js';

suite('Conversation pending badge styles', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	// Default Modern theme tokens and the platform's high-contrast defaults.
	const themes = [
		{ name: 'Light Modern', type: 'vs', foreground: '#3B3B3B', background: '#FFFFFF', badgeBackground: '#CCCCCC', badgeForeground: '#3B3B3B', border: undefined },
		{ name: 'Dark Modern', type: 'vs-dark', foreground: '#CCCCCC', background: '#1F1F1F', badgeBackground: '#616161', badgeForeground: '#F8F8F8', border: undefined },
		{ name: 'High Contrast Dark', type: 'hc-black', foreground: '#FFFFFF', background: '#000000', badgeBackground: '#000000', badgeForeground: '#FFFFFF', border: '#6FC3DF' },
		{ name: 'High Contrast Light', type: 'hc-light', foreground: '#292929', background: '#FFFFFF', badgeBackground: '#0F4A85', badgeForeground: '#FFFFFF', border: '#0F4A85' },
	];

	// Canvas resolves computed color(srgb ...) from color-mix in the browser.
	// Layering also makes a transparent regression measure against its real seat.
	function paintedColor(...layers: string[]): Color {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		const context = canvas.getContext('2d')!;
		for (const layer of layers) {
			context.fillStyle = layer;
			context.fillRect(0, 0, 1, 1);
		}
		const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
		return new Color(new RGBA(r, g, b, a / 255));
	}

	for (const theme of themes) {
		test(`${theme.name}: pending permission and question text is readable at narrow and wide widths`, async () => {
			const stylesheet = document.createElement('link');
			stylesheet.rel = 'stylesheet';
			stylesheet.href = new URL('../../browser/media/conversationLens.css', import.meta.url).href;
			store.add(toDisposable(() => stylesheet.remove()));
			await new Promise<void>((resolve, reject) => {
				stylesheet.onload = () => resolve();
				stylesheet.onerror = () => reject(new Error('Conversation stylesheet failed to load'));
				document.head.appendChild(stylesheet);
			});

			const workbench = document.createElement('div');
			workbench.className = `monaco-workbench ${theme.type}`;
			for (const [name, value] of Object.entries({
				foreground: theme.foreground,
				'editor-background': theme.background,
				'descriptionForeground': theme.foreground,
				'badge-background': theme.badgeBackground,
				'badge-foreground': theme.badgeForeground,
				'contrastBorder': theme.border ?? 'transparent',
				'strokeThickness': '1px',
			})) {
				workbench.style.setProperty(`--vscode-${name}`, value);
			}
			const part = document.createElement('div');
			part.className = 'part conversation';
			part.style.backgroundColor = theme.background;
			workbench.appendChild(part);
			document.body.appendChild(workbench);
			store.add(toDisposable(() => workbench.remove()));

			const decisions: string[] = [];
			const permission = store.add(new ConversationConfirmationSeat({
				message: 'Allow this tool?', status: 'pending',
				onAllow: () => decisions.push('allowed'), onSkip: () => decisions.push('skipped'),
			}));
			const question = store.add(new ConversationQuestionSeat({
				message: 'Which option?', status: 'pending', answerKeysValid: true, questionRequestId: 'q1',
				questionItems: [{ id: 'choice', title: 'Which option?', options: ['First', 'Second'] }],
				onRespond: () => { },
			}));
			part.append(permission.element, question.element);
			const pendingBadge = permission.element.querySelector<HTMLElement>('.conversation-lens-input-needed')!;
			const questionBadge = question.element.querySelector<HTMLElement>('.conversation-lens-turn-honest-status')!;
			for (const width of [300, 720, 300]) {
				workbench.style.width = `${width}px`;
				for (const [badge, seat] of [[pendingBadge, permission.element], [questionBadge, question.element]]) {
					const style = getWindow(badge).getComputedStyle(badge);
					const seatStyle = getWindow(seat).getComputedStyle(seat);
					const background = paintedColor(theme.background, seatStyle.backgroundColor, style.backgroundColor);
					const foreground = paintedColor(style.color);
					const contrast = foreground.getContrastRatio(background);
					assert.ok(contrast >= 4.5, `${theme.name} ${badge.className}: contrast ${contrast.toFixed(2)} must reach 4.5:1`);
					const bounds = badge.getBoundingClientRect();
					const parent = seat.getBoundingClientRect();
					assert.deepStrictEqual({
						text: badge.textContent,
						compact: bounds.height > 0 && bounds.height <= 22,
						withinSeat: bounds.left >= parent.left && bounds.right <= parent.right,
						unclipped: badge.scrollWidth <= badge.clientWidth,
						opacity: style.opacity,
					}, { text: 'Input needed', compact: true, withinSeat: true, unclipped: true, opacity: '1' });
				}
			}
			if (theme.border) {
				const style = getWindow(pendingBadge).getComputedStyle(pendingBadge);
				assert.deepStrictEqual({ width: style.borderTopWidth, color: paintedColor(style.borderTopColor).toString() }, {
					width: '1px', color: Color.fromHex(theme.border).toString(),
				});
			}

			// The small status remains noninteractive; keyboard focus still goes to decisions.
			const buttons = permission.element.querySelectorAll<HTMLElement>('.monaco-button');
			buttons[0].focus();
			buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
			assert.strictEqual(document.activeElement, buttons[1]);
			assert.strictEqual(pendingBadge.tabIndex, -1);
			buttons[1].click();
			assert.deepStrictEqual(decisions, ['skipped']);
		});
	}
});
