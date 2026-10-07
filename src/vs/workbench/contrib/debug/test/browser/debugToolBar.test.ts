/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IPartVisibilityChangeEvent, IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { TestLayoutService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { DebugToolBar } from '../../browser/debugToolBar.js';
import { IDebugService, State } from '../../common/debug.js';
import { MockDebugService } from '../common/mockDebug.js';

class TestDebugToolBarDebugService extends MockDebugService {
	override get onDidChangeState(): Event<State> { return Event.None; }
	override get state(): State { return State.Inactive; }
	override get onDidNewSession(): Event<any> { return Event.None; }
	override get onWillNewSession(): Event<any> { return Event.None; }
	override get onDidEndSession(): Event<any> { return Event.None; }
	override getModel(): any { return { getSessions: () => [] }; }
}

class TestDebugToolBarLayoutService extends TestLayoutService {
	private _titleBarVisible = true;
	constructor(private readonly _onDidChangePartVisibilityEmitter: Emitter<IPartVisibilityChangeEvent>) {
		super();
	}

	override readonly onDidChangePartVisibility = this._onDidChangePartVisibilityEmitter.event;
	override mainContainerOffset = { top: 30, quickPickTop: 30 };

	override isVisible(part: Parts): boolean {
		if (part === Parts.TITLEBAR_PART) {
			return this._titleBarVisible;
		}
		return super.isVisible(part);
	}

	setTitleBarVisible(visible: boolean): void {
		this._titleBarVisible = visible;
		this._onDidChangePartVisibilityEmitter.fire({ partId: Parts.TITLEBAR_PART, visible });
	}
}

suite('Debug - ToolBar', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('yRange is recomputed when titlebar visibility changes', () => {
		const partVisibilityEmitter = disposables.add(new Emitter<IPartVisibilityChangeEvent>());
		const layoutService = new TestDebugToolBarLayoutService(partVisibilityEmitter);
		const configurationService = new TestConfigurationService({
			debug: { toolBarLocation: 'floating' },
			workbench: {
				editor: { showTabs: 'multiple' }
			},
			window: {
				commandCenter: false
			}
		});
		const storageService = disposables.add(new TestStorageService());
		const debugService = new TestDebugToolBarDebugService();

		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IWorkbenchLayoutService, layoutService);
		instantiationService.stub(IDebugService, debugService);
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.stub(IStorageService, storageService);

		const toolbar = disposables.add(instantiationService.createInstance(DebugToolBar));
		const element = (toolbar as any).$el as HTMLElement;

		// 1. Tool bar visible and titlebar visible
		storageService.store('debug.actionswidgety', 0, StorageScope.PROFILE, StorageTarget.MACHINE);
		(toolbar as any).show();

		// Initially titlebar is visible: yMin = 0, yMax = 28 + 35 = 63
		assert.strictEqual(element.style.getPropertyValue('--y-position'), '0px');

		// 2. Hide titlebar -> onDidChangePartVisibility -> _yRange reset to undefined
		layoutService.setTitleBarVisible(false);
		// When titlebar is hidden, yMin = mainContainerOffset.top = 30
		const yPosHidden = parseInt(element.style.getPropertyValue('--y-position'), 10);
		assert.ok(yPosHidden >= layoutService.mainContainerOffset.top, `y-position (${yPosHidden}) must be >= mainContainerOffset.top (${layoutService.mainContainerOffset.top})`);
		assert.strictEqual(element.style.getPropertyValue('--y-position'), '30px');

		// 3. Titlebar visible again -> onDidChangePartVisibility -> _yRange reset
		layoutService.setTitleBarVisible(true);
		// yMin is 0 again
		assert.strictEqual(element.style.getPropertyValue('--y-position'), '0px');

		// With a higher stored Y within the titlebar range (e.g. 50px)
		storageService.store('debug.actionswidgety', 50, StorageScope.PROFILE, StorageTarget.MACHINE);
		(toolbar as any).setCoordinates();
		assert.strictEqual(element.style.getPropertyValue('--y-position'), '50px');

		// 4. When toolbar is invisible, onDidChangePartVisibility clears _yRange, then show() uses new range
		(toolbar as any).hide();
		storageService.store('debug.actionswidgety', 0, StorageScope.PROFILE, StorageTarget.MACHINE);
		layoutService.setTitleBarVisible(false);
		// Toolbar hidden, calling show() will recalculate yRange with titlebar hidden
		(toolbar as any).show();
		assert.strictEqual(element.style.getPropertyValue('--y-position'), '30px');
	});
});
