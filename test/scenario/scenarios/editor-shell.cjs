/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Editor-window shell scenario.
 *
 * Drives the default Code window (Conversation, Preview, Sources). Does not
 * pass `--agents` and fails if the Agents window workbench is what opened.
 *
 *   node test/scenario/out/runScenario.js test/scenario/scenarios/editor-shell.cjs --dev
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-shell-scenario-'));

function summarize(layout) {
	return JSON.stringify({
		conversation: layout.conversation,
		editor: layout.editor,
		sources: layout.sources,
		panel: layout.panel,
		aux: layout.aux,
		editorTabs: layout.editorTabs,
		sourcesTabs: layout.sourcesTabs,
		quickChatWidget: layout.quickChatWidget
	});
}

function assertEditorWindow(layout) {
	if (layout.agentsWindow) {
		throw new Error('The Agents window opened. Scenarios drive the editor window.');
	}
	if (!layout.hasWorkbench) {
		throw new Error('The editor workbench did not load.');
	}
}

module.exports = {
	id: 'editor-shell',
	title: 'Editor window shell',
	scenarioPath: __filename,
	workspacePath,
	stepPauseMs: 400,
	steps: [
		{
			id: 'editor-window',
			title: 'Opens the editor window',
			async run({ workbench }) {
				const layout = await workbench.editorShell.waitForLayout(candidate => candidate.hasWorkbench && !candidate.agentsWindow);
				assertEditorWindow(layout);
				return 'editor workbench is up; Agents window is absent';
			}
		},
		{
			id: 'fresh-shell',
			title: 'Fresh profile shows Conversation and Sources',
			async run({ workbench }) {
				const layout = await workbench.editorShell.readLayout();
				assertEditorWindow(layout);
				if (!layout.conversation || !layout.sources) {
					throw new Error(`Expected Conversation and Sources visible. ${summarize(layout)}`);
				}
				if (layout.panel || layout.aux) {
					throw new Error(`Expected the bottom panel and the right rail to stay hidden. ${summarize(layout)}`);
				}
				if (layout.quickChatWidget) {
					throw new Error(`Quick Chat is not the editor-window conversation. ${summarize(layout)}`);
				}
				const chatTab = layout.editorTabs.find(label => /chat/i.test(label));
				if (chatTab) {
					throw new Error(`A chat editor tab opened in Preview: ${chatTab}`);
				}
				return summarize(layout);
			}
		},
		{
			id: 'sources-tabs',
			title: 'Sources lists Files, Changes, and Review',
			async run({ workbench }) {
				const layout = await workbench.editorShell.readLayout();
				assertEditorWindow(layout);
				const expected = ['Files', 'Changes', 'Review'];
				if (layout.sourcesTabs.join(',') !== expected.join(',')) {
					throw new Error(`Expected Sources tabs ${expected.join(', ')}. ${summarize(layout)}`);
				}
				return layout.sourcesTabs.join(', ');
			}
		},
		{
			id: 'hide-preview',
			title: 'Hiding Preview does not open the bottom panel',
			async run({ workbench }) {
				const before = await workbench.editorShell.readLayout();
				assertEditorWindow(before);
				if (!before.editor) {
					throw new Error(`Preview was already hidden, so this step cannot check the hide. ${summarize(before)}`);
				}
				if (before.panel || before.aux) {
					throw new Error(`The bottom panel or right rail was already open. ${summarize(before)}`);
				}
				await workbench.editorShell.clickLayoutToggle('Preview');
				const after = await workbench.editorShell.waitForLayout(candidate => !candidate.editor);
				assertEditorWindow(after);
				if (after.panel || after.aux) {
					throw new Error(`Hiding Preview opened the bottom panel or the right rail. ${summarize(after)}`);
				}
				if (before.conversation !== after.conversation || before.sources !== after.sources) {
					throw new Error(`Hiding Preview changed Conversation or Sources. before ${summarize(before)} after ${summarize(after)}`);
				}
				await workbench.editorShell.clickLayoutToggle('Preview');
				await workbench.editorShell.waitForLayout(candidate => candidate.editor);
				return summarize(after);
			}
		},
		{
			id: 'layout-toggles',
			title: 'Titlebar toggles keep Conversation, Preview, or Sources',
			async run({ workbench }) {
				for (const label of ['Navigator', 'Conversation', 'Preview', 'Sources']) {
					const before = await workbench.editorShell.readLayout();
					await workbench.editorShell.clickLayoutToggle(label);
					const layout = await workbench.editorShell.waitForLayout(candidate => !candidate.agentsWindow && candidate.hasWorkbench);
					assertEditorWindow(layout);
					if (!layout.conversation && !layout.editor && !layout.sources) {
						throw new Error(`After ${label}, Conversation, Preview, and Sources were all hidden. ${summarize(layout)}`);
					}
					if (layout.panel !== before.panel || layout.aux !== before.aux) {
						throw new Error(`${label} changed the bottom panel or the right rail. before ${summarize(before)} after ${summarize(layout)}`);
					}
					await workbench.editorShell.clickLayoutToggle(label);
					const restored = await workbench.editorShell.waitForLayout(candidate => candidate.editor === before.editor && candidate.conversation === before.conversation && candidate.sources === before.sources && candidate.sidebar === before.sidebar);
					if (restored.panel || restored.aux) {
						throw new Error(`Restoring ${label} left the bottom panel or the right rail open. ${summarize(restored)}`);
					}
				}
				return 'each titlebar toggle left a product part visible, then restored';
			}
		}
	]
};
