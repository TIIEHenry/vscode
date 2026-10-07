/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from './code';

/**
 * Layout of the default editor window (the product shell).
 *
 * The Agents window is a donor surface. Scenarios must not launch it and must
 * not treat `.agent-sessions-workbench` as the product under test.
 */
export interface IEditorShellLayout {
	readonly agentsWindow: boolean;
	readonly hasWorkbench: boolean;
	readonly sidebar: boolean;
	readonly conversation: boolean;
	readonly editor: boolean;
	readonly sources: boolean;
	readonly panel: boolean;
	readonly aux: boolean;
	readonly editorTabs: readonly string[];
	readonly quickChatWidget: boolean;
	readonly sourcesTabs: readonly string[];
	readonly sourcesActiveTab: string;
	/** Id of the Sources panel that is showing, such as `sources-panel-files`. */
	readonly sourcesVisiblePanel: string;
}

export type EditorShellToggle = 'Navigator' | 'Conversation' | 'Preview' | 'Sources';

const LAYOUT_EXPRESSION = `(() => {
	// Use the workbench part ids. querySelector('.part.editor') hits the
	// conversation leaf's .conversation-editor-part-container first, and that
	// host stays at 0×0 while Preview (#workbench.parts.editor) is on screen.
	const partVisible = (id) => {
		const el = document.getElementById(id);
		if (!el) return false;
		const r = el.getBoundingClientRect();
		return r.width > 0 && r.height > 0;
	};
	const editorRoot = document.getElementById('workbench.parts.editor');
	const sourcesRoot = document.getElementById('workbench.parts.sources');
	const editorTabs = editorRoot
		? [...editorRoot.querySelectorAll('.tabs-container .tab')]
			.map(t => t.getAttribute('aria-label') || (t.textContent || '').trim())
			.filter(Boolean)
		: [];
	const sourcesTabs = sourcesRoot
		? [...sourcesRoot.querySelectorAll('button.sources-tab')]
			.map(t => (t.textContent || '').trim())
			.filter(Boolean)
		: [];
	const sourcesActive = sourcesRoot?.querySelector('button.sources-tab[aria-selected="true"]');
	const sourcesVisiblePanel = sourcesRoot?.querySelector('.sources-tab-panel.visible');
	return {
		agentsWindow: !!document.querySelector('.agent-sessions-workbench'),
		hasWorkbench: !!document.querySelector('.monaco-workbench'),
		sidebar: partVisible('workbench.parts.sidebar'),
		conversation: partVisible('workbench.parts.conversation'),
		editor: partVisible('workbench.parts.editor'),
		sources: partVisible('workbench.parts.sources'),
		panel: partVisible('workbench.parts.panel'),
		aux: partVisible('workbench.parts.auxiliarybar'),
		editorTabs: editorTabs.slice(0, 8),
		quickChatWidget: !!document.querySelector('.quick-input-widget .interactive-session'),
		sourcesTabs,
		sourcesActiveTab: sourcesActive ? (sourcesActive.textContent || '').trim() : '',
		sourcesVisiblePanel: sourcesVisiblePanel?.id || ''
	};
})()`;

export function editorShellKeepsAProductPart(layout: Pick<IEditorShellLayout, 'conversation' | 'editor' | 'sources'>): boolean {
	return layout.conversation || layout.editor || layout.sources;
}

export class EditorShell {

	constructor(private code: Code) { }

	async readLayout(): Promise<IEditorShellLayout> {
		return this.code.driver.evaluateExpression<IEditorShellLayout>(LAYOUT_EXPRESSION);
	}

	/**
	 * Click a titlebar layout toggle in the editor window.
	 * Labels are the product names on the four buttons, not Agents-window chrome.
	 */
	async clickLayoutToggle(label: EditorShellToggle): Promise<void> {
		const clicked = await this.code.driver.evaluateExpression<{ clicked: boolean }>(`(() => {
			const buttons = [...document.querySelectorAll('.part.titlebar .monaco-toolbar button[aria-label], .part.titlebar .monaco-toolbar a.action-label[aria-label]')];
			const match = buttons.find(b => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(label)}));
			if (!match) return { clicked: false };
			match.click();
			return { clicked: true };
		})()`);
		if (!clicked.clicked) {
			throw new Error(`Editor window layout toggle '${label}' was not found in the titlebar.`);
		}
	}

	/**
	 * Click a Sources tab by its visible label (Files, Changes, Review).
	 */
	async clickSourcesTab(label: string): Promise<void> {
		const clicked = await this.code.driver.evaluateExpression<{ clicked: boolean }>(`(() => {
			const root = document.getElementById('workbench.parts.sources');
			const match = root && [...root.querySelectorAll('button.sources-tab')].find(b => (b.textContent || '').trim() === ${JSON.stringify(label)});
			if (!match) return { clicked: false };
			match.click();
			return { clicked: true };
		})()`);
		if (!clicked.clicked) {
			throw new Error(`Sources tab '${label}' was not found.`);
		}
	}

	/**
	 * Invoke a command id through the window driver. Menu when-clauses are not
	 * consulted; the handler runs.
	 */
	async runCommand(id: string): Promise<void> {
		await this.code.driver.evaluateExpression(`(async () => {
			const driver = globalThis.driver;
			if (!driver || typeof driver.executeCommand !== 'function') {
				throw new Error('Window driver has no executeCommand.');
			}
			await driver.executeCommand(${JSON.stringify(id)});
		})()`);
	}

	/** Watch every page created while a scenario exercises editor-window commands. */
	watchNewWindows(): { readonly opened: boolean; dispose(): void } {
		const driver = this.code.driver;
		const existing = new Set(driver.getAllWindows());
		let opened = false;
		const onPage = () => { opened = true; };
		driver.browserContext.on('page', onPage);
		return {
			get opened() { return opened || driver.getAllWindows().some(page => !existing.has(page)); },
			dispose: () => driver.browserContext.off('page', onPage)
		};
	}

	async waitForLayout(accept: (layout: IEditorShellLayout) => boolean, timeoutMs: number = 8000): Promise<IEditorShellLayout> {
		const deadline = Date.now() + timeoutMs;
		let last: IEditorShellLayout | undefined;
		while (Date.now() < deadline) {
			last = await this.readLayout();
			if (accept(last)) {
				return last;
			}
			await new Promise(resolve => setTimeout(resolve, 200));
		}
		throw new Error(`Editor shell layout did not match in time. Last: ${JSON.stringify(last)}`);
	}
}
