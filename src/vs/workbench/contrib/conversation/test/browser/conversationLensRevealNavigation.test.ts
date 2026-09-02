/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationPart, IConversationLensSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationLens } from '../../browser/conversationLens.js';
import { ConversationTrajectory } from '../../browser/conversationTrajectory.js';
import { ConversationTimelineTree } from '../../browser/conversationTimelineTree.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../common/conversationReviewEntry.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { IStorageService, StorageScope } from '../../../../../platform/storage/common/storage.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { IWebviewService } from '../../../webview/browser/webview.js';

suite('ConversationLens reveal navigation (T5a)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const LENS_LAYOUT_WIDTH = 640;
	const LENS_LAYOUT_HEIGHT = 480;

	async function flushTimelineHeightUpdates(): Promise<void> {
		await new Promise<void>(resolve => setTimeout(resolve, 20));
	}

	async function flushAnimationFrames(): Promise<void> {
		await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	}

	teardown(async () => {
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();
	});

	function getLensTab(slots: IConversationLensSlots, lensId: 'conversation' | 'trajectory'): HTMLButtonElement {
		const tab = slots.sessionBar!.querySelector(`button.conversation-lens-lens-tab[data-lens-id="${lensId}"]`) as HTMLButtonElement | null;
		assert.ok(tab);
		return tab;
	}

	function clickLensTab(slots: IConversationLensSlots, lensId: 'conversation' | 'trajectory'): void {
		getLensTab(slots, lensId).click();
	}

	function getTimelineTree(lens: ConversationLens): ConversationTimelineTree {
		return (lens as unknown as { timelineTree: ConversationTimelineTree }).timelineTree;
	}

	function layoutReadingColumn(lens: ConversationLens, slots: IConversationLensSlots): void {
		const readingColumn = slots.timeline.querySelector('.conversation-lens-reading-column') as HTMLElement | null;
		const timelineScroll = slots.timeline.querySelector('.conversation-lens-timeline-scroll') as HTMLElement | null;
		const contentHost = slots.timeline.querySelector('.conversation-lens-timeline-content') as HTMLElement | null;
		const treeContainer = slots.timeline.querySelector('.conversation-timeline-tree') as HTMLElement | null;
		if (readingColumn) {
			readingColumn.style.width = `${LENS_LAYOUT_WIDTH}px`;
			readingColumn.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		}
		if (timelineScroll) {
			timelineScroll.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
			timelineScroll.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		if (contentHost) {
			contentHost.style.display = '';
			contentHost.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		if (treeContainer) {
			treeContainer.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		const timelineTree = getTimelineTree(lens);
		const trajectoryView = (lens as unknown as { trajectoryView: ConversationTrajectory }).trajectoryView;
		const timelineHeight = LENS_LAYOUT_HEIGHT - 120;
		timelineTree.layout(timelineHeight, LENS_LAYOUT_WIDTH);
		trajectoryView.layout(LENS_LAYOUT_HEIGHT, LENS_LAYOUT_WIDTH);
	}

	function mountLens(): { part: ConversationPart; lens: ConversationLens; stubService: ConversationStubService; storageService: TestStorageService; layoutReadingColumn: () => void; slots: IConversationLensSlots } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const storageService = store.add(new TestStorageService());
		instantiationService.stub(IStorageService, storageService);
		const stubService = store.add(new ConversationStubService());
		stubService.createSession();
		instantiationService.stub(IConversationRosterService, stubService);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
			getAccessibleTurnContent: () => undefined,
			focusAccessibleTurn: () => { },
			scrollToFirstPendingConfirmation: () => { },
		});
		instantiationService.stub(IConversationReviewNavService, {
			_serviceBrand: undefined,
			onDidChange: Event.None,
			getReviewNavForSession: () => [],
		});
		instantiationService.stub(IClipboardService, new TestClipboardService());
		instantiationService.stub(ICommandService, new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand() { return Promise.resolve(undefined); }
		}());
		instantiationService.stub(IExtensionService, {
			_serviceBrand: undefined,
			getExtension: () => Promise.resolve(undefined),
		} as unknown as IExtensionService);
		instantiationService.stub(IWebviewService, {
			_serviceBrand: undefined,
			activeWebview: undefined,
			webviews: [],
			onDidChangeActiveWebview: Event.None,
			createWebviewOverlay: () => { throw new Error('not used'); },
			createWebviewElement: () => ({
				mountTo(parent: HTMLElement) {
					const el = document.createElement('div');
					el.setAttribute('data-mermaid-host', 'stub');
					parent.appendChild(el);
				},
				setHtml() { },
				postMessage: () => Promise.resolve(true),
				onDidWheel: Event.None,
				onFatalError: Event.None,
				intrinsicContentSize: observableValue('intrinsicContentSize', undefined),
				dispose() { },
			}),
		} as unknown as IWebviewService);
		instantiationService.stub(IExplorerService, {
			_serviceBrand: undefined,
			select: async () => { },
		} as unknown as IExplorerService);
		instantiationService.stub(ISCMService, {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService);
		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		parent.classList.add('monaco-workbench');
		parent.style.width = `${LENS_LAYOUT_WIDTH}px`;
		parent.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		part.create(parent);
		const partSlots = part.getSlots();
		assert.ok(partSlots);
		const slots: IConversationLensSlots = {
			sessionBar: partSlots.sessionBar,
			timeline: document.createElement('div'),
			dock: document.createElement('div'),
		};
		slots.timeline.classList.add('conversation-timeline', 'part', 'conversation');
		slots.dock.classList.add('conversation-dock');
		parent.appendChild(slots.timeline);
		parent.appendChild(slots.dock);
		part.layout(LENS_LAYOUT_WIDTH, LENS_LAYOUT_HEIGHT, 0, 0);
		const layoutCallbacks: Array<() => void> = [];
		const runLayouts = () => {
			for (const layout of layoutCallbacks) {
				layout();
			}
		};
		store.add(stubService.onDidChangeSession(() => runLayouts()));
		store.add(stubService.onDidChangeActiveSession(() => runLayouts()));
		const lens = store.add(instantiationService.createInstance(ConversationLens, slots));
		const layout = () => layoutReadingColumn(lens, slots);
		layoutCallbacks.push(layout);
		layout();
		const contentHost = slots.timeline.querySelector('.conversation-lens-timeline-content') as HTMLElement | null;
		if (contentHost) {
			contentHost.style.display = '';
		}
		layout();
		stubService.switchSession('untitled');
		layout();
		return { part, lens, stubService, storageService, layoutReadingColumn: layout, slots };
	}

	function getTrajectoryRow(slots: IConversationLensSlots, recordId: string): HTMLElement {
		const row = slots.timeline.querySelector(`.conversation-lens-trajectory-record-row[data-record-id="${recordId}"]`) as HTMLElement | null;
		assert.ok(row, `expected trajectory row ${recordId}`);
		return row;
	}

	function getSelectedTrajectoryRecordId(slots: IConversationLensSlots): string | undefined {
		const selected = slots.timeline.querySelector('.conversation-lens-trajectory-record-row--selected') as HTMLElement | null;
		return selected?.getAttribute('data-record-id') ?? undefined;
	}

	function clickViewInTrajectory(slots: IConversationLensSlots, turnId: string, placement: 'header' | 'actions' | 'process-fold-thinking' | 'process-fold-tool'): void {
		let button: HTMLButtonElement | null = null;
		if (placement === 'header') {
			button = slots.timeline.querySelector(`.conversation-lens-turn[data-turn-id="${turnId}"] .conversation-lens-turn-header-trajectory .monaco-button`) as HTMLButtonElement | null;
		} else if (placement === 'actions') {
			button = slots.timeline.querySelector(`.conversation-lens-turn[data-turn-id="${turnId}"] .conversation-lens-turn-action-trajectory .monaco-button`) as HTMLButtonElement | null;
		} else if (placement === 'process-fold-thinking') {
			button = slots.timeline.querySelector(`.conversation-process-fold-thinking[data-turn-id="${turnId}"] .conversation-process-fold-trajectory-jump`) as HTMLButtonElement | null;
		} else {
			button = slots.timeline.querySelector(`.conversation-process-fold-tool[data-turn-id="${turnId}"] .conversation-process-fold-trajectory-jump`) as HTMLButtonElement | null;
		}
		assert.ok(button, `expected View in trajectory control for ${turnId}`);
		button!.click();
	}

	test('user turn View in trajectory switches to Trajectory lens and reveals the linked record', async () => {
		const { lens, storageService, layoutReadingColumn, slots } = mountLens();
		await flushTimelineHeightUpdates();

		assert.strictEqual(getLensTab(slots, 'conversation').getAttribute('aria-selected'), 'true');

		clickViewInTrajectory(slots, 'untitled-u1', 'header');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.strictEqual(getLensTab(slots, 'trajectory').getAttribute('aria-selected'), 'true');
		assert.strictEqual(storageService.get('conversation.lensId', StorageScope.WORKSPACE), 'trajectory');
		assert.ok(!slots.timeline.querySelector('.conversation-lens-trajectory')!.hasAttribute('hidden'));
		assert.strictEqual(slots.timeline.querySelector('.conversation-lens-timeline')!.hasAttribute('hidden'), true);
		assert.strictEqual(getSelectedTrajectoryRecordId(slots), 'untitled-u1');
		assert.ok(getTrajectoryRow(slots, 'untitled-u1').classList.contains('conversation-lens-trajectory-record-row--selected'));
		assert.strictEqual(lens.isInputMaximized(), false);
	});

	test('trajectory linked row click switches to Conversation lens and reveals the turn', async () => {
		const { layoutReadingColumn, slots } = mountLens();
		await flushTimelineHeightUpdates();

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		getTrajectoryRow(slots, 'untitled-t1').click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		assert.strictEqual(getLensTab(slots, 'conversation').getAttribute('aria-selected'), 'true');
		assert.ok(!slots.timeline.querySelector('.conversation-lens-timeline')!.hasAttribute('hidden'));
		assert.strictEqual(slots.timeline.querySelector('.conversation-lens-trajectory')!.hasAttribute('hidden'), true);
		assert.ok(slots.timeline.querySelector('.conversation-process-fold-thinking[data-turn-id="untitled-t1"]'));
	});

	test('process fold thinking jump switches to Trajectory lens and reveals the linked record', async () => {
		const { layoutReadingColumn, slots } = mountLens();
		await flushTimelineHeightUpdates();

		const fold = slots.timeline.querySelector('[data-process-fold]')!;
		(fold.querySelector('.conversation-process-fold-header') as HTMLElement).click();
		await flushTimelineHeightUpdates();

		clickViewInTrajectory(slots, 'untitled-t1', 'process-fold-thinking');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.strictEqual(getLensTab(slots, 'trajectory').getAttribute('aria-selected'), 'true');
		assert.strictEqual(getSelectedTrajectoryRecordId(slots), 'untitled-t1');
	});

	test('process fold tool jump switches to Trajectory lens and reveals the linked record', async () => {
		const { layoutReadingColumn, slots } = mountLens();
		await flushTimelineHeightUpdates();

		const fold = slots.timeline.querySelector('[data-process-fold]')!;
		(fold.querySelector('.conversation-process-fold-header') as HTMLElement).click();
		await flushTimelineHeightUpdates();

		clickViewInTrajectory(slots, 'untitled-tool1', 'process-fold-tool');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.strictEqual(getLensTab(slots, 'trajectory').getAttribute('aria-selected'), 'true');
		assert.strictEqual(getSelectedTrajectoryRecordId(slots), 'untitled-tool1');
	});

	test('subtool trajectory row navigates to parent tool turn in Conversation lens', async () => {
		const { layoutReadingColumn, slots } = mountLens();
		await flushTimelineHeightUpdates();

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		getTrajectoryRow(slots, 'fixture:untitled:subtool').click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		assert.strictEqual(getLensTab(slots, 'conversation').getAttribute('aria-selected'), 'true');
		assert.ok(slots.timeline.querySelector('.conversation-process-fold-tool[data-turn-id="untitled-tool1"]'));
	});

	test('navigate from trajectory restores timeline when input is maximized', async () => {
		const { lens, layoutReadingColumn, slots } = mountLens();
		await flushTimelineHeightUpdates();

		const maximizeButton = slots.dock.querySelector('.conversation-lens-dock-maximize-input .monaco-button') as HTMLButtonElement;
		assert.ok(maximizeButton);
		maximizeButton.click();
		assert.strictEqual(lens.isInputMaximized(), true);

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		getTrajectoryRow(slots, 'untitled-a1').click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		assert.strictEqual(lens.isInputMaximized(), false);
		assert.strictEqual(getLensTab(slots, 'conversation').getAttribute('aria-selected'), 'true');
		assert.ok(slots.timeline.querySelector('.conversation-lens-turn[data-turn-id="untitled-a1"]'));
	});

	test('fixture-only trajectory rows stay on Trajectory lens and open inspector', async () => {
		const { layoutReadingColumn, slots } = mountLens();
		await flushTimelineHeightUpdates();

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		getTrajectoryRow(slots, 'fixture:untitled:system').click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.strictEqual(getLensTab(slots, 'trajectory').getAttribute('aria-selected'), 'true');
		assert.strictEqual(getSelectedTrajectoryRecordId(slots), 'fixture:untitled:system');
		const inspector = slots.timeline.querySelector('.conversation-lens-trajectory-inspector') as HTMLElement;
		assert.ok(!inspector.hidden);
	});
});
