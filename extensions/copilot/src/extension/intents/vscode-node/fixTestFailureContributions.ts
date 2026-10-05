/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as l10n from '@vscode/l10n';
import * as vscode from 'vscode';
import { ConfigKey, IConfigurationService } from '../../../platform/configuration/common/configurationService';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry';
import { ITestFailure, ITestProvider } from '../../../platform/testing/common/testProvider';
import { mapFindFirst } from '../../../util/vs/base/common/arraysFind';
import { Disposable, DisposableStore } from '../../../util/vs/base/common/lifecycle';
import { Intent } from '../../common/constants';
import { IExtensionContribution } from '../../common/contributions';

/** Fix-test-failure entries that open Inline Chat belong to the Agents window. */
export function isFixTestFailureChatAllowed(isAgentSessionsWorkspace: boolean | undefined): boolean {
	return isAgentSessionsWorkspace === true;
}

export const FIX_TEST_FAILURE_INLINE_CHAT_MESSAGE = `/${Intent.Fix} the #testFailure`;

export async function runFixTestFailureChat(options: {
	isAgentSessionsWorkspace: boolean | undefined;
	testUri: object | undefined;
	openAndStartInlineChat: () => Promise<void>;
	sendTelemetry: () => void;
}): Promise<boolean> {
	if (!isFixTestFailureChatAllowed(options.isAgentSessionsWorkspace) || !options.testUri) {
		return false;
	}
	options.sendTelemetry();
	await options.openAndStartInlineChat();
	return true;
}

export function shouldProvideFixTestFailureCodeAction(options: {
	isAgentSessionsWorkspace: boolean | undefined;
	codeActionsEnabled: boolean;
	hasFailure: boolean;
}): boolean {
	return isFixTestFailureChatAllowed(options.isAgentSessionsWorkspace)
		&& options.codeActionsEnabled
		&& options.hasFailure;
}

export class FixTestFailureContribution extends Disposable implements IExtensionContribution {
	constructor(
		@ITestProvider testProvider: ITestProvider,
		@ITelemetryService telemetryService: ITelemetryService,
		@IConfigurationService configurationService: IConfigurationService,
	) {
		super();
		const store = this._register(new DisposableStore());
		registerTestMessageSparkles(store, telemetryService, testProvider);
		registerTestFailureCodeAction(testProvider, configurationService, store);
	}
}

type FixCommandArgs = { message: vscode.TestMessage; test: vscode.TestItem | vscode.TestResultSnapshot; source?: 'sparkles' | 'testResultsPanel' | 'retry' };

function registerTestMessageSparkles(store: DisposableStore, telemetryService: ITelemetryService, testProvider: ITestProvider) {
	function getLastFailureForItemOrChildren(item: vscode.TestItem): ITestFailure | undefined {
		const failure = testProvider.getLastFailureFor(item);
		return failure || mapFindFirst(item.children, ([, item]) => getLastFailureForItemOrChildren(item));
	}

	store.add(vscode.commands.registerCommand('github.copilot.tests.fixTestFailure.fromInline', (item: vscode.TestItem) => {
		if (!isFixTestFailureChatAllowed(vscode.workspace.isAgentSessionsWorkspace)) {
			return;
		}
		const failure = getLastFailureForItemOrChildren(item);
		if (failure) {
			openFixChat({
				message: failure.task.messages[0],
				test: failure.snapshot,
				source: 'testResultsPanel',
			});
		}
	}));

	store.add(vscode.commands.registerCommand('github.copilot.tests.fixTestFailure', openFixChat));

	async function openFixChat(args: FixCommandArgs) {
		const testUri = args.test.uri;
		await runFixTestFailureChat({
			isAgentSessionsWorkspace: vscode.workspace.isAgentSessionsWorkspace,
			testUri,
			sendTelemetry: () => {
				/* __GDPR__
				"intent.fixTestFailure.actioned" : {
					"owner": "connor4312",
					"comment": "Reports when we show a ",
					"source": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "Where the action was taken" }
				}
				*/
				telemetryService.sendMSFTTelemetryEvent('intent.fixTestFailure.actioned', {
					source: args.source ?? 'testResultsPanel',
				});
			},
			openAndStartInlineChat: async () => {
				if (!testUri) {
					return;
				}
				const doc = await vscode.workspace.openTextDocument(testUri);
				await vscode.window.showTextDocument(doc, {
					preserveFocus: false, // must transfer focus so editor chat starts at the right place
					preview: true,
					selection: args.test.range ? new vscode.Range(args.test.range.start, args.test.range.start) : undefined
				});

				await vscode.commands.executeCommand('vscode.editorChat.start', {
					message: FIX_TEST_FAILURE_INLINE_CHAT_MESSAGE,
					autoSend: true,
				});
			},
		});
	}
}

function registerTestFailureCodeAction(testProvider: ITestProvider, configurationService: IConfigurationService, store: DisposableStore) {
	store.add(vscode.languages.registerCodeActionsProvider('*', {
		provideCodeActions(document, range, context, token) {
			const isAgentSessionsWorkspace = vscode.workspace.isAgentSessionsWorkspace;
			const copilotCodeActionsEnabled = configurationService.getConfig(ConfigKey.EnableCodeActions);
			const test = isFixTestFailureChatAllowed(isAgentSessionsWorkspace) && copilotCodeActionsEnabled
				? testProvider.getFailureAtPosition(document.uri, range.start)
				: undefined;
			if (!shouldProvideFixTestFailureCodeAction({
				isAgentSessionsWorkspace,
				codeActionsEnabled: copilotCodeActionsEnabled,
				hasFailure: !!test,
			}) || !test) {
				return;
			}

			const ca = new vscode.CodeAction(l10n.t('Fix test failure'), vscode.CodeActionKind.QuickFix);
			ca.isAI = true;
			ca.command = {
				title: l10n.t('Fix test failure'),
				command: 'github.copilot.tests.fixTestFailure',
				arguments: [{
					message: test.task.messages[0],
					test: test.snapshot,
					source: 'sparkles',
				} satisfies FixCommandArgs]
			};
			return [ca];
		},
	}));
}

