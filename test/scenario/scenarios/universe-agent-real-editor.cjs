/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Opt-in real Kotlin-engine acceptance for the default editor window.
 *
 * Preconditions:
 *   - a production UniverseAgent CLI is running with the same
 *     UNIVERSE_AGENT_HOME as this Electron process;
 *   - the CLI has a local model profile whose provider is reachable; and
 *   - the editor has been built (`--dev` uses .build/electron).
 *
 * This scenario deliberately fails when the engine is absent. The scripted
 * Chromium scenarios remain the deterministic UI rail; this file is the
 * production main -> SessionViewHost -> renderer rail.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'universe-agent-real-editor-'));
const marker = 'UA_REAL_EDITOR_MARKER_7F3D';
fs.writeFileSync(path.join(workspacePath, 'marker.txt'), `${marker}\n`, { mode: 0o600 });

async function waitFor(locator, description, timeout = 30_000) {
	try {
		await locator.waitFor({ state: 'visible', timeout });
	} catch (error) {
		throw new Error(`${description} was not visible within ${timeout}ms: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function readRows(page) {
	return page.locator('article.conversation-timeline-item').evaluateAll(articles => articles.map(article => ({
		rootId: article.getAttribute('data-root-id'),
		kind: article.getAttribute('data-kind'),
		text: article.textContent || '',
		busy: article.getAttribute('aria-busy') === 'true'
	})));
}

function assertUnique(rows, label) {
	const ids = rows.map(row => row.rootId).filter(Boolean);
	if (new Set(ids).size !== ids.length) {
		throw new Error(`${label} contains duplicate timeline root ids: ${ids.join(', ')}`);
	}
}

module.exports = {
	id: 'universe-agent-real-editor',
	title: 'Real Kotlin engine through the default editor',
	source: 'https://github.com/TIIEHenry/UniverseAgent/blob/main/dev/decisions/482-real-editor-cli-test-boundary.md',
	scenarioPath: __filename,
	workspacePath,
	stepPauseMs: 500,
	userSettings: {
		'universeAgent.connection.autoConnect': true,
		'universeAgent.conversation.autoOpen': true
	},
	steps: [
		{
			id: 'production-loopback',
			title: 'Uses the production loopback engine',
			async run({ page, workbench }) {
				await workbench.editorShell.waitForLayout(candidate => candidate.hasWorkbench && !candidate.agentsWindow);
				const engine = page.locator('[aria-label="Engine connection: Engine · Loopback"]');
				await waitFor(engine, 'Engine · Loopback status');
				return 'default editor is connected through production local-engine discovery';
			}
		},
		{
			id: 'submit-real-input',
			title: 'Submits input through the real SessionViewHost',
			async run({ page }) {
				const composer = page.locator('[data-testid="conversation-composer-input"]');
				const send = page.locator('[data-testid="conversation-composer-send"]');
				await waitFor(composer, 'Conversation composer');
				await waitFor(send, 'Conversation send button');
				await composer.fill(`Read marker.txt and include the exact text ${marker} in your final response.`);
				await send.click();
				return 'prompt submitted through the renderer IPC boundary';
			}
		},
		{
			id: 'tool-and-assistant',
			title: 'Renders one real tool row and one assistant row',
			async run({ page }) {
				const tool = page.locator('article.conversation-timeline-item[data-kind="tool"]');
				const assistant = page.locator('article.conversation-timeline-item[data-kind="assistant"]');
				await waitFor(tool, 'real tool timeline row', 60_000);
				await waitFor(assistant, 'real assistant timeline row', 60_000);
				await page.waitForFunction(() => {
					const rows = [...document.querySelectorAll('article.conversation-timeline-item[data-kind="assistant"]')];
					return rows.some(row => (row.textContent || '').includes('UA_REAL_EDITOR_MARKER_7F3D') && row.getAttribute('aria-busy') !== 'true');
				}, undefined, { timeout: 60_000 });
				const rows = await readRows(page);
				assertUnique(rows, 'live timeline');
				if (rows.filter(row => row.kind === 'tool').length !== 1) {
					throw new Error(`Expected exactly one tool root, got ${JSON.stringify(rows)}`);
				}
				if (rows.filter(row => row.kind === 'assistant' && row.text.includes(marker)).length !== 1) {
					throw new Error(`Expected exactly one completed assistant containing ${marker}, got ${JSON.stringify(rows)}`);
				}
				return JSON.stringify(rows.map(({ rootId, kind, busy }) => ({ rootId, kind, busy })));
			}
		},
		{
			id: 'reload-history',
			title: 'Reload keeps the same durable tool and assistant rows',
			async run({ page }) {
				const before = await readRows(page);
				assertUnique(before, 'pre-reload timeline');
				await page.reload({ waitUntil: 'domcontentloaded' });
				await waitFor(page.locator('[aria-label="Engine connection: Engine · Loopback"]'), 'reconnected loopback status', 60_000);
				await waitFor(page.locator('article.conversation-timeline-item[data-kind="tool"]'), 'reloaded tool timeline row', 60_000);
				await waitFor(page.locator('article.conversation-timeline-item[data-kind="assistant"]'), 'reloaded assistant timeline row', 60_000);
				const after = await readRows(page);
				assertUnique(after, 'post-reload timeline');
				const beforeIds = before.map(row => row.rootId).filter(Boolean);
				const afterIds = after.map(row => row.rootId).filter(Boolean);
				if (beforeIds.length !== afterIds.length || beforeIds.some(id => !afterIds.includes(id))) {
					throw new Error(`Reload changed durable timeline identities. before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
				}
				if (!after.some(row => row.kind === 'assistant' && row.text.includes(marker) && !row.busy)) {
					throw new Error(`Reload lost the completed assistant marker ${marker}: ${JSON.stringify(after)}`);
				}
				return `reloaded ${after.length} unique durable timeline roots`;
			}
		}
	]
};
