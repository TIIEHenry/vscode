/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { URI } from '../../../../base/common/uri.js';
import { shouldConfirmBeforeExternalOpen } from '../common/uaClientSettingsHelpers.js';

export async function openUaClientExternalLink(
	uri: URI,
	configurationService: IConfigurationService,
	dialogService: IDialogService,
	openerService: IOpenerService,
): Promise<void> {
	if (shouldConfirmBeforeExternalOpen(configurationService)) {
		const confirmed = await dialogService.confirm({
			message: localize('ua.client.externalOpenConfirmTitle', "Open external link?"),
			detail: uri.toString(true),
			primaryButton: localize('ua.client.externalOpenConfirmOpen', "Open"),
		});
		if (!confirmed.confirmed) {
			return;
		}
	}
	await openerService.open(uri, { allowCommands: false, openExternal: true });
}
