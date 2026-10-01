/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
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
import { FIX_CI_CHECKS_COMMAND_ID } from '../../browser/checksActions.js';

suite('Fix CI checks command', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('fix CI command notifies when the chat widget is missing', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
		const notices: string[] = [];
		const sessionResource = URI.parse('local-agent-host:/session-1');
		const accessor: ServicesAccessor = {
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
		};

		const command = CommandsRegistry.getCommand(FIX_CI_CHECKS_COMMAND_ID);
		assert.ok(command);
		await command.handler(accessor);
		assert.deepStrictEqual(notices, ['Can\'t fix CI checks because the chat for this session isn\'t available.']);
	}));
});
