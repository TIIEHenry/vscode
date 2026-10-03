/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationError } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IChatWidgetService } from '../../../../../workbench/contrib/chat/browser/chat.js';
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { IGitHubService } from '../../../github/browser/githubService.js';
import { GitHubCheckConclusion, GitHubCheckStatus } from '../../../github/common/types.js';
import { FIX_CI_CHECKS_COMMAND_ID } from '../../browser/checksActions.js';

suite('Fix CI checks command', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('fix CI command notifies when the chat widget is missing', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
		const notices: string[] = [];
		const sessionResource = URI.parse('local-agent-host:/session-1');
		const accessor = {
			get(id: unknown) {
				if (id === ISessionsService) {
					return { activeSession: observableValue('active', { resource: sessionResource }) };
				}
				if (id === IGitHubService) {
					return { activeSessionPullRequestCIObs: observableValue('ci', {}) };
				}
				if (id === IChatWidgetService) {
					return {
						onDidAddWidget: Event.None,
						getAllWidgets: () => [],
						getWidgetBySessionResource: () => undefined,
					};
				}
				if (id === ILogService) {
					return new NullLogService();
				}
				if (id === INotificationService) {
					return {
						error(message: string | Error): void {
							notices.push(typeof message === 'string' ? message : message.message);
						},
					};
				}
				throw new Error('unexpected service');
			},
		} as unknown as ServicesAccessor;

		const command = CommandsRegistry.getCommand(FIX_CI_CHECKS_COMMAND_ID);
		assert.ok(command);
		await command.handler(accessor);
		assert.deepStrictEqual(notices, ['Can\'t fix CI checks because the chat for this session isn\'t available.']);
	}));

	test('fix CI command notifies when check annotations fail to load', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
		const notices: string[] = [];
		const sessionResource = URI.parse('local-agent-host:/session-1');
		let marked = false;
		let sent = false;
		const accessor = fixCIAccessor({
			sessionResource,
			notices,
			annotationsError: new Error('annotations down'),
			onMark: () => { marked = true; },
			onSend: () => { sent = true; },
		});

		const command = CommandsRegistry.getCommand(FIX_CI_CHECKS_COMMAND_ID);
		assert.ok(command);
		await command.handler(accessor);
		assert.deepStrictEqual(notices, ['Couldn\'t fix CI checks: annotations down']);
		assert.strictEqual(sent, false);
		assert.strictEqual(marked, false);
	}));

	test('fix CI command stays quiet when annotation loading is cancelled', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
		const notices: string[] = [];
		const sessionResource = URI.parse('local-agent-host:/session-1');
		let marked = false;
		const accessor = fixCIAccessor({
			sessionResource,
			notices,
			annotationsError: new CancellationError(),
			onMark: () => { marked = true; },
			onSend: () => { },
		});

		const command = CommandsRegistry.getCommand(FIX_CI_CHECKS_COMMAND_ID);
		assert.ok(command);
		await command.handler(accessor);
		assert.deepStrictEqual(notices, []);
		assert.strictEqual(marked, false);
	}));
});

function fixCIAccessor(options: {
	readonly sessionResource: URI;
	readonly notices: string[];
	readonly annotationsError: Error;
	readonly onMark: () => void;
	readonly onSend: () => void;
}): ServicesAccessor {
	const failedCheck = {
		id: 9,
		name: 'build',
		status: GitHubCheckStatus.Completed,
		conclusion: GitHubCheckConclusion.Failure,
		startedAt: undefined,
		completedAt: undefined,
		detailsUrl: undefined,
	};
	return {
		get(id: unknown) {
			if (id === ISessionsService) {
				return { activeSession: observableValue('active', { resource: options.sessionResource }) };
			}
			if (id === IGitHubService) {
				return {
					activeSessionPullRequestCIObs: observableValue('ci', {
						owner: 'octo',
						repo: 'repo',
						prNumber: 7,
						checks: { get: () => [failedCheck] },
						getCheckRunAnnotations: async () => { throw options.annotationsError; },
						markFixRequested: () => options.onMark(),
					}),
				};
			}
			if (id === IChatWidgetService) {
				return {
					onDidAddWidget: Event.None,
					getAllWidgets: () => [],
					getWidgetBySessionResource: () => ({
						acceptInput: async () => {
							options.onSend();
							return {};
						},
					}),
				};
			}
			if (id === ILogService) {
				return new NullLogService();
			}
			if (id === INotificationService) {
				return {
					error(message: string | Error): void {
						options.notices.push(typeof message === 'string' ? message : message.message);
					},
				};
			}
			throw new Error('unexpected service');
		},
	} as unknown as ServicesAccessor;
}
