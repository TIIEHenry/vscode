/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { IInstantiationService, ServicesAccessor } from '../../../../util/vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from '../../../../platform/configuration/common/configurationService';
import { IIgnoreService } from '../../../../platform/ignore/common/ignoreService';
import { ILogService } from '../../../../platform/log/common/logService';
import { IReviewService } from '../../../../platform/review/common/reviewService';

const vscodeMock = vi.hoisted(() => {
	function codeActionKind(value: string): { value: string; append: (part: string) => ReturnType<typeof codeActionKind> } {
		return {
			value,
			append: (part: string) => codeActionKind(`${value}.${part}`),
		};
	}

	class CodeAction {
		title: string;
		kind?: unknown;
		command?: { title: string; command: string; arguments?: unknown[] };
		diagnostics?: readonly unknown[];
		isAI = false;
		constructor(title: string, kind?: unknown) {
			this.title = title;
			this.kind = kind;
		}
	}

	class Selection {
		constructor(public anchor: unknown, public active: unknown) { }
	}

	const config = new Map<string, unknown>();
	const workspace = {
		isAgentSessionsWorkspace: false,
		getConfiguration: (section: string) => ({
			get: (key: string) => config.get(`${section}.${key}`),
		}),
	};
	const executeCommand = vi.fn();
	const registered = new Map<string, (...args: any[]) => unknown>();
	const windowState = {
		activeTextEditor: undefined as unknown,
	};
	const createInstance = vi.fn();
	const invokeFunction = vi.fn();
	return { codeActionKind, CodeAction, Selection, config, workspace, executeCommand, registered, windowState, createInstance, invokeFunction };
});

vi.mock('vscode', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	const source = actual.default && typeof actual.default === 'object'
		? { ...actual, ...(actual.default as Record<string, unknown>) }
		: actual;
	const mocked = {
		...source,
		CodeAction: vscodeMock.CodeAction,
		CodeActionKind: {
			QuickFix: vscodeMock.codeActionKind('quickfix'),
			RefactorRewrite: vscodeMock.codeActionKind('refactor.rewrite'),
			Empty: vscodeMock.codeActionKind(''),
		},
		l10n: { t: (message: string) => message },
		workspace: vscodeMock.workspace,
		window: vscodeMock.windowState,
		Selection: vscodeMock.Selection,
		commands: {
			executeCommand: (...args: unknown[]) => vscodeMock.executeCommand(...args),
			registerCommand: (id: string, callback: (...args: any[]) => unknown) => {
				vscodeMock.registered.set(id, callback);
				return { dispose: () => { vscodeMock.registered.delete(id); } };
			},
		},
		languages: {
			registerCodeActionsProvider: () => ({ dispose() { } }),
			getDiagnostics: () => [],
		},
		notebooks: {
			registerNotebookCellStatusBarItemProvider: () => ({ dispose() { } }),
		},
		ProgressLocation: { Notification: 15 },
		NotebookCellStatusBarAlignment: { Left: 1, Right: 2 },
	};
	return new Proxy(mocked, {
		has: () => true,
		get: (target, prop, receiver) => {
			if (Reflect.has(target, prop)) {
				return Reflect.get(target, prop, receiver);
			}
			return undefined;
		},
	});
});

import { QuickFixesProvider, RefactorsProvider } from '../inlineChatCodeActions';
import { NotebookExectionStatusBarItemProvider } from '../inlineChatNotebookActions';
import { registerInlineChatCommands } from '../inlineChatCommands';

const cancellationToken = { isCancellationRequested: false };

function configurationService(): IConfigurationService {
	return {
		getConfig: vi.fn(() => true),
	} as unknown as IConfigurationService;
}

function ignoreService(): IIgnoreService {
	return {
		isCopilotIgnored: vi.fn(async () => false),
	} as unknown as IIgnoreService;
}

function reviewService(enabled = false): IReviewService {
	return {
		isCodeFeedbackEnabled: () => enabled,
	} as unknown as IReviewService;
}

function document(text: string) {
	return {
		uri: { fsPath: '/tmp/file.ts', toString: () => 'file:///tmp/file.ts' },
		lineCount: 1,
		lineAt: () => ({ text }),
		getText: () => text,
	};
}

function diagnosticRange() {
	return {
		start: { line: 0, character: 0 },
		end: { line: 0, character: 4 },
		union(other: unknown) { return other; },
	};
}

