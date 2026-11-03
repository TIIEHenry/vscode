/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ITreeNode } from '../../../../../base/browser/ui/tree/tree.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { INavigatorAgentsHierarchyNode } from '../../common/navigatorAgentHierarchy.js';
import { AgentsHierarchyRenderer, IAgentsHierarchyTemplateData } from '../../browser/navigatorAgentsView.js';
import { ProjectNodeRenderer, IProjectNodeTemplateData } from '../../browser/navigatorProjectsList.js';
import { INavigatorProjectsTreeNode } from '../../browser/navigatorProjectsTree.js';

suite('NavigatorAgentsView template lifecycle', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function wrapTreeNode<T>(element: T): ITreeNode<T, void> {
		return {
			element,
			children: [],
			depth: 1,
			visibleChildrenCount: 0,
			visibleChildIndex: 0,
			visible: true,
			collapsed: false,
			collapsible: false,
			filterData: undefined,
		};
	}

	function createFakeHierarchyNode(id: string, label: string): INavigatorAgentsHierarchyNode {
		return {
			id,
			agentId: id,
			sessionId: 'sess-1',
			label,
			type: 'AGENT_TYPE_ROOT',
			status: 'IDLE',
			model: 'model',
			turnCount: 0,
			source: { agentId: id, name: label, type: 'AGENT_TYPE_ROOT', status: 'IDLE', model: 'model', turnCount: 0, createdAt: 0, children: [] },
			children: [],
		};
	}

	test('AgentsHierarchyRenderer attaches stop-propagation DOM listeners and disposes cleanly', () => {
		let inspected = false;
		let revealed = false;
		const renderer = new AgentsHierarchyRenderer(
			() => { inspected = true; },
			() => { revealed = true; },
			() => true,
		);

		const container = document.createElement('div');
		let parentReceivedClick = false;
		container.addEventListener('click', () => { parentReceivedClick = true; });

		const templateData: IAgentsHierarchyTemplateData = renderer.renderTemplate(container);
		assert.ok(templateData.disposables, 'Template must provide a disposables store');
		assert.strictEqual(templateData.disposables.isDisposed, false);

		// Find the actions container
		const actionsContainer = container.querySelector('.navigator-agents-row-actions') as HTMLElement;
		assert.ok(actionsContainer, 'actionsContainer must exist');

		// Dispatch click to actionsContainer: stopPropagation listener must stop it reaching parent
		const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
		actionsContainer.dispatchEvent(clickEvent);
		assert.strictEqual(parentReceivedClick, false, 'Action container click must stop propagation');

		// Render an element into the template
		const node = createFakeHierarchyNode('a1', 'Agent One');
		renderer.renderElement(wrapTreeNode(node), 0, templateData);
		assert.strictEqual(templateData.label.textContent, 'Agent One');
		templateData.inspectAction.run();
		assert.strictEqual(inspected, true);
		templateData.revealAction.run();
		assert.strictEqual(revealed, true);

		// Dispose the template
		renderer.disposeTemplate(templateData);
		assert.strictEqual(templateData.disposables.isDisposed, true, 'templateData.disposables must be disposed in disposeTemplate');
	});

	test('AgentsHierarchyRenderer supports template recycling across elements', () => {
		const renderer = new AgentsHierarchyRenderer(
			() => { },
			() => { },
			() => true,
		);

		const container1 = document.createElement('div');
		const template1 = renderer.renderTemplate(container1);

		const node1 = createFakeHierarchyNode('a1', 'Agent One');
		renderer.renderElement(wrapTreeNode(node1), 0, template1);
		assert.strictEqual(template1.label.textContent, 'Agent One');

		// Recycled element render
		const node2 = createFakeHierarchyNode('a2', 'Agent Two');
		renderer.renderElement(wrapTreeNode(node2), 1, template1);
		assert.strictEqual(template1.label.textContent, 'Agent Two');

		// Dispose first template
		renderer.disposeTemplate(template1);
		assert.strictEqual(template1.disposables.isDisposed, true);

		// Allocate second template
		const container2 = document.createElement('div');
		const template2 = renderer.renderTemplate(container2);
		assert.notStrictEqual(template1, template2);
		assert.strictEqual(template2.disposables.isDisposed, false);

		renderer.renderElement(wrapTreeNode(node1), 0, template2);
		assert.strictEqual(template2.label.textContent, 'Agent One');

		renderer.disposeTemplate(template2);
		assert.strictEqual(template2.disposables.isDisposed, true);
	});

	test('ProjectNodeRenderer tracks and disposes action container listeners', () => {
		const renderer = new ProjectNodeRenderer(
			() => true,
			() => { },
			() => { },
			() => false,
			() => false,
			() => '',
			() => { },
		);

		const container = document.createElement('div');
		let parentReceivedClick = false;
		container.addEventListener('click', () => { parentReceivedClick = true; });

		const templateData: IProjectNodeTemplateData = renderer.renderTemplate(container);
		assert.ok(templateData.disposables, 'Project template must provide a disposables store');
		assert.strictEqual(templateData.disposables.isDisposed, false);

		const actionsContainer = container.querySelector('.navigator-projects-row-actions') as HTMLElement;
		assert.ok(actionsContainer, 'actionsContainer must exist');

		const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
		actionsContainer.dispatchEvent(clickEvent);
		assert.strictEqual(parentReceivedClick, false, 'Project action container click must stop propagation');

		const projectNode: INavigatorProjectsTreeNode = {
			id: 'sess-1',
			kind: 'session',
			label: 'Session 1',
			sessionId: 'sess-1',
		};
		renderer.renderElement(wrapTreeNode(projectNode), 0, templateData);
		assert.strictEqual(templateData.name.textContent, 'Session 1');

		renderer.disposeTemplate(templateData);
		assert.strictEqual(templateData.disposables.isDisposed, true, 'templateData.disposables must be disposed');
	});
});
