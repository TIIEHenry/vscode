/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationRosterService } from './conversationStubService.js';
import { shouldRestoreLastSessionOnStartup } from '../common/uaClientSettingsHelpers.js';

class UaClientStartupContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.uaClientStartup';

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
	) {
		super();

		if (this.environmentService.isSessionsWindow) {
			return;
		}

		const sessions = this.rosterService.getSessions();
		if (sessions.length > 0) {
			if (shouldRestoreLastSessionOnStartup(this.configurationService)) {
				const activeId = this.rosterService.getActiveSessionId();
				if (!sessions.some(session => session.id === activeId)) {
					this.rosterService.switchSession(sessions[0].id);
				}
			} else if (this.rosterService.getActiveSessionId() !== sessions[0].id) {
				this.rosterService.switchSession(sessions[0].id);
			}
		}
	}
}

registerWorkbenchContribution2(UaClientStartupContribution.ID, UaClientStartupContribution, WorkbenchPhase.AfterRestored);
