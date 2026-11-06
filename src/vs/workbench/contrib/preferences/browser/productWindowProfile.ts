/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IProductWindowProfile } from '../../../services/productShell/common/productWindowProfile.js';
import { parseQuery } from './settingsTreeModels.js';

export class ProductWindowProfile implements IProductWindowProfile {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
	) { }

	get isSessionsWindow(): boolean {
		return this.environmentService.isSessionsWindow;
	}

	isClientSettingsView(query: string, categoryId: string | undefined): boolean {
		if (this.isSessionsWindow) {
			return false;
		}
		const { idFilters } = parseQuery(query);
		if (idFilters.length) {
			return idFilters.every(id => id.startsWith('ua.client.'));
		}
		return !query.trim() && (categoryId === 'ua' || !!categoryId?.startsWith('ua/'));
	}
}
