/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestCommandService } from '../../../../../editor/test/browser/editorTestServices.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IURLService } from '../../../../../platform/url/common/url.js';
import { DEFAULT_EDITOR_ASSOCIATION, isEditorInput, IUntypedEditorInput } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IJSONEditingService } from '../../../configuration/common/jsonEditing.js';
import { TestJSONEditingService } from '../../../configuration/test/common/testServices.js';
import { IEditorService, MODAL_GROUP, PreferredGroup } from '../../../editor/common/editorService.js';
import { IEditorGroupsService, IModalEditorPart } from '../../../editor/common/editorGroupsService.js';
import { PreferencesService } from '../../browser/preferencesService.js';
import { IPreferencesService, IPreferencesEditorOptions, ISettingsEditorOptions } from '../../common/preferences.js';
import { PreferencesEditorInput, SettingsEditor2Input } from '../../common/preferencesEditorInput.js';
import { IRemoteAgentService } from '../../../remote/common/remoteAgentService.js';
import { TestRemoteAgentService, ITestInstantiationService, workbenchInstantiationService, TestEditorService, TestEditorGroupsService, TestEditorGroupView } from '../../../../test/browser/workbenchTestServices.js';
import { IEditorOptions } from '../../../../../platform/editor/common/editor.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions, IPreferencesEditorPaneRegistry } from '../../browser/preferencesEditorPaneRegistry.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';

const TEST_CONNECTION_PANE_ID = 'ua.connection';
const TEST_ENGINE_PANE_ID = 'ua.engine';

