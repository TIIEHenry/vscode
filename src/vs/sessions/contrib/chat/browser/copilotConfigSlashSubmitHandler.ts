/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { parseLeadingSlashCommand } from '../../../../platform/agentHost/common/agentHostSlashCommand.js';
import { resolveCopilotConfigSlashCommandOnSend } from '../../../../platform/agentHost/common/copilotConfigSlashCommands.js';
import { IChatSubmitRequestHandlerService, type IChatSubmitRequest } from '../../../../workbench/contrib/chat/browser/chatSubmitRequestHandlerService.js';
import { applyAgentHostCompletionAction } from '../../../../workbench/contrib/chat/browser/agentHostCompletionAction.js';
import { SessionType } from '../../../../workbench/contrib/chat/common/chatSessionsService.js';
import { getChatSessionType } from '../../../../workbench/contrib/chat/common/model/chatUri.js';
import { IWorkbenchContribution } from '../../../../workbench/common/contributions.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { isAgentHostProvider } from '../../../common/agentHostSessionsProvider.js';
import { ISessionsProvidersService } from '../../../services/sessions/browser/sessionsProvidersService.js';
import { ISessionsManagementService } from '../../../services/sessions/common/sessionsManagement.js';
import { ISessionsProvider } from '../../../services/sessions/common/sessionsProvider.js';

/**
 * `ignore` — not a Copilot config slash; other submit handlers may run.
 * `declined` — the user cancelled the elevated-permission confirmation.
 * `handled` — a pure toggle was applied; do not send.
 * `forward` — config was applied and the original text should still be sent.
 */
export type CopilotConfigSlashSubmitOutcome = 'ignore' | 'declined' | 'handled' | 'forward';

export interface ISessionsCopilotConfigSlashTarget {
	readonly sessionResource: URI;
	readonly providerId: string | undefined;
	readonly sessionId: string | undefined;
	readonly input: string;
}

export interface ISessionsCopilotConfigSlashServices {
	getProvider(providerId: string): ISessionsProvider | undefined;
	readonly dialogService: IDialogService;
	readonly storageService: IStorageService;
}

/**
 * Applies a leading Copilot config slash (`/yolo`, `/plan`, …) before send.
 * A cancelled elevated confirmation is `declined` and must not be treated as
 * a consumed empty prompt: the caller keeps the draft and does not send.
 */
export async function trySessionsCopilotConfigSlashSubmit(target: ISessionsCopilotConfigSlashTarget, services: ISessionsCopilotConfigSlashServices): Promise<CopilotConfigSlashSubmitOutcome> {
	if (getChatSessionType(target.sessionResource) !== SessionType.AgentHostCopilot) {
		return 'ignore';
	}
	const slashCommand = parseLeadingSlashCommand(target.input);
	const configAction = slashCommand ? resolveCopilotConfigSlashCommandOnSend(slashCommand.command, slashCommand.rawRest) : undefined;
	if (!configAction) {
		return 'ignore';
	}
	const providerId = target.providerId;
	const sessionId = target.sessionId;
	if (!providerId || !sessionId) {
		return 'ignore';
	}
	const provider = services.getProvider(providerId);
	if (!provider || !isAgentHostProvider(provider)) {
		return 'ignore';
	}
	const applied = await applyAgentHostCompletionAction({ applyConfig: configAction.applyConfig }, services.dialogService, services.storageService, async config => {
		await Promise.all(Object.entries(config).map(([key, value]) => provider.setSessionConfigValue(sessionId, key, value)));
	});
	if (!applied) {
		return 'declined';
	}
	return configAction.strippedPrompt ? 'forward' : 'handled';
}

export class SessionsCopilotConfigSlashSubmitHandlerContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'sessions.contrib.chat.copilotConfigSlashSubmitHandler';

	constructor(
		@IChatSubmitRequestHandlerService submitRequestHandlerService: IChatSubmitRequestHandlerService,
		@ISessionsManagementService private readonly _sessionsManagementService: ISessionsManagementService,
		@ISessionsProvidersService private readonly _sessionsProvidersService: ISessionsProvidersService,
		@IDialogService private readonly _dialogService: IDialogService,
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();
		this._register(submitRequestHandlerService.register({
			id: 'sessions.copilot.configSlash',
			tryHandle: request => this._tryHandle(request),
		}));
	}

	private async _tryHandle(request: IChatSubmitRequest): Promise<boolean> {
		const session = this._sessionsManagementService.getSession(request.sessionResource);
		const outcome = await trySessionsCopilotConfigSlashSubmit({
			sessionResource: request.sessionResource,
			providerId: session?.providerId ?? request.providerId,
			sessionId: session?.sessionId ?? request.sessionId,
			input: request.input,
		}, {
			getProvider: providerId => this._sessionsProvidersService.getProvider(providerId),
			dialogService: this._dialogService,
			storageService: this._storageService,
		});
		// Declined must not fall through to send. ChatWidget still clears when
		// this returns true; NewChatInputWidget decides before tryHandle and
		// keeps the draft.
		return outcome === 'handled' || outcome === 'declined';
	}
}
