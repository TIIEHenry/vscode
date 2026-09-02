/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { shouldAdvertiseWorkspaceTools } from '../common/uaClientSettingsHelpers.js';

export const IUaClientWorkspaceToolsGate = createDecorator<IUaClientWorkspaceToolsGate>('uaClientWorkspaceToolsGate');

/** Client-side gate for advertising IDE workspace tools to a connected Engine. */
export interface IUaClientWorkspaceToolsGate {
	readonly _serviceBrand: undefined;
	shouldAdvertise(): boolean;
}

class UaClientWorkspaceToolsGate implements IUaClientWorkspaceToolsGate {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) { }

	shouldAdvertise(): boolean {
		return shouldAdvertiseWorkspaceTools(this.configurationService);
	}
}

registerSingleton(IUaClientWorkspaceToolsGate, UaClientWorkspaceToolsGate, InstantiationType.Delayed);
