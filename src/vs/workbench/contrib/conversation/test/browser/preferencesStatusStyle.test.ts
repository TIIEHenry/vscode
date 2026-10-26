/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getWindow } from '../../../../../base/browser/dom.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { InputBox } from '../../../../../base/browser/ui/inputbox/inputBox.js';
import { timeout } from '../../../../../base/common/async.js';
import { Color, RGBA } from '../../../../../base/common/color.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { defaultInputBoxStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { writeStatus } from '../../browser/connectionPreferencesPane.js';
import { EngineProvidersSection } from '../../browser/engineProviderModelSection.js';
import { createConversationConnectionTestStub, createTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

suite('Preferences status styles', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	// Product theme tokens plus the platform's high-contrast defaults.
	const themes = [
		{ name: 'UniverseAgentStudio Light', type: 'vs', foreground: '#202020', description: '#606060', background: '#FFFFFF', warning: '#BF8803', success: '#73C991', activeBackground: '#00000025', activeForeground: '#202020', inactiveBackground: '#DADADA99', inactiveForeground: '#202020', hover: '#0000001F', focus: '#0069CC', border: undefined },
		{ name: 'UniverseAgentStudio Dark', type: 'vs-dark', foreground: '#BFBFBF', description: '#8C8C8C', background: '#121314', warning: '#CCA700', success: '#73C991', activeBackground: '#FFFFFF22', activeForeground: '#EDEDED', inactiveBackground: '#2C2D2E', inactiveForeground: '#EDEDED', hover: '#FFFFFF1A', focus: '#3994BCB3', border: undefined },
		{ name: 'High Contrast Dark', type: 'hc-black', foreground: '#FFFFFF', description: '#FFFFFF', background: '#000000', warning: '#FFD370', success: '#73C991', activeBackground: 'transparent', activeForeground: '#FFFFFF', inactiveBackground: 'transparent', inactiveForeground: '#FFFFFF', hover: 'transparent', focus: '#F38518', border: '#6FC3DF' },
		{ name: 'High Contrast Light', type: 'hc-light', foreground: '#292929', description: '#292929', background: '#FFFFFF', warning: '#895503', success: '#007100', activeBackground: '#0F4A851A', activeForeground: '#292929', inactiveBackground: '#0F4A851A', inactiveForeground: '#292929', hover: 'transparent', focus: '#0F4A85', border: '#0F4A85' },
	];

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

	async function mountWorkbench(theme: typeof themes[number]): Promise<HTMLElement> {
		await Promise.all(['connectionPreferencesPane', 'enginePreferencesPane'].map(async name => {
			const stylesheet = document.createElement('link');
			stylesheet.rel = 'stylesheet';
			stylesheet.href = new URL(`../../browser/media/${name}.css`, import.meta.url).href;
			store.add(toDisposable(() => stylesheet.remove()));
			await new Promise<void>((resolve, reject) => {
				stylesheet.onload = () => resolve();
				stylesheet.onerror = () => reject(new Error(`${name} stylesheet failed to load`));
				document.head.appendChild(stylesheet);
			});
		}));
		const themeHost = document.createElement('div');
		const workbench = document.createElement('div');
		workbench.className = `monaco-workbench ${theme.type} monaco-reduce-motion`;
		workbench.style.color = theme.foreground;
		workbench.style.backgroundColor = theme.background;
		workbench.style.fontSize = '13px';
		workbench.style.fontFamily = 'sans-serif';
		for (const [name, value] of Object.entries({
			foreground: theme.foreground,
			descriptionForeground: theme.description,
			'editor-background': theme.background,
			'editorWarning-foreground': theme.warning,
			'notificationsWarningIcon-foreground': theme.warning,
			'testing-iconPassed': theme.success,
			'list-activeSelectionBackground': theme.activeBackground,
			'list-activeSelectionForeground': theme.activeForeground,
			'list-inactiveSelectionBackground': theme.inactiveBackground,
			'list-inactiveSelectionForeground': theme.inactiveForeground,
			'toolbar-hoverBackground': theme.hover,
			'list-focusOutline': theme.focus,
			focusBorder: theme.focus,
			contrastBorder: theme.border ?? 'transparent',
			contrastActiveBorder: theme.border ?? theme.focus,
			strokeThickness: '1px',
			'fontSize-label1': '12px',
			'spacing-size80': '8px',
			'spacing-size120': '12px',
			'spacing-size200': '20px',
		})) {
			workbench.style.setProperty(`--vscode-${name}`, value);
		}
		themeHost.appendChild(workbench);
		document.body.appendChild(themeHost);
		store.add(toDisposable(() => themeHost.remove()));
		return workbench;
	}

	function append(parent: HTMLElement, className: string, text = ''): HTMLElement {
		const element = document.createElement('div');
		element.className = className;
		element.textContent = text;
		parent.appendChild(element);
		return element;
	}

	async function mountProviderRows(theme: typeof themes[number], writable: boolean) {
		const workbench = await mountWorkbench(theme);
		const engine = append(workbench, 'engine-preferences-pane is-narrow');
		const capabilities = createTestCapabilitySnapshot({ providerConfig: { support: 'SUPPORTED' } });
		const entries = [
			{ providerId: 'anthropic-workspace', brand: 'Anthropic enterprise workspace endpoint with a long name', protocol: 'anthropic', configured: true, credentialSource: 'PROVIDER_ENV', hasBaseUrl: true, enabled: true },
			{ providerId: 'openai-workspace', brand: 'OpenAI enterprise workspace endpoint with a long name', protocol: 'openai', configured: false, credentialSource: 'BUILTIN_ENV', hasBaseUrl: false, enabled: false },
		];
		let writes = 0;
		const service = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getCapabilitySnapshot: () => capabilities,
			listProviderStatus: async () => ({ providers: entries }),
			upsertProviderCredentials: writable ? async () => { writes++; return entries[0]; } : undefined,
			clearProviderCredentials: writable ? async () => { writes++; return entries[0]; } : undefined,
		});
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, service);
		const providers = store.add(instantiationService.createInstance(EngineProvidersSection, engine));
		providers.setSectionActive(true);
		await timeout(0);
		const rows = [...providers.getDomNode().querySelectorAll<HTMLElement>('.engine-provider-status-row')];
		assert.strictEqual(rows.length, entries.length);
		return { workbench, engine, entries, rows, getWrites: () => writes };
	}

	for (const theme of themes) {
		test(`${theme.name}: success and warning text stays readable and semantic indicators survive`, async () => {
			const workbench = await mountWorkbench(theme);
			const connection = append(workbench, 'connection-preferences-pane');
			const engine = append(workbench, 'engine-preferences-pane is-narrow');
			const statuses: HTMLElement[] = [];
			for (const tone of ['success', 'warning'] as const) {
				const status = append(connection, 'connection-status');
				writeStatus(status, tone === 'success' ? 'Connected.' : 'Engine not connected — open Connection to choose an engine.', tone);
				statuses.push(status);
				const testStatus = append(engine, 'engine-test-status');
				writeStatus(testStatus, status.textContent!, tone);
				statuses.push(testStatus);
			}
			statuses.push(append(connection, 'connection-hub-directory-banner is-success', 'Signed in.'));
			statuses.push(append(engine, 'engine-catalog-write-status is-success', 'Saved.'));
			statuses.push(append(engine, 'engine-preferences-disconnected-banner is-warning', 'This environment does not support a local engine.'));
			statuses.push(append(engine, 'engine-section-status engine-section-status--warning is-visible', 'This feature is unavailable.'));

			const capabilities = createTestCapabilitySnapshot({ providerConfig: { support: 'SUPPORTED' } });
			const service = createConversationConnectionTestStub({
				isEngineConnected: () => true,
				getCapabilitySnapshot: () => capabilities,
				listProviderStatus: async () => ({ providers: [
					{ providerId: 'ready', brand: 'Ready', protocol: 'openai', configured: true, credentialSource: 'NONE', hasBaseUrl: true, enabled: true },
					{ providerId: 'disabled', brand: 'Disabled', protocol: 'openai', configured: false, credentialSource: 'NONE', hasBaseUrl: false, enabled: false },
				] }),
			});
			const instantiationService = workbenchInstantiationService(undefined, store);
			instantiationService.stub(IUniverseAgentConnection, service);
			const providers = store.add(instantiationService.createInstance(EngineProvidersSection, engine));
			providers.setSectionActive(true);
			await timeout(0);
			statuses.push(...providers.getDomNode().querySelectorAll<HTMLElement>('.engine-provider-pill--success, .engine-provider-pill--warning, .engine-provider-enabled-status'));
			assert.strictEqual(providers.getDomNode().querySelectorAll('.engine-provider-enabled-status').length, 2);

			for (const width of [300, 720, 300]) {
				workbench.style.width = `${width}px`;
				for (const status of statuses) {
					const style = getWindow(status).getComputedStyle(status);
					const background = paintedColor(theme.background, style.backgroundColor);
					const contrast = paintedColor(style.color).getContrastRatio(background);
					assert.ok(contrast >= 4.5, `${theme.name} ${status.className}: text contrast ${contrast.toFixed(2)} must reach 4.5:1`);
					const bounds = status.getBoundingClientRect();
					assert.ok(bounds.width > 0 && bounds.height > 0 && status.scrollWidth <= status.clientWidth + 1, `${status.className}: text remains visible at ${width}px`);
					assert.strictEqual(style.opacity, '1');
					if (theme.border && status.matches('.connection-status, .connection-hub-directory-banner, .engine-provider-pill')) {
						assert.deepStrictEqual({ width: style.borderTopWidth, color: paintedColor(style.borderTopColor).toString() }, {
							width: '1px', color: Color.fromHex(theme.border).toString(),
						});
					}
				}
				for (const row of providers.getDomNode().querySelectorAll<HTMLElement>('.engine-provider-status-row')) {
					assert.strictEqual(getWindow(row).getComputedStyle(row).opacity, '1', 'disabled provider status and its available actions keep readable opacity');
				}
			}
			for (const tone of ['success', 'warning']) {
				const status = connection.querySelector<HTMLElement>(`.connection-status.is-${tone}`)!;
				const icon = getWindow(status).getComputedStyle(status, '::before');
				assert.notStrictEqual(icon.content, 'none');
				assert.strictEqual(paintedColor(icon.color).toString(), Color.fromHex(tone === 'success' ? theme.success : theme.warning).toString());
			}
			const dot = providers.getDomNode().querySelector<HTMLElement>('.engine-provider-pill--warning .engine-provider-pill-dot')!;
			assert.strictEqual(paintedColor(getWindow(dot).getComputedStyle(dot).backgroundColor).toString(), Color.fromHex(theme.warning).toString());
		});

		for (const writable of [false, true]) {
			test(`${theme.name}: ${writable ? 'writable' : 'read-only'} provider siblings never overlap as the real pane narrows`, async () => {
				const { workbench, engine, entries, rows, getWrites } = await mountProviderRows(theme, writable);
				const firstPass = new Map<number, number[]>();
				for (const width of [300, 340, 720, 340, 300]) {
					workbench.style.width = `${width}px`;
					const heights: number[] = [];
					for (const [index, row] of rows.entries()) {
						const avatar = row.querySelector<HTMLElement>('.engine-provider-avatar')!;
						const name = row.querySelector<HTMLElement>('.engine-catalog-name')!;
						const description = row.querySelector<HTMLElement>('.engine-catalog-description')!;
						const configured = row.querySelector<HTMLElement>('.engine-provider-pill--success, .engine-provider-pill--warning')!;
						const source = row.querySelector<HTMLElement>('.engine-provider-pill--muted')!;
						const enabled = row.querySelector<HTMLElement>('.engine-provider-enabled-status')!;
						const buttons = [...row.querySelectorAll<HTMLElement>('.engine-catalog-row-actions .monaco-button')];
						const leaves = [avatar, name, description, configured, enabled, source, ...buttons];
						const rowBounds = row.getBoundingClientRect();
						const paneBounds = engine.getBoundingClientRect();
						const contained = (element: HTMLElement) => {
							const bounds = element.getBoundingClientRect();
							return bounds.width > 0 && bounds.height > 0
								&& bounds.left >= rowBounds.left && bounds.right <= rowBounds.right + 1
								&& bounds.top >= rowBounds.top && bounds.bottom <= rowBounds.bottom + 1
								&& bounds.left >= paneBounds.left && bounds.right <= paneBounds.right + 1;
						};
						const collisions: string[] = [];
						for (const [leftIndex, left] of leaves.entries()) {
							const a = left.getBoundingClientRect();
							for (const right of leaves.slice(leftIndex + 1)) {
								const b = right.getBoundingClientRect();
								if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5
									&& Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) {
									collisions.push(`${left.className} / ${right.className}`);
								}
							}
						}
						assert.deepStrictEqual({
							// Pane padding is production CSS: the row is narrower than the advertised pane width.
							paneWidth: paneBounds.width,
							rowInsidePane: rowBounds.width < paneBounds.width,
							rowFits: row.scrollWidth <= row.clientWidth + 1,
							contained: leaves.every(contained),
							nameReadable: name.getBoundingClientRect().width >= 40,
							complete: [configured, source, enabled].every(element => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1),
							collisions,
							actions: buttons.length,
							actionSize: buttons.every(button => button.getBoundingClientRect().width >= 22 && button.getBoundingClientRect().height >= 22),
							configured: configured.textContent,
							enabled: enabled.textContent,
							source: source.textContent,
						}, {
							paneWidth: width, rowInsidePane: true, rowFits: true, contained: true, nameReadable: true, complete: true,
							collisions: [], actions: writable ? 2 : 0, actionSize: true,
							configured: entries[index].configured ? 'Configured' : 'Not configured',
							enabled: entries[index].enabled ? 'Enabled' : 'Disabled',
							source: index === 0 ? 'Provider env' : 'Built-in env',
						}, `${theme.name} pane ${width}px, actual row ${rowBounds.width}px, ${entries[index].providerId}`);
						assert.strictEqual(rowBounds.height, width === 720 ? 24 : Math.round(rowBounds.height / 24) * 24, 'wide rows stay single track; narrow tracks retain 24px density');
						if (index > 0) {
							assert.ok(rows[index - 1].getBoundingClientRect().bottom <= rowBounds.top, 'growing rows reserve vertical space for their siblings');
						}
						heights.push(rowBounds.height);
					}
					if (firstPass.has(width)) {
						assert.deepStrictEqual(heights, firstPass.get(width), 'returning to a width restores its layout');
					} else {
						firstPass.set(width, heights);
					}
				}
				// Longer translated labels must grow beyond the usual English tracks without clipping.
				const row = rows[1];
				const configured = row.querySelector<HTMLElement>('.engine-provider-pill--warning')!;
				const enabled = row.querySelector<HTMLElement>('.engine-provider-enabled-status')!;
				const source = row.querySelector<HTMLElement>('.engine-provider-pill--muted')!;
				configured.lastElementChild!.textContent = 'Credential configuration has not been completed for this provider';
				enabled.textContent = 'Disabled until provider configuration is completed';
				source.textContent = 'Credentials supplied by the configured enterprise environment';
				const statuses = [configured, enabled, source];
				const rowBounds = row.getBoundingClientRect();
				assert.deepStrictEqual({
					grows: rowBounds.height > 72,
					fits: row.scrollWidth <= row.clientWidth + 1,
					complete: statuses.every(element => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1),
					contained: statuses.every(element => {
						const rect = element.getBoundingClientRect();
						return rect.left >= rowBounds.left && rect.right <= rowBounds.right + 1 && rect.bottom <= rowBounds.bottom + 1;
					}),
					separate: statuses.every((element, index) => statuses.slice(index + 1).every(other => {
						const a = element.getBoundingClientRect();
						const b = other.getBoundingClientRect();
						return Math.min(a.right, b.right) - Math.max(a.left, b.left) <= 0.5
							|| Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 0.5;
					})),
				}, { grows: true, fits: true, complete: true, contained: true, separate: true }, 'long status and source copy has no fixed-height ceiling');
				assert.strictEqual(getWrites(), 0, 'reading provider layout never sends a write');
			});
		}

		test(`${theme.name}: provider actions keep focus, hit targets and layout at narrow widths`, async function () {
			getWindow(document.body).focus();
			await timeout(0);
			// The official Electron runner uses show:false; real focus runs in active Chrome.
			if (!document.hasFocus()) {
				this.skip();
			}
			const { workbench, rows, getWrites } = await mountProviderRows(theme, true);
			for (const width of [300, 340, 720, 340, 300]) {
				workbench.style.width = `${width}px`;
				for (const row of rows) {
					const buttons = [...row.querySelectorAll<HTMLElement>('.engine-catalog-row-actions .monaco-button')];
					const leaves = [...row.querySelectorAll<HTMLElement>('.engine-catalog-name, .engine-provider-pill, .engine-provider-enabled-status'), ...buttons];
					const bounds = () => leaves.map(element => {
						const rect = element.getBoundingClientRect();
						const rowRect = row.getBoundingClientRect();
						return [rect.x - rowRect.x, rect.y - rowRect.y, rect.width, rect.height];
					});
					const before = bounds();
					for (const button of buttons) {
						button.scrollIntoView({ block: 'nearest' });
						button.focus({ preventScroll: true });
						const rect = button.getBoundingClientRect();
						const style = getWindow(button).getComputedStyle(button);
						const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
						assert.deepStrictEqual({
							focused: button.matches(':focus'),
							visible: getWindow(button.parentElement!).getComputedStyle(button.parentElement!).opacity,
							focusVisible: button.matches(':focus-visible'),
							outline: style.outlineStyle,
							outlineWidth: style.outlineWidth,
							hit: hit !== null && button.contains(hit),
						}, { focused: true, visible: '1', focusVisible: true, outline: 'solid', outlineWidth: '1px', hit: true });
					}
					assert.deepStrictEqual(bounds(), before, 'revealing action buttons never reflows status or names');
				}
			}
			assert.strictEqual(getWrites(), 0, 'focusing provider actions never sends a write');
		});

		test(`${theme.name}: selected utility rows follow focus and remain distinct from hover`, async () => {
			const workbench = await mountWorkbench(theme);
			const outside = document.createElement('button');
			workbench.appendChild(outside);
			for (const className of ['engine-triggers-row', 'engine-clipboard-row', 'engine-context-variable-row']) {
				const pane = append(workbench, 'engine-preferences-pane');
				const host = append(pane, className.replace('-row', '-list'));
				const selected = append(host, `${className} selected`, 'Selected entry');
				selected.tabIndex = 0;
				const child = document.createElement('span');
				child.textContent = ' · details';
				selected.appendChild(child);
				for (const focus of [false, true, false]) {
					(focus ? selected : outside).focus();
					const style = getWindow(selected).getComputedStyle(selected);
					const expectedBackground = focus ? theme.activeBackground : theme.inactiveBackground;
					const expectedForeground = focus ? theme.activeForeground : theme.inactiveForeground;
					assert.deepStrictEqual({
						background: paintedColor(theme.background, style.backgroundColor).toString(),
						foreground: paintedColor(style.color).toString(),
						childForeground: paintedColor(getWindow(child).getComputedStyle(child).color).toString(),
					}, {
						background: paintedColor(theme.background, expectedBackground).toString(),
						foreground: Color.fromHex(expectedForeground).toString(),
						childForeground: Color.fromHex(expectedForeground).toString(),
					}, `${className} ${focus ? 'active' : 'inactive'}`);
					if (theme.border) {
						assert.notStrictEqual(style.outlineStyle, 'none', 'high contrast selection keeps a visible outline when focus leaves');
					} else {
						assert.notStrictEqual(paintedColor(theme.background, style.backgroundColor).toString(), paintedColor(theme.background, theme.hover).toString(), 'selection differs from the theme hover treatment');
					}
				}
			}
		});

		if (theme.border) {
			test(`${theme.name}: Back, input and action boundaries match the real workbench theme root`, async () => {
				const workbench = await mountWorkbench(theme);
				const connection = append(workbench, 'connection-preferences-pane');
				const field = append(connection, 'connection-field-input');
				const input = store.add(new InputBox(field, undefined, { inputBoxStyles: defaultInputBoxStyles }));
				input.focus();
				assert.strictEqual(paintedColor(getWindow(input.element).getComputedStyle(input.element).borderTopColor).toString(), Color.fromHex(theme.border!).toString());
				const engine = append(workbench, 'engine-preferences-pane');
				const actions = append(engine, 'engine-catalog-icon-actions');
				const action = store.add(new Button(actions, {}));
				action.label = 'Refresh';
				const actionStyle = getWindow(action.element).getComputedStyle(action.element);
				assert.deepStrictEqual({ width: actionStyle.borderTopWidth, color: paintedColor(actionStyle.borderTopColor).toString() }, {
					width: '1px', color: Color.fromHex(theme.border!).toString(),
				});
				for (const [pane, className] of [[connection, 'connection-preferences-back'], [engine, 'engine-preferences-back']] as const) {
					const back = document.createElement('button');
					back.className = className;
					back.textContent = 'Back';
					pane.appendChild(back);
					back.focus();
					assert.strictEqual(workbench.ownerDocument.activeElement, back);
					if (back.matches(':focus-visible')) {
						const style = getWindow(back).getComputedStyle(back);
						assert.deepStrictEqual({ width: style.outlineWidth, color: paintedColor(style.outlineColor).toString() }, {
							width: '1px', color: Color.fromHex(theme.border!).toString(),
						});
					}
				}
			});
		}
	}
});
