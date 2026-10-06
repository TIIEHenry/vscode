/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { workbenchInstantiationService } from '../../workbenchTestServices.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ViewPane, IViewPaneOptions } from '../../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService, Extensions as ViewContainerExtensions, IViewsRegistry, IViewContainersRegistry, ViewContainerLocation, IViewDescriptor } from '../../../../common/views.js';
import { ViewDescriptorService } from '../../../../services/views/browser/viewDescriptorService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IContextKeyService, ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ContextKeyService } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../../browser/parts/views/viewPaneContainer.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';

suite('ViewPane / ViewWelcomeController', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	let instantiationService: TestInstantiationService;
	let contextKeyService: IContextKeyService;

	class TestViewPane extends ViewPane {
		private _shouldShowWelcome: boolean = true;

		constructor(
			options: IViewPaneOptions,
			@IKeybindingService keybindingService: IKeybindingService,
			@IContextMenuService contextMenuService: IContextMenuService,
			@IConfigurationService configurationService: IConfigurationService,
			@IContextKeyService contextKeyService: IContextKeyService,
			@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
			@IInstantiationService instantiationService: IInstantiationService,
			@IOpenerService openerService: IOpenerService,
			@IThemeService themeService: IThemeService,
			@IHoverService hoverService: IHoverService
		) {
			super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		}

		setShouldShowWelcome(value: boolean) {
			this._shouldShowWelcome = value;
			this._onDidChangeViewWelcomeState.fire();
		}

		override shouldShowWelcome(): boolean {
			return this._shouldShowWelcome;
		}

		get welcomeControllerEnabled(): boolean | undefined {
			return (this as any).viewWelcomeController?.enabled;
		}

		protected override layoutBody(height: number, width: number): void {
			super.layoutBody(height, width);
		}
	}

	class DummyContainer extends ViewPaneContainer { }

	setup(() => {
		instantiationService = workbenchInstantiationService(undefined, disposables);
		const viewDescriptorService = disposables.add(instantiationService.createInstance(ViewDescriptorService));
		instantiationService.stub(IViewDescriptorService, viewDescriptorService);
		contextKeyService = disposables.add(new ContextKeyService(new TestConfigurationService()));
		instantiationService.stub(IContextKeyService, contextKeyService);
	});

	test('welcome controller lifecycle, focus management, and enablement', () => {
		const ViewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		const ViewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);

		const viewContainer = ViewContainersRegistry.registerViewContainer({
			id: 'test.welcome.container',
			title: { value: 'Test', original: 'Test' },
			ctorDescriptor: new SyncDescriptor(DummyContainer, ['test.welcome.container', { mergeViewWithContainerWhenSingleView: true }])
		}, ViewContainerLocation.Sidebar);
		disposables.add(toDisposable(() => ViewContainersRegistry.deregisterViewContainer(viewContainer)));

		const viewDescriptor: IViewDescriptor = {
			id: 'test.view.welcome',
			name: { value: 'Test View', original: 'Test View' },
			ctorDescriptor: new SyncDescriptor(TestViewPane)
		};
		ViewsRegistry.registerViews([viewDescriptor], viewContainer);
		disposables.add(toDisposable(() => ViewsRegistry.deregisterViews([viewDescriptor], viewContainer)));

		const testViewPane = disposables.add(instantiationService.createInstance(TestViewPane, {
			id: 'test.view.welcome',
			title: 'Test View'
		}));

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		disposables.add(toDisposable(() => parent.remove()));
		parent.appendChild(testViewPane.element);

		testViewPane.render();

		const paneBody = testViewPane.element.querySelector('.pane-body') as HTMLElement;
		assert.ok(paneBody);

		// 1. 不注册欢迎文案就 renderBody 后 focus：容器无 welcome 类，activeElement 不在 .welcome-view 内
		assert.strictEqual(paneBody.classList.contains('welcome'), false);
		assert.strictEqual(testViewPane.welcomeControllerEnabled, false);

		testViewPane.focus();
		let activeElement = document.activeElement;
		let isInsideWelcome = activeElement ? !!activeElement.closest('.welcome-view') : false;
		assert.strictEqual(isInsideWelcome, false);

		// 2. 注册带 when 的文案并先让其可见、聚焦 .welcome-view-content，再让 when 失败：容器无 welcome 类，activeElement 不在 .welcome-view 内
		const testContextKey = contextKeyService.createKey<boolean>('testWelcomeContext', true);
		disposables.add(ViewsRegistry.registerViewWelcomeContent('test.view.welcome', {
			content: 'Welcome message\n[Button](command:test.command)',
			when: ContextKeyExpr.has('testWelcomeContext')
		}));

		assert.strictEqual(paneBody.classList.contains('welcome'), true);
		assert.strictEqual(testViewPane.welcomeControllerEnabled, true);

		testViewPane.focus();
		assert.strictEqual(document.activeElement?.classList.contains('welcome-view-content'), true);

		testContextKey.set(false);
		assert.strictEqual(paneBody.classList.contains('welcome'), false);
		assert.strictEqual(testViewPane.welcomeControllerEnabled, false);
		activeElement = document.activeElement;
		isInsideWelcome = activeElement ? !!activeElement.closest('.welcome-view') : false;
		assert.strictEqual(isInsideWelcome, false);

		// 3. 同一 when 再次匹配：容器回到带 welcome，focus 后 activeElement 在 .welcome-view-content 内
		testContextKey.set(true);
		assert.strictEqual(paneBody.classList.contains('welcome'), true);
		assert.strictEqual(testViewPane.welcomeControllerEnabled, true);

		testViewPane.focus();
		assert.strictEqual(document.activeElement?.classList.contains('welcome-view-content'), true);

		// 4. 有 when === 'default' 且没有其它可见项时，欢迎区仍显示
		testContextKey.set(false);
		assert.strictEqual(paneBody.classList.contains('welcome'), false);
		assert.strictEqual(testViewPane.welcomeControllerEnabled, false);

		disposables.add(ViewsRegistry.registerViewWelcomeContent('test.view.welcome', {
			content: 'Default welcome message\n[Default](command:test.default)',
			when: 'default'
		}));

		assert.strictEqual(paneBody.classList.contains('welcome'), true);
		assert.strictEqual(testViewPane.welcomeControllerEnabled, true);

		testViewPane.focus();
		assert.strictEqual(document.activeElement?.classList.contains('welcome-view-content'), true);

		// 5. shouldShowWelcome 变为 false 时清理欢迎区，恢复为 true 时重新显示
		testViewPane.setShouldShowWelcome(false);
		assert.strictEqual(paneBody.classList.contains('welcome'), false);
		assert.strictEqual(testViewPane.welcomeControllerEnabled, false);

		testViewPane.setShouldShowWelcome(true);
		assert.strictEqual(paneBody.classList.contains('welcome'), true);
		assert.strictEqual(testViewPane.welcomeControllerEnabled, true);
	});
});
