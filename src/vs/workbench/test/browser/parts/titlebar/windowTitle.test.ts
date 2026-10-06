/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { WindowTitle } from '../../../../browser/parts/titlebar/windowTitle.js';
import { workbenchInstantiationService, TestDecorationsService, TestEditorInput, TestEditorService } from '../../workbenchTestServices.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { mainWindow, ensureCodeWindow } from '../../../../../base/browser/window.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { TestAccessibilityService } from '../../../../../platform/accessibility/test/common/testAccessibilityService.js';
import { IDecorationsService, IResourceDecorationChangeEvent, IDecorationData, IDecoration } from '../../../../services/decorations/common/decorations.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { URI } from '../../../../../base/common/uri.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { timeout } from '../../../../../base/common/async.js';

suite('WindowTitle', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	class MockAccessibilityService extends TestAccessibilityService {
		private _optimized = false;
		readonly onDidChangeScreenReaderOptimizedEmitter = store.add(new Emitter<void>());
		override readonly onDidChangeScreenReaderOptimized = this.onDidChangeScreenReaderOptimizedEmitter.event;

		override isScreenReaderOptimized(): boolean {
			return this._optimized;
		}

		setScreenReaderOptimized(value: boolean): void {
			this._optimized = value;
			this.onDidChangeScreenReaderOptimizedEmitter.fire();
		}
	}

	class MockDecorationsService extends TestDecorationsService {
		readonly onDidChangeDecorationsEmitter = store.add(new Emitter<IResourceDecorationChangeEvent>());
		override readonly onDidChangeDecorations = this.onDidChangeDecorationsEmitter.event;
		private tooltip: string | undefined;

		setTooltip(tooltip: string | undefined) {
			this.tooltip = tooltip;
		}

		override getDecoration(_uri: URI, _includeChildren: boolean, _overwrite?: IDecorationData): IDecoration | undefined {
			if (!this.tooltip) {
				return undefined;
			}
			return {
				tooltip: this.tooltip,
				stripe: false
			} as unknown as IDecoration;
		}
	}

	class MockEditorService extends TestEditorService {
		readonly _onDidActiveEditorChange = store.add(new Emitter<void>());
		override readonly onDidActiveEditorChange = this._onDidActiveEditorChange.event;

		override async openEditor(editor: any, optionsOrGroup?: any, group?: any): Promise<any> {
			await super.openEditor(editor, optionsOrGroup, group);
			this.activeEditor = editor as EditorInput;
			this._onDidActiveEditorChange.fire();
			return undefined;
		}

		setActiveEditor(editor: EditorInput | undefined): void {
			this.activeEditor = editor;
			this._onDidActiveEditorChange.fire();
		}
	}

	class TestEditorInputWithResource extends TestEditorInput {
		constructor(testUri: URI) {
			super(testUri, 'testEditorInputForResource');
		}
	}

	function createWindowTitle(config: { title?: string; windowTitleOptimized?: boolean } = {}) {
		ensureCodeWindow(mainWindow, 1);

		const configService = new TestConfigurationService({
			window: {
				title: config.title,
				titleSeparator: ' - '
			},
			accessibility: {
				windowTitleOptimized: config.windowTitleOptimized ?? true
			}
		});

		const accessibilityService = new MockAccessibilityService();
		const decorationsService = new MockDecorationsService();
		const editorService = store.add(new MockEditorService());

		const instantiationService = workbenchInstantiationService({
			configurationService: () => configService,
			editorService: () => editorService
		}, store);

		instantiationService.stub(IConfigurationService, configService);
		instantiationService.stub(IAccessibilityService, accessibilityService);
		instantiationService.stub(IDecorationsService, decorationsService);
		instantiationService.stub(IEditorService, editorService);
		instantiationService.stub(IViewsService, {
			onDidChangeFocusedView: Event.None,
			getFocusedViewName: () => ''
		} as any);

		const windowTitle = store.add(instantiationService.createInstance(WindowTitle, mainWindow));

		return {
			windowTitle,
			configService,
			accessibilityService,
			decorationsService,
			editorService
		};
	}

	test('updateProperties: only isPure change does not change decorations and isAdmin adds suffix', () => {
		const { windowTitle } = createWindowTitle();

		const initialDecorations = windowTitle.getTitleDecorations();
		windowTitle.updateProperties({ isPure: false });
		const decorationsAfterPure = windowTitle.getTitleDecorations();
		assert.deepStrictEqual(initialDecorations, decorationsAfterPure);

		windowTitle.updateProperties({ isAdmin: true });
		const decorationsAfterAdmin = windowTitle.getTitleDecorations();
		assert.ok(decorationsAfterAdmin.suffix);
	});

	test('screen reader optimized appends activeEditorState and updates when decoration changes', async () => {
		const { windowTitle, accessibilityService, decorationsService, editorService } = createWindowTitle({
			title: '${activeEditorShort}',
			windowTitleOptimized: true
		});

		accessibilityService.setScreenReaderOptimized(true);

		const resource = URI.parse('file:///test.txt');
		const input = store.add(new TestEditorInputWithResource(resource));
		await editorService.openEditor(input);

		decorationsService.setTooltip('Modified');
		decorationsService.onDidChangeDecorationsEmitter.fire({ affectsResource: () => true });

		await timeout(10);
		assert.ok(windowTitle.value.includes('Modified'));
	});

	test('opening screen reader optimization after editor is active still binds decorations listener', async () => {
		const { windowTitle, accessibilityService, decorationsService, editorService } = createWindowTitle({
			title: '${activeEditorShort}',
			windowTitleOptimized: true
		});

		const resource = URI.parse('file:///test2.txt');
		const input = store.add(new TestEditorInputWithResource(resource));
		await editorService.openEditor(input);

		accessibilityService.setScreenReaderOptimized(true);

		decorationsService.setTooltip('Staged');
		decorationsService.onDidChangeDecorationsEmitter.fire({ affectsResource: () => true });

		await timeout(10);
		assert.ok(windowTitle.value.includes('Staged'));
	});

	test('decorations change does not affect title when template lacks variable and screen reader optimization is disabled', async () => {
		const { windowTitle, decorationsService, editorService } = createWindowTitle({
			title: '${activeEditorShort}',
			windowTitleOptimized: true
		});

		const resource = URI.parse('file:///test3.txt');
		const input = store.add(new TestEditorInputWithResource(resource));
		await editorService.openEditor(input);
		await timeout(10);

		const initialTitle = windowTitle.value;
		decorationsService.setTooltip('Modified');
		decorationsService.onDidChangeDecorationsEmitter.fire({ affectsResource: () => true });

		await timeout(10);
		assert.strictEqual(windowTitle.value, initialTitle);
	});

	test('template containing ${activeEditorState} updates on decoration changes', async () => {
		const { windowTitle, decorationsService, editorService } = createWindowTitle({
			title: '${activeEditorShort} - ${activeEditorState}',
			windowTitleOptimized: false
		});

		const resource = URI.parse('file:///test4.txt');
		const input = store.add(new TestEditorInputWithResource(resource));
		await editorService.openEditor(input);

		decorationsService.setTooltip('Dirty');
		decorationsService.onDidChangeDecorationsEmitter.fire({ affectsResource: () => true });

		await timeout(10);
		assert.ok(windowTitle.value.includes('Dirty'));
	});
});
