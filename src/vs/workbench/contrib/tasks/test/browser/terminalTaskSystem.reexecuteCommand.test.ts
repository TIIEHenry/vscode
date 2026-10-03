/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Platform } from '../../../../../base/common/platform.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
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
import { IConfigurationResolverService } from '../../../../services/configurationResolver/common/configurationResolver.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { IOutputService } from '../../../../services/output/common/output.js';
import { IPaneCompositePartService } from '../../../../services/panecomposite/browser/panecomposite.js';
import { IPathService } from '../../../../services/path/common/pathService.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { workbenchInstantiationService, TestViewsService } from '../../../../test/browser/workbenchTestServices.js';
import { ITerminalGroupService, ITerminalService } from '../../../terminal/browser/terminal.js';
import { ITerminalProfileResolverService } from '../../../terminal/common/terminal.js';
import { AbstractTaskService } from '../../browser/abstractTaskService.js';
import { TerminalTaskSystem } from '../../browser/terminalTaskSystem.js';
import { ITaskResolver, ITaskSummary, ITaskSystemInfo, Triggers, VerifiedTask } from '../../common/taskSystem.js';
import { CUSTOMIZED_TASK_TYPE, CustomTask, PanelKind, RevealKind, RevealProblemKind, RuntimeType, TaskSourceKind } from '../../common/tasks.js';
import { ITaskService } from '../../common/taskService.js';

class TestViewDescriptorService implements Partial<IViewDescriptorService> {
	getViewLocationById(_id: string): ViewContainerLocation {
		return ViewContainerLocation.Panel;
	}
}

const workspaceFolder = new WorkspaceFolder({
	uri: URI.file('/workspace/folderOne'),
	name: 'folderOne',
	index: 0
});

const taskSource = {
	kind: TaskSourceKind.Workspace,
	label: 'workspace',
	config: { workspaceFolder, element: undefined, index: -1, file: '/workspace/folderOne/.vscode/tasks.json' }
} as const;

const shellCommandWithInput = 'echo ${workspaceFolder} ${input:foo}';

function createShellTask(commandLine: string): CustomTask {
	return new CustomTask(
		'reexecute-test',
		taskSource,
		'reexecute-test',
		CUSTOMIZED_TASK_TYPE,
		{
			name: commandLine,
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
			name: 'reexecute-test',
			isBackground: false,
			promptOnClose: true,
			problemMatchers: []
		}
	);
}

function createVerifiedLastTask(task: CustomTask, variableMap: Map<string, string>): VerifiedTask {
	const verified = new VerifiedTask(task, {} as ITaskResolver, Triggers.command);
	verified.resolvedVariables = { variables: new Map(variableMap) };
	verified.workspaceFolder = workspaceFolder;
	verified.shellLaunchConfig = {};
	verified.systemInfo = {
		platform: Platform.Linux,
		context: undefined,
		uriProvider: (path: string) => URI.file(path),
		resolveVariables: async () => undefined,
		findExecutable: async () => undefined
	} satisfies ITaskSystemInfo;
	return verified;
}

type ReexecutePrivates = {
	_reexecuteCommand(task: CustomTask, trigger: string, alreadyResolved: Map<string, string>, thisRun: VerifiedTask): Promise<ITaskSummary>;
	_acquireInput(...args: unknown[]): Promise<unknown>;
	_executeInTerminal(...args: unknown[]): Promise<ITaskSummary>;
};

suite('TerminalTaskSystem _reexecuteCommand reevaluateOnRerun', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let taskSystem: TerminalTaskSystem;
	let acquireInputCalls: Map<string, string>[];
	let executeInTerminalCalls: number;
	let privates: ReexecutePrivates;

	setup(() => {
		acquireInputCalls = [];
		executeInTerminalCalls = 0;

		instantiationService = workbenchInstantiationService(undefined, store);
		const terminalActiveEmitter = store.add(new Emitter<unknown>());
		instantiationService.stub(ITerminalService, {
			onDidChangeActiveInstance: terminalActiveEmitter.event,
		} as Partial<ITerminalService> as ITerminalService);
		instantiationService.stub(IOutputService, {
			showChannel: () => { },
		} as unknown as IOutputService);
		instantiationService.stub(IConfigurationResolverService, {} as IConfigurationResolverService);
		instantiationService.stub(ITaskService, { onDidStateChange: Event.None });
		instantiationService.stub(IViewsService, new TestViewsService());
		instantiationService.stub(IViewDescriptorService, new TestViewDescriptorService());

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

		privates = taskSystem as unknown as ReexecutePrivates;
		privates._acquireInput = async (...args: unknown[]) => {
			const alreadyResolved = args[4] as Map<string, string>;
			acquireInputCalls.push(new Map(alreadyResolved));
			const merged = new Map(alreadyResolved);
			merged.set('input:foo', 'user-input');
			return { variables: merged };
		};
		privates._executeInTerminal = async () => {
			executeInTerminalCalls++;
			return { exitCode: 0 };
		};
	});

	test('_reexecuteCommand calls _acquireInput for missing variables and preserves prior map entries', async () => {
		const task = createShellTask(shellCommandWithInput);
		const lastTask = createVerifiedLastTask(task, new Map([['workspaceFolder', '/workspace/folderOne']]));
		taskSystem.lastTask = lastTask;

		const thisRun = new VerifiedTask(task, {} as ITaskResolver, Triggers.command);
		await privates._reexecuteCommand(task, Triggers.command, new Map(), thisRun);

		assert.strictEqual(acquireInputCalls.length, 1);
		assert.strictEqual(acquireInputCalls[0].get('workspaceFolder'), '/workspace/folderOne');
		assert.strictEqual(executeInTerminalCalls, 1);
	});

	test('_reexecuteCommand skips _acquireInput when all variables are already resolved', async () => {
		const task = createShellTask(shellCommandWithInput);
		const lastTask = createVerifiedLastTask(task, new Map([
			['workspaceFolder', '/workspace/folderOne'],
			['input:foo', 'prior'],
		]));
		taskSystem.lastTask = lastTask;

		const thisRun = new VerifiedTask(task, {} as ITaskResolver, Triggers.command);
		await privates._reexecuteCommand(task, Triggers.command, new Map(), thisRun);

		assert.strictEqual(acquireInputCalls.length, 0);
		assert.strictEqual(executeInTerminalCalls, 1);
		assert.strictEqual(thisRun.resolvedVariables, lastTask.resolvedVariables);
	});

	test('_reexecuteCommand does not re-acquire when input:foo is in the resolved variables map', async () => {
		const task = createShellTask('echo ${input:foo}');
		const lastTask = createVerifiedLastTask(task, new Map([
			['workspaceFolder', '/workspace/folderOne'],
			['input:foo', 'saved'],
		]));
		taskSystem.lastTask = lastTask;

		const thisRun = new VerifiedTask(task, {} as ITaskResolver, Triggers.command);
		await privates._reexecuteCommand(task, Triggers.command, new Map(), thisRun);

		assert.strictEqual(acquireInputCalls.length, 0);
		assert.strictEqual(executeInTerminalCalls, 1);
	});
});
