/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ConfigurationTarget, IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ContextKeyService } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { TestThemeService } from '../../../../../platform/theme/test/common/testThemeService.js';
import { TestContextService, TestStorageService } from '../../../common/workbenchTestServices.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MainStatusbarPart } from '../../../../browser/parts/statusbar/statusbarPart.js';
import { LayoutSettings } from '../../../../services/layout/browser/layoutService.js';
import { TestContextMenuService, TestLayoutService } from '../../workbenchTestServices.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { timeout } from '../../../../../base/common/async.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { NullHoverService } from '../../../../../platform/hover/test/browser/nullHoverService.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IStatusbarService, StatusbarAlignment } from '../../../../services/statusbar/browser/statusbar.js';

suite('StatusbarPart', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	class TestMainStatusbarPart extends MainStatusbarPart {
		updateStylesCalls = 0;
		focusNextEntryCalls = 0;

		override updateStyles(): void {
			this.updateStylesCalls++;
			super.updateStyles();
		}

		override focusNextEntry(): void {
			this.focusNextEntryCalls++;
			super.focusNextEntry();
		}
	}

	class TestFloatingPanelsLayoutService extends TestLayoutService {
		floatingPanelsEnabled = false;
		modernUICompact = false;

		override isFloatingPanelsEnabled(): boolean {
			return this.floatingPanelsEnabled;
		}

		override isModernUICompact(): boolean {
			return this.modernUICompact;
		}
	}

	function fireConfigChange(configurationService: TestConfigurationService, key: string): void {
		configurationService.onDidChangeConfigurationEmitter.fire({
			source: ConfigurationTarget.DEFAULT,
			affectedKeys: new Set([key]),
			change: { keys: [key], overrides: [] },
			affectsConfiguration: candidate => candidate === key,
		});
	}

	function createAttachedPart(): { part: TestMainStatusbarPart; container: HTMLElement; entries: DisposableStore } {
		// Added before the part so entry accessors are disposed while the part is still alive
		const entries = store.add(new DisposableStore());
		const configurationService = new TestConfigurationService();
		const instantiationService = store.add(new TestInstantiationService());
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.stub(IHoverService, NullHoverService);
		const contextKeyService = store.add(new ContextKeyService(configurationService));
		const part = store.add(new TestMainStatusbarPart(
			instantiationService,
			new TestThemeService(),
			new TestContextService(),
			store.add(new TestStorageService()),
			new TestLayoutService(),
			new TestContextMenuService(),
			contextKeyService,
			configurationService,
		));

		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));
		part.create(container);

		return { part, container, entries };
	}

	function addLeftEntry(part: TestMainStatusbarPart, id: string, priority: number) {
		return part.addEntry({ name: id, text: id, ariaLabel: id }, id, StatusbarAlignment.LEFT, priority);
	}

	function entryLabel(container: HTMLElement, id: string): HTMLElement {
		const label = container.querySelector<HTMLElement>(`.statusbar-item[id="${id}"] > .statusbar-item-label`);
		assert.ok(label, `missing status bar entry ${id}`);
		return label;
	}

	function runStatusbarCommand(commandId: string, part: TestMainStatusbarPart, editorService?: IEditorService): void {
		const command = CommandsRegistry.getCommand(commandId);
		assert.ok(command, `missing command ${commandId}`);
		const accessor = { get: (id: unknown) => id === IStatusbarService ? part : editorService } as unknown as ServicesAccessor;
		command.handler(accessor);
	}

	test('configuration changes update styles only after the part is created', () => {
		const configurationService = new TestConfigurationService();
		const instantiationService = store.add(new TestInstantiationService());
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.stub(IHoverService, new class extends mock<IHoverService>() { });
		const contextKeyService = store.add(new ContextKeyService(configurationService));
		const part = store.add(new TestMainStatusbarPart(
			instantiationService,
			new TestThemeService(),
			new TestContextService(),
			store.add(new TestStorageService()),
			new TestLayoutService(),
			new TestContextMenuService(),
			contextKeyService,
			configurationService,
		));

		fireConfigChange(configurationService, LayoutSettings.MODERN_UI);
		const beforeCreate = part.updateStylesCalls;
		part.create(document.createElement('div'));
		const afterCreate = part.updateStylesCalls;
		fireConfigChange(configurationService, 'unrelated.setting');
		const afterUnrelatedChange = part.updateStylesCalls;
		fireConfigChange(configurationService, LayoutSettings.MODERN_UI);

		assert.deepStrictEqual({
			beforeCreate,
			afterCreate,
			afterUnrelatedChange,
			afterModernUIChange: part.updateStylesCalls,
		}, {
			beforeCreate: 0,
			afterCreate: 1,
			afterUnrelatedChange: 1,
			afterModernUIChange: 2,
		});
	});

	test('modern UI reserves compact vertical status bar padding', () => {
		const configurationService = new TestConfigurationService();
		const instantiationService = store.add(new TestInstantiationService());
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.stub(IHoverService, new class extends mock<IHoverService>() { });
		const contextKeyService = store.add(new ContextKeyService(configurationService));
		const layoutService = new TestFloatingPanelsLayoutService();
		const part = store.add(new TestMainStatusbarPart(
			instantiationService,
			new TestThemeService(),
			new TestContextService(),
			store.add(new TestStorageService()),
			layoutService,
			new TestContextMenuService(),
			contextKeyService,
			configurationService,
		));

		const defaultConstraints = { minimumHeight: part.minimumHeight, maximumHeight: part.maximumHeight };
		layoutService.floatingPanelsEnabled = true;
		const modernUIConstraints = { minimumHeight: part.minimumHeight, maximumHeight: part.maximumHeight };
		layoutService.modernUICompact = true;
		const compactModernUIConstraints = { minimumHeight: part.minimumHeight, maximumHeight: part.maximumHeight };

		assert.deepStrictEqual({ defaultConstraints, modernUIConstraints, compactModernUIConstraints }, {
			defaultConstraints: { minimumHeight: 22, maximumHeight: 22 },
			modernUIConstraints: { minimumHeight: 28, maximumHeight: 28 },
			compactModernUIConstraints: { minimumHeight: 26, maximumHeight: 26 },
		});
	});

	test('focus(false) keeps focus on the container without moving to an entry', async () => {
		const { part, container, entries } = createAttachedPart();
		entries.add(addLeftEntry(part, 'first', 1));

		part.focus(false);
		await timeout(0);

		assert.deepStrictEqual({
			containerFocused: document.activeElement === container,
			focusNextEntryCalls: part.focusNextEntryCalls,
		}, {
			containerFocused: true,
			focusNextEntryCalls: 0,
		});
	});

	test('Home and End focus the first and the last visible entry', async () => {
		const { part, container, entries } = createAttachedPart();
		entries.add(addLeftEntry(part, 'first', 3));
		entries.add(addLeftEntry(part, 'second', 2));
		entries.add(addLeftEntry(part, 'third', 1));

		runStatusbarCommand('workbench.statusBar.focusFirst', part);
		await timeout(0);
		const afterHome = document.activeElement;

		runStatusbarCommand('workbench.statusBar.focusLast', part);
		await timeout(0);
		const afterEnd = document.activeElement;

		assert.strictEqual(afterHome, entryLabel(container, 'first'));
		assert.strictEqual(afterEnd, entryLabel(container, 'third'));
	});

	test('Escape moves from an entry to the container and then to the active editor', async () => {
		const { part, container, entries } = createAttachedPart();
		entries.add(addLeftEntry(part, 'first', 3));
		entries.add(addLeftEntry(part, 'second', 2));
		entries.add(addLeftEntry(part, 'third', 1));
		let editorFocusCalls = 0;
		const editorService = { activeEditorPane: { focus: () => { editorFocusCalls++; } } } as unknown as IEditorService;

		entryLabel(container, 'second').focus();
		runStatusbarCommand('workbench.statusBar.clearFocus', part, editorService);
		await timeout(0);
		const afterFirstEscape = document.activeElement;

		runStatusbarCommand('workbench.statusBar.clearFocus', part, editorService);

		assert.deepStrictEqual({
			containerFocused: afterFirstEscape === container,
			editorFocusCalls,
		}, {
			containerFocused: true,
			editorFocusCalls: 1,
		});
	});

	test('focus() moves to the first visible entry when the last focused entry was removed', async () => {
		const { part, container, entries } = createAttachedPart();
		const removed = addLeftEntry(part, 'first', 2);
		entries.add(addLeftEntry(part, 'second', 1));

		part.focusNextEntry();
		removed.dispose();
		part.focus();
		await timeout(0);

		assert.strictEqual(document.activeElement, entryLabel(container, 'second'));
	});
});
