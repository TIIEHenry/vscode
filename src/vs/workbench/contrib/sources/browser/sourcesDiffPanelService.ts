/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ISourcesChangeRef } from '../common/sourcesChangeRef.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';

export class SourcesDiffPanelService extends Disposable implements ISourcesDiffPanelService {

	declare readonly _serviceBrand: undefined;

	async show(_ref: ISourcesChangeRef): Promise<void> {
		// F3: Panel product Diff view
	}

	clear(): void {
		// F3: Panel product Diff view
	}
}

registerSingleton(ISourcesDiffPanelService, SourcesDiffPanelService, InstantiationType.Delayed);
