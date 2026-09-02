/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IContextKey, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ISourcesChangeRef } from '../common/sourcesChangeRef.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { SOURCES_DIFF_PANEL_VIEW_ID } from './sourcesDiffPanelIds.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';

export class SourcesDiffPanelService extends Disposable implements ISourcesDiffPanelService {

	static readonly ctxHasChange = new RawContextKey<boolean>('sourcesDiffPanel.hasChange', false);

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeRef = this._register(new Emitter<ISourcesChangeRef | undefined>());
	readonly onDidChangeRef: Event<ISourcesChangeRef | undefined> = this._onDidChangeRef.event;

	private readonly _ctxHasChange: IContextKey<boolean>;
	private _currentRef: ISourcesChangeRef | undefined;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewsService private readonly viewsService: IViewsService,
	) {
		super();
		this._ctxHasChange = SourcesDiffPanelService.ctxHasChange.bindTo(contextKeyService);
	}

	getCurrentRef(): ISourcesChangeRef | undefined {
		return this._currentRef;
	}

	async show(ref: ISourcesChangeRef): Promise<void> {
		this._currentRef = ref;
		this._ctxHasChange.set(true);
		this._onDidChangeRef.fire(ref);
		await this.viewsService.openView(SOURCES_DIFF_PANEL_VIEW_ID, true);
	}

	clear(): void {
		if (!this._currentRef) {
			return;
		}
		this._currentRef = undefined;
		this._ctxHasChange.set(false);
		this._onDidChangeRef.fire(undefined);
	}
}

registerSingleton(ISourcesDiffPanelService, SourcesDiffPanelService, InstantiationType.Delayed);
