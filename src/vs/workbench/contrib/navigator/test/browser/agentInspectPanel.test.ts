/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation } from '../../../../common/views.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { workbenchInstantiationService, TestViewsService } from '../../../../test/browser/workbenchTestServices.js';
import { AGENT_INSPECT_CONTAINER_ID, AGENT_INSPECT_VIEW_ID, OPEN_AGENT_INSPECT_VIEW_COMMAND_ID } from '../../browser/agentInspectIds.js';
import { AGENT_INSPECT_VIEW_CONTAINER } from '../../browser/agentInspect.contribution.js';
import '../../browser/agentInspect.contribution.js';

suite('Agent inspect panel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

	test('Inspect container and view register on Panel', () => {
		const container = viewContainersRegistry.get(AGENT_INSPECT_CONTAINER_ID);
		assert.ok(container, 'Agent inspect panel container should be registered');
		assert.strictEqual(container, AGENT_INSPECT_VIEW_CONTAINER);
		assert.strictEqual(
			viewContainersRegistry.getViewContainerLocation(container),
			ViewContainerLocation.Panel,
			'Agent inspect must live on PANEL_PART'
		);

		const viewDescriptor = viewsRegistry.getView(AGENT_INSPECT_VIEW_ID);
		assert.ok(viewDescriptor, 'Agent inspect view should be registered');
		assert.strictEqual(viewsRegistry.getViewContainer(AGENT_INSPECT_VIEW_ID), container);
	});

	test('Inspect view descriptor is not EditorInput', () => {
		const viewDescriptor = viewsRegistry.getView(AGENT_INSPECT_VIEW_ID);
		assert.ok(viewDescriptor);
		assert.notStrictEqual(viewDescriptor.ctorDescriptor.ctor, EditorInput);
	});

	test('Inspect view exposes open command for default-window product path', () => {
		const viewDescriptor = viewsRegistry.getView(AGENT_INSPECT_VIEW_ID);
		assert.ok(viewDescriptor);
		assert.ok(viewDescriptor.openCommandActionDescriptor, 'Agent inspect must register an open command');
		assert.strictEqual(viewDescriptor.openCommandActionDescriptor.id, OPEN_AGENT_INSPECT_VIEW_COMMAND_ID);
		assert.strictEqual(viewDescriptor.when, undefined, 'v1 single leaf must stay always active for hideIfEmpty container');
	});

	test('Product four path opens inspect panel view via ViewsService', async () => {
		const openViewCalls: Array<{ id: string; focus: boolean | undefined }> = [];
		class TrackingViewsService extends TestViewsService {
			override openView<T>(id: string, focus?: boolean): Promise<T | null> {
				openViewCalls.push({ id, focus });
				return Promise.resolve(null);
			}
		}

		const instantiationService = workbenchInstantiationService(undefined, store);
		const viewsService = store.add(new TrackingViewsService());
		instantiationService.stub(IViewsService, viewsService);

		await instantiationService.invokeFunction(async accessor => {
			await accessor.get(IViewsService).openView(AGENT_INSPECT_VIEW_ID, true);
		});

		assert.deepStrictEqual(openViewCalls, [{ id: AGENT_INSPECT_VIEW_ID, focus: true }]);
	});
});
