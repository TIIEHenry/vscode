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

// The old four-step contract remains the default. Matrix semantics must always
// be selected explicitly and provide an independently generated private oracle.
const selectedScene = process.env.UA_REAL_EDITOR_SCENE || 'legacy';
if (selectedScene !== 'legacy' && selectedScene !== 'matrix') {
	throw new Error(`Unsupported UA_REAL_EDITOR_SCENE: ${selectedScene}`);
}

const configuredWorkspace = process.env.UA_REAL_EDITOR_WORKDIR;
const workspacePath = configuredWorkspace
	? path.resolve(configuredWorkspace)
	: fs.mkdtempSync(path.join(os.tmpdir(), 'universe-agent-real-editor-'));
fs.mkdirSync(workspacePath, { recursive: true });
const marker = 'UA_REAL_EDITOR_MARKER_7F3D';
if (selectedScene === 'legacy') {
	fs.writeFileSync(path.join(workspacePath, 'marker.txt'), `${marker}\n`, { mode: 0o600 });
}

async function waitFor(locator, description, timeout = 30_000) {
	try {
		await locator.waitFor({ state: 'visible', timeout });
	} catch (error) {
		throw new Error(`Could not observe ${description}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function openProcessFolds(page, description) {
	const folds = page.locator('article.conversation-timeline-item .conversation-process-fold');
	await waitFor(folds.first(), description);
	for (let index = 0; index < await folds.count(); index++) {
		const header = folds.nth(index).locator('.conversation-process-fold-header');
		await waitFor(header, `${description} header ${index + 1}`);
		if (await header.getAttribute('aria-expanded') !== 'true') {
			await header.click();
		}
	}
}

// Runs in the browser for both reads and completion waits. A marker wait must
// reject a second matching preview as well as a busy or identity-less answer.
function readTimelineRows(requiredCompletedMarker) {
	const rows = [...document.querySelectorAll('article.conversation-timeline-item .conversation-lens-turn[data-kind]')].map(turn => {
		const article = turn.closest('article.conversation-timeline-item');
		const rootId = article?.getAttribute('data-root-id');
		const turnId = turn.getAttribute('data-turn-id');
		const busy = article?.getAttribute('aria-busy') === 'true';
		const persistent = !!article && typeof rootId === 'string' && rootId.trim().length > 0 && !rootId.startsWith('overlay:')
			&& typeof turnId === 'string' && turnId.trim().length > 0 && !turnId.startsWith('overlay:');
		return {
			rootId,
			turnId,
			kind: turn.getAttribute('data-kind'),
			text: turn.textContent || '',
			busy,
			completed: persistent && !busy
		};
	});
	if (requiredCompletedMarker !== undefined) {
		const matches = rows.filter(row => row.kind === 'assistant' && row.text.includes(requiredCompletedMarker));
		if (matches.length !== 1 || !matches[0].completed) {
			return false;
		}
	}
	return rows;
}

async function readRows(page) {
	return page.evaluate(readTimelineRows);
}

async function waitForCompletedAssistant(page) {
	await page.waitForFunction(readTimelineRows, marker, { timeout: 60_000 });
}

async function assertNoTimelineFailures(page, reloaded = false) {
	const errors = page.locator('article.conversation-timeline-item .conversation-lens-turn[data-kind="error"]');
	if (await errors.count() !== 0) {
		throw new Error(reloaded ? 'Reload restored an error row for the completed real turn.' : `Real engine returned an error row: ${await errors.allTextContents()}`);
	}
	const tools = page.locator('article.conversation-timeline-item .conversation-process-fold-tool');
	for (let index = 0; index < await tools.count(); index++) {
		const text = await tools.nth(index).textContent() || '';
		if (text.includes('Failed')) {
			throw new Error(`${reloaded ? 'Reloaded' : 'Real'} tool row is failed: ${text}`);
		}
	}
}

function assertUnique(rows, label) {
	const ids = rows.map(row => row.rootId).filter(Boolean);
	if (new Set(ids).size !== ids.length) {
		throw new Error(`${label} contains duplicate timeline root ids: ${ids.join(', ')}`);
	}
}

module.exports = selectedScene === 'matrix'
	? require('./universe-agent-real-editor-oracle.cjs').createMatrixScenario()
	: {
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
				const engine = page.getByRole('status', { name: 'Engine connection: Engine · Loopback' });
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
			title: 'Renders one real tool result and one unique completed answer',
			async run({ page }) {
				await openProcessFolds(page, 'real process fold');
				const tool = page.locator('article.conversation-timeline-item .conversation-process-fold-tool');
				const assistant = page.locator('article.conversation-timeline-item .conversation-lens-turn[data-kind="assistant"]');
				await waitFor(tool.first(), 'real tool timeline row', 60_000);
				await openProcessFolds(page, 'real process fold after tool');
				await waitFor(assistant.first(), 'real assistant timeline row', 60_000);
				await assertNoTimelineFailures(page);
				await waitForCompletedAssistant(page);
				await assertNoTimelineFailures(page);
				const rows = await readRows(page);
				assertUnique(rows, 'live timeline');
				if (await tool.count() === 0) {
					throw new Error(`Expected at least one nested tool row, got ${await tool.count()} roots=${JSON.stringify(rows)}`);
				}
				const answers = rows.filter(row => row.kind === 'assistant' && row.text.includes(marker));
				if (answers.length !== 1 || !answers[0].completed) {
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
				await waitFor(page.getByRole('status', { name: 'Engine connection: Engine · Loopback' }), 'reconnected loopback status', 60_000);
				await openProcessFolds(page, 'reloaded real process fold');
				await waitFor(page.locator('article.conversation-timeline-item .conversation-process-fold-tool').first(), 'reloaded tool timeline row', 60_000);
				await openProcessFolds(page, 'reloaded real process fold after tool');
				await waitFor(page.locator('article.conversation-timeline-item .conversation-lens-turn[data-kind="assistant"]').first(), 'reloaded assistant timeline row', 60_000);
				await assertNoTimelineFailures(page, true);
				await waitForCompletedAssistant(page);
				await assertNoTimelineFailures(page, true);
				const after = await readRows(page);
				assertUnique(after, 'post-reload timeline');
				const beforeIds = before.map(row => row.rootId).filter(Boolean);
				const afterIds = after.map(row => row.rootId).filter(Boolean);
				if (beforeIds.length !== afterIds.length || beforeIds.some(id => !afterIds.includes(id))) {
					throw new Error(`Reload changed durable timeline identities. before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
				}
				const answers = after.filter(row => row.kind === 'assistant' && row.text.includes(marker));
				if (answers.length !== 1 || !answers[0].completed) {
					throw new Error(`Reload lost the completed assistant marker ${marker}: ${JSON.stringify(after)}`);
				}
				return `reloaded ${after.length} unique durable timeline roots`;
			}
		}
	]
};
