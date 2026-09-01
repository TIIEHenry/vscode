/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { Workspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { ConversationPart, IConversationLensSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMRepository, ISCMService } from '../../../scm/common/scm.js';
import { TestContextService } from '../../../../test/common/workbenchTestServices.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationLens } from '../../browser/conversationLens.js';
import {
	conversationIdentityBranchChipClass,
	conversationIdentityEngineChipClass,
	conversationIdentityFolderChipClass,
	conversationIdentityStripClass,
	getConversationIdentityBranchName,
} from '../../browser/conversationIdentityStrip.js';
import { getConversationEngineStatusText } from '../../browser/conversationSessionStatus.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../../common/uaPreferencesPanes.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';

const LENS_LAYOUT_WIDTH = 640;
const LENS_LAYOUT_HEIGHT = 480;

suite('ConversationIdentityStrip', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createEmptyScmService(): ISCMService {
		return {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function createScmServiceWithBranch(branchName: string): ISCMService {
		const historyItemRef = observableValue('historyItemRef', { id: 'HEAD', name: branchName });
		const historyProvider = {
			historyItemRef,
			historyItemRemoteRef: observableValue('remote', undefined),
			historyItemBaseRef: observableValue('base', undefined),
			historyItemRefChanges: observableValue('changes', { added: [], removed: [], modified: [], silent: true }),
		};
		const provider = {
			id: 'git',
			providerId: 'git',
			label: 'Git',
			name: 'Git',
			groups: [],
			onDidChangeResourceGroups: Event.None,
			onDidChangeResources: Event.None,
			historyProvider: observableValue('historyProvider', historyProvider),
			dispose: () => { },
		};
		const repository = { id: 'git', provider, dispose: () => { } } as unknown as ISCMRepository;
		return {
			_serviceBrand: undefined,
			get repositories() { return [repository]; },
			get repositoryCount() { return 1; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => repository,
		} as unknown as ISCMService;
	}

	function mountLens(options?: {
		workspaceContextService?: IWorkspaceContextService;
		scmService?: ISCMService;
		commandService?: ICommandService;
	}): { part: ConversationPart; slots: IConversationLensSlots; commandService: ICommandService } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const stubService = store.add(new ConversationStubService());
		const clipboardService = new TestClipboardService();
		const commandService = options?.commandService ?? new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			readonly executed: string[] = [];
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand<T>(id: string): Promise<T | undefined> {
				this.executed.push(id);
				return Promise.resolve(undefined);
			}
		}();
		const explorerService = {
			_serviceBrand: undefined,
			select: async () => { },
		} as unknown as IExplorerService;

		instantiationService.stub(IConversationRosterService, stubService);
		instantiationService.stub(IClipboardService, clipboardService);
		instantiationService.stub(ICommandService, commandService);
		instantiationService.stub(IExplorerService, explorerService);
		instantiationService.stub(ISCMService, options?.scmService ?? createEmptyScmService());
		if (options?.workspaceContextService) {
			instantiationService.stub(IWorkspaceContextService, options.workspaceContextService);
		}

		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		parent.classList.add('monaco-workbench');
		parent.style.width = `${LENS_LAYOUT_WIDTH}px`;
		parent.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		part.create(parent);
		const slots = part.getSlots();
		assert.ok(slots);
		slots.timeline.classList.add('part', 'conversation');
		part.layout(LENS_LAYOUT_WIDTH, LENS_LAYOUT_HEIGHT, 0, 0);
		store.add(instantiationService.createInstance(ConversationLens, slots));

		return { part, slots, commandService };
	}

	function getReadingColumn(slots: IConversationLensSlots): HTMLElement {
		const column = slots.timeline.querySelector('.conversation-lens-reading-column');
		assert.ok(column);
		return column as HTMLElement;
	}

	function getIdentityStrip(slots: IConversationLensSlots): HTMLElement {
		const strip = getReadingColumn(slots).querySelector(`.${conversationIdentityStripClass}`);
		assert.ok(strip);
		return strip as HTMLElement;
	}

	test('identity strip mounts in reading column before timeline scroll', () => {
		const { slots } = mountLens();
		const readingColumn = getReadingColumn(slots);
		const children = [...readingColumn.children];

		assert.strictEqual(children[0]?.classList.contains(conversationIdentityStripClass), true);
		assert.ok(children[1]?.classList.contains('conversation-lens-timeline'));
		assert.ok(getIdentityStrip(slots).compareDocumentPosition(getReadingColumn(slots).querySelector('.conversation-lens-timeline-scroll')!) & Node.DOCUMENT_POSITION_FOLLOWING);
	});

	test('identity strip is absent from SessionBar and dock', () => {
		const { slots } = mountLens();

		assert.strictEqual(slots.sessionBar.querySelector(`.${conversationIdentityStripClass}`), null);
		assert.strictEqual(slots.dock.querySelector(`.${conversationIdentityStripClass}`), null);
		assert.strictEqual(slots.sessionBar.querySelector(`.${conversationIdentityEngineChipClass}`), null);
		assert.strictEqual(slots.dock.querySelector(`.${conversationIdentityEngineChipClass}`), null);
	});

	test('engine chip shows honest not-connected copy and opens Connection preferences', async () => {
		const { slots, commandService } = mountLens();
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.ok(engineChip);
		assert.strictEqual(engineChip.textContent, getConversationEngineStatusText());
		assert.strictEqual(engineChip.textContent, 'Engine not connected');

		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
	});

	test('folder chip is hidden for empty workspace', () => {
		const emptyWorkspace = new TestContextService(new Workspace('empty-workspace', []));
		const { slots } = mountLens({ workspaceContextService: emptyWorkspace });
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;

		assert.ok(folderChip);
		assert.strictEqual(folderChip.hidden, true);
	});

	test('branch chip is hidden when SCM has no HEAD', () => {
		const { slots } = mountLens();
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLElement;

		assert.ok(branchChip);
		assert.strictEqual(branchChip.hidden, true);
		assert.strictEqual(getConversationIdentityBranchName(createEmptyScmService()), undefined);
	});

	test('branch chip shows SCM HEAD when available', () => {
		const { slots } = mountLens({ scmService: createScmServiceWithBranch('loop/B') });
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLElement;

		assert.ok(branchChip);
		assert.strictEqual(branchChip.hidden, false);
		assert.strictEqual(branchChip.textContent, 'loop/B');
	});

	test('identity strip copy does not mention Copilot or Open Chat', () => {
		const { slots } = mountLens({ scmService: createScmServiceWithBranch('main') });
		const text = getIdentityStrip(slots).textContent ?? '';

		assert.ok(!/copilot/i.test(text));
		assert.ok(!/open chat/i.test(text));
	});
});
