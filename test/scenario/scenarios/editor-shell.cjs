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
		quickChatWidget: layout.quickChatWidget,
		sourcesActiveTab: layout.sourcesActiveTab,
		sourcesVisiblePanel: layout.sourcesVisiblePanel
	});
}

function assertQuietEditor(layout, label) {
	assertEditorWindow(layout);
	if (layout.panel || layout.aux) {
		throw new Error(`${label} opened the bottom panel or the right rail. ${summarize(layout)}`);
	}
	if (layout.quickChatWidget) {
		throw new Error(`${label} opened Quick Chat. ${summarize(layout)}`);
	}
	const chatTab = layout.editorTabs.find(tab => /chat/i.test(tab));
	if (chatTab) {
		throw new Error(`${label} opened a chat editor tab: ${chatTab}`);
	}
}

/**
 * Handlers that return immediately in the default Code window. executeCommand
 * skips menu when-clauses, so this list is the real window check.
 */
const EDITOR_WINDOW_CHAT_COMMANDS = [
	'workbench.action.chat.open',
	'workbench.action.chat.openask',
	'workbench.action.chat.openedit',
	'workbench.action.chat.openagent',
	'workbench.action.openChat',
	'workbench.action.openChat.copilotIcon',
	'workbench.action.openChat.newSessionIcon',
	'workbench.action.openChat.commentIcon',
	'workbench.action.openChatToSide',
	'workbench.action.newChatWindow',
	'workbench.action.chat.toggle',
	'workbench.action.chat.openInEditor',
	'workbench.action.chat.setAgentSessionsOrientationStacked',
	'workbench.action.chat.setAgentSessionsOrientationSideBySide',
	'workbench.action.chat.openSessionInEditorGroup',
	'workbench.action.chat.openSessionInNewEditorGroup',
	'workbench.action.chat.openSessionInNewWindow',
	'workbench.action.chat.focusAgentSessionsViewer',
	'agentSessions.showAgentSessionsSidebar',
	'agentSessions.hideAgentSessionsSidebar',
	'agentSessions.toggleAgentSessionsSidebar',
	'workbench.action.chat.run.prompt',
	'workbench.action.chat.run.prompt.current',
	'workbench.action.chat.run-in-new-chat.prompt.current',
	'aiCustomizationManagement.runPrompt'
];

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
				const partByToggle = { Navigator: 'sidebar', Conversation: 'conversation', Preview: 'editor', Sources: 'sources' };
				for (const label of ['Navigator', 'Conversation', 'Preview', 'Sources']) {
					const before = await workbench.editorShell.readLayout();
					const part = partByToggle[label];
					await workbench.editorShell.clickLayoutToggle(label);
					const layout = await workbench.editorShell.waitForLayout(candidate => candidate[part] !== before[part]);
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
		},
		{
			id: 'sources-tab-changes',
			title: 'Sources stops on Changes inside the editor shell',
			async run({ workbench, code }) {
				const panels = {
					Files: 'sources-panel-files',
					Changes: 'sources-panel-changes'
				};
				await workbench.editorShell.clickSourcesTab('Files');
				const files = await workbench.editorShell.waitForLayout(candidate => candidate.sourcesActiveTab === 'Files' && candidate.sourcesVisiblePanel === panels.Files);
				assertQuietEditor(files, 'Files');
				if (!files.conversation || !files.sources) {
					throw new Error(`Files hid Conversation or Sources. ${summarize(files)}`);
				}
				await workbench.editorShell.clickSourcesTab('Changes');
				const changes = await workbench.editorShell.waitForLayout(candidate => candidate.sourcesActiveTab === 'Changes' && candidate.sourcesVisiblePanel === panels.Changes);
				assertQuietEditor(changes, 'Changes');
				if (!changes.conversation || !changes.sources) {
					throw new Error(`Changes hid Conversation or Sources. ${summarize(changes)}`);
				}
				// Screenshots are taken when run() returns. click() does not match
				// :focus-visible, so leave Changes focused with a visible ring.
				await code.driver.evaluateExpression(`(async () => {
					const root = document.getElementById('workbench.parts.sources');
					const button = root && [...root.querySelectorAll('button.sources-tab')].find(b => (b.textContent || '').trim() === ${JSON.stringify('Changes')});
					if (!button) {
						throw new Error('Sources tab Changes was not found.');
					}
					button.focus({ focusVisible: true });
					await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
					if (document.activeElement !== button) {
						throw new Error('Changes tab is not the active element.');
					}
				})()`);
				return 'Changes';
			}
		},
		{
			id: 'sources-tab-review',
			title: 'Sources Review tab stays inside the editor shell',
			async run({ workbench }) {
				await workbench.editorShell.clickSourcesTab('Review');
				const review = await workbench.editorShell.waitForLayout(candidate => candidate.sourcesActiveTab === 'Review' && candidate.sourcesVisiblePanel === 'sources-panel-review');
				assertQuietEditor(review, 'Review');
				if (!review.conversation || !review.sources) {
					throw new Error(`Review hid Conversation or Sources. ${summarize(review)}`);
				}
				return 'Review';
			}
		},
		{
			id: 'panel-maximize-restore',
			title: 'Maximizing the hidden bottom panel restores the same shell',
			async run({ workbench }) {
				const before = await workbench.editorShell.readLayout();
				assertQuietEditor(before, 'before panel maximize');
				await workbench.editorShell.runCommand('workbench.action.toggleMaximizedPanel');
				const maximized = await workbench.editorShell.waitForLayout(candidate => candidate.panel && !candidate.editor && !candidate.sources && !candidate.agentsWindow);
				assertEditorWindow(maximized);
				if (maximized.quickChatWidget) {
					throw new Error(`Maximized panel opened Quick Chat. ${summarize(maximized)}`);
				}
				await workbench.editorShell.runCommand('workbench.action.toggleMaximizedPanel');
				const after = await workbench.editorShell.waitForLayout(candidate =>
					candidate.panel === before.panel
					&& candidate.editor === before.editor
					&& candidate.sources === before.sources
					&& candidate.conversation === before.conversation
					&& !candidate.agentsWindow
				);
				assertQuietEditor(after, 'panel maximize');
				return `maximized ${summarize(maximized)} restored ${summarize(after)}`;
			}
		},
		{
			id: 'chat-commands',
			title: 'Chat and Copilot commands stay in the editor window',
			async run({ workbench }) {
				const before = await workbench.editorShell.readLayout();
				assertQuietEditor(before, 'before chat commands');
				const windows = workbench.editorShell.watchNewWindows();
				try {
					for (const id of EDITOR_WINDOW_CHAT_COMMANDS) {
						try {
							await workbench.editorShell.runCommand(id);
						} catch (error) {
							const message = error instanceof Error ? error.message : String(error);
							throw new Error(`${id} failed: ${message}`);
						}
						const layout = await workbench.editorShell.readLayout();
						assertQuietEditor(layout, id);
						if (windows.opened) {
							throw new Error(`${id} opened another window.`);
						}
						if (layout.conversation !== before.conversation || layout.editor !== before.editor || layout.sources !== before.sources) {
							throw new Error(`${id} changed the product shell. before ${summarize(before)} after ${summarize(layout)}`);
						}
					}
					await new Promise(resolve => setTimeout(resolve, 500));
					if (windows.opened) {
						throw new Error('A chat command opened another window after its handler returned.');
					}
				} finally {
					windows.dispose();
				}
				return `${EDITOR_WINDOW_CHAT_COMMANDS.length} commands stayed in the editor window`;
			}
		},
		{
			id: 'open-untitled',
			title: 'A new untitled file stays in Preview',
			async run({ workbench }) {
				const before = await workbench.editorShell.readLayout();
				assertQuietEditor(before, 'before untitled');
				await workbench.editorShell.runCommand('workbench.action.files.newUntitledFile');
				const opened = await workbench.editorShell.waitForLayout(candidate => candidate.editor && candidate.editorTabs.some(tab => /untitled/i.test(tab)) && !candidate.panel && !candidate.agentsWindow);
				assertEditorWindow(opened);
				if (opened.quickChatWidget) {
					throw new Error(`New untitled file opened Quick Chat. ${summarize(opened)}`);
				}
				const chatTab = opened.editorTabs.find(tab => /chat/i.test(tab));
				if (chatTab) {
					throw new Error(`New untitled file opened a chat editor tab: ${chatTab}`);
				}
				if (!opened.conversation || !opened.sources) {
					throw new Error(`New untitled file hid Conversation or Sources. ${summarize(opened)}`);
				}
				await workbench.editorShell.runCommand('workbench.action.revertAndCloseActiveEditor');
				const closed = await workbench.editorShell.waitForLayout(candidate => !candidate.editorTabs.some(tab => /untitled/i.test(tab)) && candidate.editor === before.editor && candidate.panel === before.panel && candidate.conversation === before.conversation && candidate.sources === before.sources && !candidate.agentsWindow);
				assertQuietEditor(closed, 'after untitled');
				return opened.editorTabs.filter(tab => /untitled/i.test(tab)).join(', ');
			}
		}
	]
};
