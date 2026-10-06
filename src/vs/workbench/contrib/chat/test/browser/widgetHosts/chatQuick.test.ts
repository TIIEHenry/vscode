/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Dimension, IDimension } from '../../../../../../base/browser/dom.js';
import { ISashEvent, Sash } from '../../../../../../base/browser/ui/sash/sash.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IWorkbenchLayoutService } from '../../../../../services/layout/browser/layoutService.js';
import { ChatWidget } from '../../../browser/widget/chatWidget.js';
import { QuickChat } from '../../../browser/widgetHosts/chatQuick.js';

suite('QuickChat', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	class TestQuickChat extends QuickChat {
		constructor(layoutService: IWorkbenchLayoutService) {
			super(
				undefined as any,
				undefined as any,
				undefined as any,
				layoutService,
				undefined as any,
				undefined as any,
				undefined as any,
			);
		}

		attachWidgetAndSash(widget: ChatWidget, sash: Sash, parent: HTMLElement) {
			this.widget = widget;
			this.sash = sash;
			this.registerListeners(parent);
		}
	}

	test('layouts widget with updated width on active container layout and sash change', () => {
		const onDidLayoutMainContainerEmitter = store.add(new Emitter<IDimension>());
		const onDidLayoutActiveContainerEmitter = store.add(new Emitter<IDimension>());
		let mainContainerHeight = 800; // QuickChat.DEFAULT_HEIGHT_OFFSET is 100, maxHeight = 700

		const layoutService = new class extends mock<IWorkbenchLayoutService>() {
			override get onDidLayoutMainContainer() { return onDidLayoutMainContainerEmitter.event; }
			override get onDidLayoutActiveContainer() { return onDidLayoutActiveContainerEmitter.event; }
			override get mainContainerDimension(): IDimension {
				return { height: mainContainerHeight, width: 1000 };
			}
			override get activeContainerDimension(): IDimension {
				return { height: mainContainerHeight, width: 1000 };
			}
		};

		const parent = document.createElement('div');
		let currentParentWidth = 400;
		Object.defineProperty(parent, 'offsetWidth', {
			get: () => currentParentWidth,
			configurable: true
		});

		const layoutCalls: { height: number; width: number }[] = [];
		const onDidChangeHeightEmitter = store.add(new Emitter<void>());

		const widget = Object.create(ChatWidget.prototype) as ChatWidget;
		Object.defineProperties(widget, {
			visible: { value: true, writable: true },
			container: { value: parent },
			bodyDimension: { value: new Dimension(400, 350), writable: true },
			onDidChangeHeight: { value: onDidChangeHeightEmitter.event },
			isDynamicChatTreeItemLayoutEnabled: { value: true, writable: true },
			layout: {
				value: (height: number, width: number) => {
					layoutCalls.push({ height, width });
					(widget as any).bodyDimension = new Dimension(width, height);
				}
			},
			layoutDynamicChatTreeItemMode: {
				value: () => { }
			}
		});

		const onDidStartEmitter = store.add(new Emitter<void>());
		const onDidChangeEmitter = store.add(new Emitter<ISashEvent>());
		const onDidResetEmitter = store.add(new Emitter<void>());

		const sash = {
			onDidStart: onDidStartEmitter.event,
			onDidChange: onDidChangeEmitter.event,
			onDidReset: onDidResetEmitter.event,
			layout: () => { },
			dispose: () => { },
		} as unknown as Sash;

		const quickChat = store.add(new TestQuickChat(layoutService));
		quickChat.attachWidgetAndSash(widget, sash, parent);

		// 1. Main container layout runs first; quick chat should not layout on main container layout
		onDidLayoutMainContainerEmitter.fire({ width: 1200, height: 800 });
		assert.strictEqual(layoutCalls.length, 0);

		// 2. Quick input container changes width, then active container layout runs
		currentParentWidth = 500;
		onDidLayoutActiveContainerEmitter.fire({ width: 1200, height: 800 });
		assert.strictEqual(layoutCalls.length, 1);
		assert.strictEqual(layoutCalls[0].width, 500);
		assert.strictEqual(layoutCalls[0].height, 350);

		// 3. Sash drag uses real-time sampled parent.offsetWidth
		currentParentWidth = 520;
		onDidChangeEmitter.fire({ currentY: 300, startX: 0, currentX: 0, startY: 0, altKey: false });
		assert.strictEqual(layoutCalls.length, 2);
		assert.strictEqual(layoutCalls[1].width, 520);
		assert.strictEqual(layoutCalls[1].height, 300);

		// 4. Clamps height to maxHeight when current height exceeds new maxHeight
		mainContainerHeight = 350; // maxHeight becomes 350 - 100 = 250 (< current height 300)
		onDidLayoutActiveContainerEmitter.fire({ width: 1200, height: 350 });
		assert.strictEqual(layoutCalls.length, 3);
		assert.strictEqual(layoutCalls[2].height, 250);
		assert.strictEqual(layoutCalls[2].width, 520);

		// 5. When container width is already 600 and does not change, no extra layout call is needed
		currentParentWidth = 600;
		(widget as any).bodyDimension = new Dimension(600, 250);
		layoutCalls.length = 0;
		onDidLayoutActiveContainerEmitter.fire({ width: 1200, height: 350 });
		assert.strictEqual(layoutCalls.length, 0);
	});

	test('defers layout when widget is not visible', () => {
		const onDidLayoutActiveContainerEmitter = store.add(new Emitter<IDimension>());
		const layoutService = new class extends mock<IWorkbenchLayoutService>() {
			override get onDidLayoutActiveContainer() { return onDidLayoutActiveContainerEmitter.event; }
			override get mainContainerDimension(): IDimension {
				return { height: 800, width: 1000 };
			}
		};

		const parent = document.createElement('div');
		let currentParentWidth = 400;
		Object.defineProperty(parent, 'offsetWidth', {
			get: () => currentParentWidth,
			configurable: true
		});

		const layoutCalls: { height: number; width: number }[] = [];
		const onDidChangeHeightEmitter = store.add(new Emitter<void>());

		const widget = Object.create(ChatWidget.prototype) as ChatWidget;
		Object.defineProperties(widget, {
			visible: { value: false, writable: true },
			container: { value: parent },
			bodyDimension: { value: new Dimension(400, 350), writable: true },
			onDidChangeHeight: { value: onDidChangeHeightEmitter.event },
			isDynamicChatTreeItemLayoutEnabled: { value: true, writable: true },
			setVisible: {
				value: (visible: boolean) => {
					(widget as any).visible = visible;
				}
			},
			layout: {
				value: (height: number, width: number) => {
					layoutCalls.push({ height, width });
					(widget as any).bodyDimension = new Dimension(width, height);
				}
			},
			layoutDynamicChatTreeItemMode: {
				value: () => { }
			}
		});

		const sash = {
			onDidStart: Event.None,
			onDidChange: Event.None,
			onDidReset: Event.None,
			layout: () => { },
			dispose: () => { },
		} as unknown as Sash;

		const quickChat = store.add(new TestQuickChat(layoutService));
		quickChat.attachWidgetAndSash(widget, sash, parent);

		// When hidden, layout is deferred
		currentParentWidth = 500;
		onDidLayoutActiveContainerEmitter.fire({ width: 1200, height: 800 });
		assert.strictEqual(layoutCalls.length, 0);

		// When shown, deferred layout is applied
		quickChat.show();
		assert.strictEqual(layoutCalls.length, 1);
		assert.strictEqual(layoutCalls[0].width, 500);
	});
});
