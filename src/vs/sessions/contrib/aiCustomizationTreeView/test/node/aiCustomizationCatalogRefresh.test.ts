/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { registerAiCustomizationCatalogRefresh } from '../../common/aiCustomizationCatalogRefresh.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));

function readSource(relFromThisDir: string): string {
	const full = path.join(thisDir, relFromThisDir);
	assert.ok(fs.existsSync(full), `${full} not found`);
	return fs.readFileSync(full, 'utf8');
}

suite('AI customization catalog refresh', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function listen(options?: { readonly hooks?: boolean }): { fire: Record<'agents' | 'slash' | 'instructions' | 'agentInstructions' | 'hooks', () => void>; refreshCount: () => number } {
		const owned = disposables.add(new DisposableStore());
		const agents = owned.add(new Emitter<void>());
		const slash = owned.add(new Emitter<void>());
		const instructions = owned.add(new Emitter<void>());
		const agentInstructions = owned.add(new Emitter<void>());
		const hooks = owned.add(new Emitter<void>());
		let count = 0;
		registerAiCustomizationCatalogRefresh({
			onDidChangeCustomAgents: agents.event,
			onDidChangeSlashCommands: slash.event,
			onDidChangeInstructions: instructions.event,
			onDidChangeAgentInstructions: agentInstructions.event,
			onDidChangeHooks: hooks.event,
		}, disposable => owned.add(disposable), () => { count++; }, options);
		return {
			fire: {
				agents: () => agents.fire(),
				slash: () => slash.fire(),
				instructions: () => instructions.fire(),
				agentInstructions: () => agentInstructions.fire(),
				hooks: () => hooks.fire(),
			},
			refreshCount: () => count,
		};
	}

	test('instruction and agent-instruction changes refresh; subscribing does not', () => {
		const tree = listen();
		assert.strictEqual(tree.refreshCount(), 0);

		tree.fire.instructions();
		assert.strictEqual(tree.refreshCount(), 1);

		tree.fire.agentInstructions();
		assert.strictEqual(tree.refreshCount(), 2);

		tree.fire.agents();
		tree.fire.slash();
		assert.strictEqual(tree.refreshCount(), 4);

		// The file tree does not list hooks, so that event must not reload it.
		tree.fire.hooks();
		assert.strictEqual(tree.refreshCount(), 4);
	});

	test('overview also refreshes when hooks change', () => {
		const overview = listen({ hooks: true });
		overview.fire.hooks();
		assert.strictEqual(overview.refreshCount(), 1);
		overview.fire.instructions();
		overview.fire.agentInstructions();
		assert.strictEqual(overview.refreshCount(), 3);
	});

	test('disposed registration ignores later catalog changes', () => {
		const owned = disposables.add(new DisposableStore());
		const instructions = owned.add(new Emitter<void>());
		let count = 0;
		const registration = disposables.add(new DisposableStore());
		registerAiCustomizationCatalogRefresh({
			onDidChangeCustomAgents: Event.None,
			onDidChangeSlashCommands: Event.None,
			onDidChangeInstructions: instructions.event,
			onDidChangeAgentInstructions: Event.None,
			onDidChangeHooks: Event.None,
		}, disposable => registration.add(disposable), () => { count++; });
		registration.dispose();
		instructions.fire();
		assert.strictEqual(count, 0);
	});

	test('tree and overview both subscribe, and only the overview includes hooks', () => {
		const overview = readSource('../../browser/aiCustomizationOverviewView.ts');
		const tree = readSource('../../browser/aiCustomizationTreeViewViews.ts');
		const call = 'registerAiCustomizationCatalogRefresh(this.promptsService, disposable => this._register(disposable), () => this.reloadCounts(), { hooks: true });';
		assert.ok(overview.includes(call));
		assert.ok(tree.includes('registerAiCustomizationCatalogRefresh(this.promptsService, disposable => this._register(disposable), () => this.refresh());'));
		assert.ok(!tree.includes('hooks: true'));
		assert.ok(overview.includes('this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => this.reloadCounts()));'));
		assert.ok(tree.includes('this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => this.refresh()));'));
	});
});