describe('inline chat entries outside the Agents window', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vscodeMock.config.clear();
		vscodeMock.config.set('inlineChat.affordance', 'off');
		vscodeMock.workspace.isAgentSessionsWorkspace = false;
		vscodeMock.windowState.activeTextEditor = {
			selection: { isEmpty: false },
			document: document('const value = 1;'),
		};
		vscodeMock.registered.clear();
		vscodeMock.createInstance.mockImplementation((ctor: { name?: string }) => {
			if (ctor?.name === 'ReviewSession') {
				return { review: vi.fn() };
			}
			return {};
		});
	});

	test('does not offer Fix or Explain code actions in a default Code window', async () => {
		const provider = new QuickFixesProvider(configurationService(), ignoreService(), reviewService());
		const actions = await provider.provideCodeActions(
			document('const value = 1;') as never,
			diagnosticRange() as never,
			{ diagnostics: [{ severity: 1, message: 'bad type', range: diagnosticRange() }] } as never,
			cancellationToken as never,
		);

		expect(actions).toBeUndefined();
		expect(vscodeMock.executeCommand).not.toHaveBeenCalled();
	});

	test('still offers Fix and Explain in the Agents window', async () => {
		vscodeMock.workspace.isAgentSessionsWorkspace = true;
		const provider = new QuickFixesProvider(configurationService(), ignoreService(), reviewService());
		const actions = await provider.provideCodeActions(
			document('const value = 1;') as never,
			diagnosticRange() as never,
			{ diagnostics: [{ severity: 1, message: 'bad type', range: diagnosticRange() }] } as never,
			cancellationToken as never,
		);

		expect(actions?.map(action => action.title)).toEqual(['Fix', 'Explain']);
		expect(actions?.[0].command?.command).toBe('vscode.editorChat.start');
		expect(actions?.[0].command?.arguments?.[0]).toMatchObject({ autoSend: true, message: '/fix bad type' });
		expect(actions?.[1].command?.command).toBe('github.copilot.chat.explain');
		expect(actions?.[1].command?.arguments).toEqual(['/explain bad type']);
	});

	test('does not offer Generate in a default Code window', async () => {
		const provider = new RefactorsProvider(configurationService(), ignoreService());
		const actions = await provider.provideCodeActions(
			document('   ') as never,
			{ isEmpty: true, start: { line: 0, character: 3 }, end: { line: 0, character: 3 } } as never,
			{} as never,
			cancellationToken as never,
		);

		expect(actions).toBeUndefined();
	});

	test('still offers Generate in the Agents window', async () => {
		vscodeMock.workspace.isAgentSessionsWorkspace = true;
		const provider = new RefactorsProvider(configurationService(), ignoreService());
		const actions = await provider.provideCodeActions(
			document('   ') as never,
			{ isEmpty: true, start: { line: 0, character: 3 }, end: { line: 0, character: 3 } } as never,
			{} as never,
			cancellationToken as never,
		);

		expect(actions).toHaveLength(1);
		expect(actions?.[0].title).toBe('Generate');
		expect(actions?.[0].command?.command).toBe('vscode.editorChat.start');
	});

	test('does not show the notebook Fix using Copilot status item in a default Code window', async () => {
		const provider = new NotebookExectionStatusBarItemProvider({} as ILogService);
		const items = await provider.provideCellStatusBarItems(errorCell() as never, cancellationToken as never);

		expect(items).toEqual([]);
		expect(vscodeMock.executeCommand).not.toHaveBeenCalled();
	});

	test('still shows Fix using Copilot on a notebook error in the Agents window', async () => {
		vscodeMock.workspace.isAgentSessionsWorkspace = true;
		const provider = new NotebookExectionStatusBarItemProvider({} as ILogService);
		const items = await provider.provideCellStatusBarItems(errorCell() as never, cancellationToken as never);

		expect(items).toHaveLength(1);
		expect(items[0].tooltip).toBe('Fix using Copilot');
		expect(items[0].command).toMatchObject({
			command: 'vscode.editorChat.start',
			arguments: [{ autoSend: true, message: '/fix Error: boom' }],
		});
	});

	test('explain, generate, and review commands do not open chat in a default Code window', async () => {
		const disposable = registerCommands();

		await vscodeMock.registered.get('github.copilot.chat.explain')!('what is this');
		await vscodeMock.registered.get('github.copilot.chat.generate')!();
		await vscodeMock.registered.get('github.copilot.chat.review')!();
		await vscodeMock.registered.get('github.copilot.chat.fix')!();
		await vscodeMock.registered.get('github.copilot.chat.generateAltText')!({ isUrl: false, resolvedImagePath: '/tmp/a.png', type: 'generate' });
		await vscodeMock.registered.get('github.copilot.chat.review.continueInChat')!({} as never);
		await vscodeMock.registered.get('github.copilot.chat.codeReview.run')!({} as never);

		expect(vscodeMock.executeCommand).not.toHaveBeenCalled();
		expect(vscodeMock.createInstance).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'ReviewSession' }));
		expect(vscodeMock.invokeFunction).not.toHaveBeenCalled();
		disposable.dispose();
	});

	test('explain, generate, and review commands still run in the Agents window', async () => {
		vscodeMock.workspace.isAgentSessionsWorkspace = true;
		const review = vi.fn();
		vscodeMock.createInstance.mockImplementation((ctor: { name?: string }) => {
			if (ctor?.name === 'ReviewSession') {
				return { review };
			}
			return {};
		});
		const disposable = registerCommands();

		await vscodeMock.registered.get('github.copilot.chat.explain')!('what is this');
		await vscodeMock.registered.get('github.copilot.chat.generate')!();
		await vscodeMock.registered.get('github.copilot.chat.review')!();

		expect(vscodeMock.executeCommand).toHaveBeenCalledWith('workbench.action.chat.open', { query: 'what is this' });
		expect(vscodeMock.executeCommand).toHaveBeenCalledWith('vscode.editorChat.start', { message: '/generate ' });
		expect(review).toHaveBeenCalledWith('selection', 15);
		disposable.dispose();
	});
});

function errorCell() {
	return {
		kind: 2,
		index: 0,
		document: { getText: () => 'print(1)' },
		outputs: [{
			items: [{
				mime: 'application/vnd.code.notebook.error',
				data: new TextEncoder().encode(JSON.stringify({ name: 'Error', message: 'boom' })),
			}],
		}],
	};
}

function registerCommands() {
	const accessor: ServicesAccessor = {
		get: (<T>(id: unknown) => {
			if (id === IInstantiationService) {
				return {
					createInstance: vscodeMock.createInstance,
					invokeFunction: vscodeMock.invokeFunction,
				} as T;
			}
			return {} as T;
		}) as ServicesAccessor['get'],
	};
	return registerInlineChatCommands(accessor);
}