suite('PreferencesService', () => {
	let lastOpenEditorInput: EditorInput | IUntypedEditorInput | undefined;
	let lastOpenEditorOptions: IEditorOptions | undefined;
	let lastOpenEditorGroup: PreferredGroup | undefined;
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function createTestObject(editorGroupsService?: IEditorGroupsService, configurationService?: TestConfigurationService): PreferencesService {
		lastOpenEditorInput = undefined;
		lastOpenEditorOptions = undefined;
		lastOpenEditorGroup = undefined;

		const testInstantiationService: ITestInstantiationService = workbenchInstantiationService(
			configurationService ? { configurationService: () => configurationService } : {},
			disposables
		);

		class TestPreferencesEditorService extends TestEditorService {
			override async openEditor(editor: EditorInput | IUntypedEditorInput, optionsOrGroup?: IEditorOptions | PreferredGroup, group?: PreferredGroup): Promise<undefined> {
				lastOpenEditorInput = editor;
				if (group !== undefined) {
					lastOpenEditorOptions = optionsOrGroup as IEditorOptions;
					lastOpenEditorGroup = group;
				} else {
					lastOpenEditorOptions = undefined;
					lastOpenEditorGroup = optionsOrGroup as PreferredGroup;
				}
				// openEditor takes ownership of the input
				if (isEditorInput(editor)) {
					editor.dispose();
				}
				return undefined;
			}
		}

		testInstantiationService.stub(IEditorService, disposables.add(new TestPreferencesEditorService()));
		testInstantiationService.stub(IJSONEditingService, TestJSONEditingService);
		testInstantiationService.stub(IRemoteAgentService, TestRemoteAgentService);
		testInstantiationService.stub(ICommandService, TestCommandService);
		testInstantiationService.stub(IURLService, { registerHandler: () => { } });
		if (editorGroupsService) {
			testInstantiationService.stub(IEditorGroupsService, editorGroupsService);
		}

		// PreferencesService creates a PreferencesEditorInput which depends on IPreferencesService, add the real one, not a stub
		const collection = new ServiceCollection();
		collection.set(IPreferencesService, new SyncDescriptor(PreferencesService));
		const instantiationService = disposables.add(testInstantiationService.createChild(collection));
		return disposables.add(instantiationService.createInstance(PreferencesService));
	}

	function registerTestPane(id: string, order: number): DisposableStore {
		const registry = Registry.as<IPreferencesEditorPaneRegistry>(Extensions.PreferencesEditorPane);
		const store = new DisposableStore();
		store.add(registry.registerPreferencesEditorPane({
			id,
			title: id,
			order,
			ctorDescriptor: new SyncDescriptor(class {
				getDomNode() { return document.createElement('div'); }
				layout() { }
				search() { }
				dispose() { }
			}),
		}));
		return store;
	}

	test('options are preserved when calling openEditor', async () => {
		const testObject = createTestObject();
		await testObject.openSettings({ jsonEditor: false, query: 'test query' });
		const options = lastOpenEditorOptions as ISettingsEditorOptions;
		assert.strictEqual(options.focusSearch, true);
		assert.strictEqual(options.override, DEFAULT_EDITOR_ASSOCIATION.id);
		assert.strictEqual(options.query, 'test query');
	});

	test('opens in the source group when it lives in the main editor part (even with modal editors enabled)', async () => {
		const mainGroup = new TestEditorGroupView(1);
		const testObject = createTestObject(new TestEditorGroupsService([mainGroup]));

		await testObject.openUserSettings({ jsonEditor: false, groupId: mainGroup.id });

		assert.strictEqual(lastOpenEditorGroup, mainGroup);
	});

	test('opens in the modal group when the source group lives in the modal editor part', async () => {
		const modalGroup = new TestEditorGroupView(2);
		const modalEditorPart = { groups: [modalGroup] } as Partial<IModalEditorPart> as IModalEditorPart;
		const editorGroupsService = new class extends TestEditorGroupsService {
			override readonly activeModalEditorPart = modalEditorPart;
		}([modalGroup]);

		// Modal editors are turned off in settings to prove the routing comes from the
		// active modal editor part the action was invoked from and not from the modal default.
		const configurationService = new TestConfigurationService({ workbench: { editor: { useModal: 'off' } } });
		const testObject = createTestObject(editorGroupsService, configurationService);

		await testObject.openUserSettings({ jsonEditor: false, groupId: modalGroup.id });

		assert.strictEqual(lastOpenEditorGroup, MODAL_GROUP);
	});

	test('openPreferences with known paneId opens PreferencesEditorInput in MODAL_GROUP', async () => {
		const paneRegistration = registerTestPane(TEST_CONNECTION_PANE_ID, 10);
		disposables.add(paneRegistration);

		const testObject = createTestObject();
		await testObject.openPreferences({ paneId: TEST_CONNECTION_PANE_ID });

		assert.ok(isEditorInput(lastOpenEditorInput));
		assert.strictEqual((lastOpenEditorInput as EditorInput).typeId, PreferencesEditorInput.ID);
		assert.strictEqual((lastOpenEditorOptions as IPreferencesEditorOptions).paneId, TEST_CONNECTION_PANE_ID);
		assert.strictEqual(lastOpenEditorGroup, MODAL_GROUP);
	});

	test('openPreferences with engine paneId opens PreferencesEditorInput with paneId', async () => {
		const paneRegistration = registerTestPane(TEST_ENGINE_PANE_ID, 20);
		disposables.add(paneRegistration);

		const testObject = createTestObject();
		await testObject.openPreferences({ paneId: TEST_ENGINE_PANE_ID });

		assert.ok(isEditorInput(lastOpenEditorInput));
		assert.strictEqual((lastOpenEditorInput as EditorInput).typeId, PreferencesEditorInput.ID);
		assert.strictEqual((lastOpenEditorOptions as IPreferencesEditorOptions).paneId, TEST_ENGINE_PANE_ID);
		assert.strictEqual(lastOpenEditorGroup, MODAL_GROUP);
	});

	test('openPreferences without paneId opens PreferencesEditorInput in MODAL_GROUP', async () => {
		const paneRegistration = registerTestPane(TEST_CONNECTION_PANE_ID, 10);
		disposables.add(paneRegistration);

		const testObject = createTestObject();
		await testObject.openPreferences();

		assert.ok(isEditorInput(lastOpenEditorInput));
		assert.strictEqual((lastOpenEditorInput as EditorInput).typeId, PreferencesEditorInput.ID);
		assert.strictEqual(lastOpenEditorGroup, MODAL_GROUP);
	});

	test('openPreferences with unknown paneId opens Settings without query or revealSetting', async () => {
		const testObject = createTestObject();
		await testObject.openPreferences({ paneId: 'ua.unknown' });

		assert.ok(isEditorInput(lastOpenEditorInput));
		assert.strictEqual((lastOpenEditorInput as EditorInput).typeId, SettingsEditor2Input.ID);
		const options = lastOpenEditorOptions as ISettingsEditorOptions;
		assert.strictEqual(options.query, undefined);
		assert.strictEqual(options.revealSetting, undefined);
		assert.notStrictEqual((lastOpenEditorInput as EditorInput).typeId, PreferencesEditorInput.ID);
	});
});
