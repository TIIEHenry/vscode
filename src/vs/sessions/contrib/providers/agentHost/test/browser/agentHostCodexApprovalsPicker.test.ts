/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../../base/common/errors.js';
import { Event } from '../../../../../../base/common/event.js';
import { constObservable, observableValue } from '../../../../../../base/common/observable.js';
import { URI } from '../../../../../../base/common/uri.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IActionListItem } from '../../../../../../platform/actionWidget/browser/actionList.js';
import { IActionWidgetService } from '../../../../../../platform/actionWidget/browser/actionWidget.js';
import { CodexSessionConfigKey } from '../../../../../../platform/agentHost/common/codexSessionConfigKeys.js';
import { ResolveSessionConfigResult } from '../../../../../../platform/agentHost/common/state/protocol/commands.js';
import { IHoverService } from '../../../../../../platform/hover/browser/hover.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../../../../platform/telemetry/common/telemetryUtils.js';
import { IAgentHostSessionsProvider } from '../../../../../common/agentHostSessionsProvider.js';
import { ISessionsProvidersService } from '../../../../../services/sessions/browser/sessionsProvidersService.js';
import { IActiveSession } from '../../../../../services/sessions/common/sessionsManagement.js';
import { ISessionsService } from '../../../../../services/sessions/browser/sessionsService.js';
import { ISessionsProvider } from '../../../../../services/sessions/common/sessionsProvider.js';
import { AgentHostCodexApprovalsPicker } from '../../browser/agentHostCodexApprovalsPicker.js';
import { IAgentHostSessionEnumPickerItem } from '../../browser/agentHostModePicker.js';

const PROVIDER_ID = 'local-agent-host';
const SESSION_ID = 'local-agent-host:s1';

function makeCodexApprovalsConfig(): ResolveSessionConfigResult {
	return {
		schema: {
			type: 'object',
			properties: {
				[CodexSessionConfigKey.PermissionsPreset]: {
					title: 'Approvals',
					description: '',
					type: 'string',
					enum: ['default', 'auto-review', 'full-access'],
					enumLabels: ['Default Permissions', 'Auto-Review', 'Full Access'],
					enumDescriptions: [
						'Codex can read and edit files in the workspace and run routine local commands.',
						'Same workspace access as Default, but approval requests are routed through the auto-reviewer.',
						'Codex can edit files outside the workspace and use the internet without asking.',
					],
				},
			},
		},
		values: { [CodexSessionConfigKey.PermissionsPreset]: 'default' },
	} as ResolveSessionConfigResult;
}

class FakeProvider implements Pick<IAgentHostSessionsProvider, 'id' | 'onDidChangeSessionConfig' | 'getSessionConfig' | 'setSessionConfigValue' | 'isSessionConfigResolving'> {
	readonly id = PROVIDER_ID;
	readonly onDidChangeSessionConfig: Event<string> = Event.None;
	readonly setCalls: Array<[string, string, unknown]> = [];

	getSessionConfig(_sessionId: string): ResolveSessionConfigResult {
		return makeCodexApprovalsConfig();
	}

	isSessionConfigResolving(_sessionId: string) {
		return constObservable(false);
	}

	async setSessionConfigValue(sessionId: string, property: string, value: unknown): Promise<void> {
		this.setCalls.push([sessionId, property, value]);
	}
}

function setupPicker(store: Pick<ReturnType<typeof ensureNoDisposablesAreLeakedInTestSuite>, 'add'>) {
	const provider = new FakeProvider();
	const actionWidgetItems: IActionListItem<IAgentHostSessionEnumPickerItem>[] = [];
	let onSelect: ((item: IAgentHostSessionEnumPickerItem) => void) | undefined;
	let openCalls = 0;

	const instantiationService = store.add(new TestInstantiationService());
	instantiationService.stub(IActionWidgetService, {
		isVisible: false,
		hide: () => { },
		show: <T>(_id: string, _supportsPreview: boolean, items: IActionListItem<T>[], delegate: { onSelect: (item: T) => void }) => {
			actionWidgetItems.splice(0, actionWidgetItems.length, ...(items as IActionListItem<IAgentHostSessionEnumPickerItem>[]));
			onSelect = delegate.onSelect as (item: IAgentHostSessionEnumPickerItem) => void;
		},
	});
	const sessionObs = observableValue<IActiveSession | undefined>('activeSession', { providerId: PROVIDER_ID, sessionId: SESSION_ID } as IActiveSession);
	instantiationService.set(ISessionsService, new (class extends mock<ISessionsService>() {
		override readonly activeSession = sessionObs;
	})());
	instantiationService.set(ISessionsProvidersService, new (class extends mock<ISessionsProvidersService>() {
		override readonly onDidChangeProviders = Event.None;
		override getProviders(): ISessionsProvider[] { return [provider as unknown as ISessionsProvider]; }
		override getProvider<T extends ISessionsProvider>(id: string): T | undefined {
			return id === provider.id ? provider as unknown as T : undefined;
		}
	})());
	instantiationService.set(IOpenerService, new (class extends mock<IOpenerService>() {
		override async open(_resource: URI | string): Promise<boolean> {
			openCalls++;
			return Promise.reject('boom');
		}
	})());
	instantiationService.stub(ITelemetryService, NullTelemetryService);
	instantiationService.stub(IHoverService, {
		setupDelayedHover: () => ({ dispose: () => { } }),
	} as Partial<IHoverService> as IHoverService);

	const picker = store.add(instantiationService.createInstance(AgentHostCodexApprovalsPicker, sessionObs));
	const container = document.createElement('div');
	picker.render(container);
	container.querySelector<HTMLElement>('a.action-label')?.click();

	return { actionWidgetItems, onSelect: () => onSelect, provider, getOpenCalls: () => openCalls };
}

suite('AgentHostCodexApprovalsPicker', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not leak unhandled rejection when Learn more opener rejects and onUnexpectedError warn-then-rethrows', async () => {
		const { actionWidgetItems, onSelect, provider, getOpenCalls } = setupPicker(store);
		const learnMoreItem = actionWidgetItems.at(-1)?.item;
		const select = onSelect();
		assert.ok(select);
		assert.ok(learnMoreItem);

		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			select(learnMoreItem);
			await timeout(0);
			assert.deepStrictEqual({
				unhandledRejections,
				openCalls: getOpenCalls(),
				unexpectedWarns,
				setCalls: provider.setCalls,
			}, {
				unhandledRejections: [],
				openCalls: 1,
				unexpectedWarns: ['boom', 'boom'],
				setCalls: [],
			});
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
