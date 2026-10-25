/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationResolverService } from '../../../../services/configurationResolver/common/configurationResolver.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { IOutputService } from '../../../../services/output/common/output.js';
import { IPaneCompositePartService } from '../../../../services/panecomposite/browser/panecomposite.js';
import { IPathService } from '../../../../services/path/common/pathService.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { TestViewsService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ITerminalGroupService, ITerminalService } from '../../../terminal/browser/terminal.js';
import { ITerminalProfileResolverService } from '../../../terminal/common/terminal.js';
import { AbstractTaskService } from '../../browser/abstractTaskService.js';
import { TerminalTaskSystem } from '../../browser/terminalTaskSystem.js';
import { ITaskResolver, ITaskSummary, Triggers, VerifiedTask } from '../../common/taskSystem.js';
import { CUSTOMIZED_TASK_TYPE, CustomTask, DependsOrder, PanelKind, RevealKind, RevealProblemKind, RuntimeType, TaskSourceKind } from '../../common/tasks.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IMarkerService } from '../../../../../platform/markers/common/markers.js';
import { IWorkspaceContextService, WorkspaceFolder } from '../../../../../platform/workspace/common/workspace.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IViewDescriptorService, ViewContainerLocation } from '../../../../common/views.js';
import { ITaskService } from '../../common/taskService.js';

const workspaceFolder = new WorkspaceFolder({ uri: URI.file('/workspace/folderOne'), name: 'folderOne', index: 0 });

const taskSource = {
	kind: TaskSourceKind.Workspace,
	label: 'workspace',
	config: { workspaceFolder, element: undefined, index: -1, file: '/workspace/folderOne/.vscode/tasks.json' }
} as const;

function createTask(name: string, options: { command?: boolean; dependsOn?: { uri: URI; task: string }[]; dependsOrder?: DependsOrder }): CustomTask {
	return new CustomTask(
		name,
		taskSource,
		name,
		CUSTOMIZED_TASK_TYPE,
		options.command === false ? undefined : {
			name: 'echo',
			runtime: RuntimeType.Shell,
			args: [],
			presentation: {
				echo: true,
				reveal: RevealKind.Silent,
				revealProblems: RevealProblemKind.Never,
				focus: false,
				panel: PanelKind.Shared,
				showReuseMessage: true,
				clear: false,
				close: false
			}
		},
		false,
		{ reevaluateOnRerun: false },
		{
			name,
			isBackground: false,
			promptOnClose: true,
			problemMatchers: [],
			dependsOn: options.dependsOn,
			dependsOrder: options.dependsOrder,
		}
	);
}

type TaskSystemPrivates = {
	_executeTask(task: CustomTask, resolver: ITaskResolver, trigger: string, liveDependencies: Set<string>, encounteredTasks: Map<string, Promise<ITaskSummary>>, thisRun: VerifiedTask, alreadyResolved?: Map<string, string>): Promise<ITaskSummary>;
	_executeCommand(...args: unknown[]): Promise<ITaskSummary>;
};

suite('TerminalTaskSystem dependency resolution failure', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let taskSystem: TerminalTaskSystem;
	let privates: TaskSystemPrivates;

	setup(() => {
		instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(ITerminalService, { onDidChangeActiveInstance: Event.None } as Partial<ITerminalService> as ITerminalService);
		instantiationService.stub(IOutputService, { showChannel: () => { }, getChannel: () => undefined } as unknown as IOutputService);
		instantiationService.stub(IConfigurationResolverService, {} as IConfigurationResolverService);
		instantiationService.stub(ITaskService, { onDidStateChange: Event.None });
		instantiationService.stub(IViewsService, new TestViewsService());
		instantiationService.stub(IViewDescriptorService, { getViewLocationById: () => ViewContainerLocation.Panel } as Partial<IViewDescriptorService> as IViewDescriptorService);

		taskSystem = store.add(new TerminalTaskSystem(
			instantiationService.get(ITerminalService),
			instantiationService.get(ITerminalGroupService),
			instantiationService.get(IOutputService),
			instantiationService.get(IPaneCompositePartService),
			instantiationService.get(IViewsService),
			instantiationService.get(IMarkerService),
			instantiationService.get(IModelService),
			instantiationService.get(IConfigurationResolverService),
			instantiationService.get(IWorkspaceContextService),
			instantiationService.get(IWorkbenchEnvironmentService),
			AbstractTaskService.OutputChannelId,
			instantiationService.get(IFileService),
			instantiationService.get(ITerminalProfileResolverService),
			instantiationService.get(IPathService),
			instantiationService.get(IViewDescriptorService),
			instantiationService.get(ILogService),
			instantiationService.get(INotificationService),
			instantiationService.get(IContextKeyService),
			instantiationService.get(IInstantiationService),
			() => undefined,
			async () => undefined,
		));
		privates = taskSystem as unknown as TaskSystemPrivates;
	});

	function run(task: CustomTask, resolver: ITaskResolver): Promise<ITaskSummary> {
		return privates._executeTask(task, resolver, Triggers.command, new Set(), new Map(), new VerifiedTask(task, resolver, Triggers.command));
	}

	test('a dependency that cannot be resolved fails a parent without a command', async () => {
		const task = createTask('parent', {
			command: false,
			dependsOn: [{ uri: URI.file('/workspace/folderOne/.vscode/tasks.json'), task: 'missing' }],
		});
		const resolver: ITaskResolver = { resolve: async () => undefined };

		const summary = await run(task, resolver);

		assert.notStrictEqual(summary.exitCode, 0);
	});

	test('a dependency that cannot be resolved does not execute a parent command', async () => {
		let commands = 0;
		privates._executeCommand = async () => {
			commands++;
			return { exitCode: 0 };
		};
		const task = createTask('parent', {
			dependsOn: [{ uri: URI.file('/workspace/folderOne/.vscode/tasks.json'), task: 'missing' }],
		});
		const resolver: ITaskResolver = { resolve: async () => undefined };

		const summary = await run(task, resolver);

		assert.notStrictEqual(summary.exitCode, 0);
		assert.strictEqual(commands, 0);
	});

	test('sequence stops resolving after a dependency fails', async () => {
		const resolved: string[] = [];
		const resolver: ITaskResolver = {
			resolve: async (_uri, identifier) => {
				resolved.push(String(identifier));
				return undefined;
			},
		};
		const task = createTask('parent', {
			command: false,
			dependsOrder: DependsOrder.sequence,
			dependsOn: [
				{ uri: URI.file('/workspace/folderOne/.vscode/tasks.json'), task: 'first' },
				{ uri: URI.file('/workspace/folderOne/.vscode/tasks.json'), task: 'second' },
			],
		});

		const summary = await run(task, resolver);

		assert.notStrictEqual(summary.exitCode, 0);
		assert.deepStrictEqual(resolved, ['first']);
	});
});
