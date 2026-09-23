/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { coalesce } from '../../../../../../base/common/arrays.js';
import { DisposableMap, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import * as languages from '../../../../../../editor/common/languages.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { ICommentService, INotebookCommentInfo } from '../../../../comments/browser/commentService.js';
import { CommentThreadWidget } from '../../../../comments/browser/commentThreadWidget.js';
import { ICellViewModel, INotebookEditorDelegate } from '../../notebookBrowser.js';
import { CellContentPart } from '../cellPart.js';
import { ICellRange } from '../../../common/notebookRange.js';

export class CellComments extends CellContentPart {
	// keyed by threadId
	private readonly _commentThreadWidgets: DisposableMap<string, { widget: CommentThreadWidget<ICellRange>; dispose: () => void }>;
	private currentElement: ICellViewModel | undefined;
	private _renderGeneration = 0;

	constructor(
		private readonly notebookEditor: INotebookEditorDelegate,
		private readonly container: HTMLElement,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IThemeService private readonly themeService: IThemeService,
		@ICommentService private readonly commentService: ICommentService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();
		this.container.classList.add('review-widget');

		this._register(this._commentThreadWidgets = new DisposableMap<string, { widget: CommentThreadWidget<ICellRange>; dispose: () => void }>());

		this._register(this.themeService.onDidColorThemeChange(this._applyTheme, this));
		// TODO @rebornix onDidChangeLayout (font change)
		// this._register(this.notebookEditor.onDidchangeLa)
		this._applyTheme();
	}

	private async initialize(element: ICellViewModel) {
		if (this.currentElement === element) {
			return;
		}

		this._renderGeneration++;
		this.currentElement = element;
		await this._updateThread();
	}

	private async _createCommentTheadWidget(owner: string, commentThread: languages.CommentThread<ICellRange>, element: ICellViewModel, generation: number) {
		const widgetDisposables = new DisposableStore();
		const widget = this.instantiationService.createInstance(
			CommentThreadWidget,
			this.container,
			this.notebookEditor,
			owner,
			this.notebookEditor.textModel!.uri,
			this.contextKeyService,
			this.instantiationService,
			commentThread,
			undefined,
			undefined,
			{},
			undefined,
			{
				actionRunner: () => {
				},
				collapse: async () => { return true; }
			}
		) as unknown as CommentThreadWidget<ICellRange>;
		widgetDisposables.add(widget);
		this._commentThreadWidgets.set(commentThread.threadId, { widget, dispose: () => widgetDisposables.dispose() });

		const layoutInfo = this.notebookEditor.getLayoutInfo();

		await widget.display(layoutInfo.fontInfo.lineHeight, true);
		if (generation !== this._renderGeneration || this.currentElement !== element) {
			return;
		}
		this._applyTheme();

		widgetDisposables.add(widget.onDidResize(() => {
			if (this.currentElement === element) {
				element.commentHeight = this._calculateCommentThreadHeight(widget.getDimensions().height);
			}
		}));
	}

	private _bindListeners() {
		this.cellDisposables.add(this.commentService.onDidUpdateCommentThreads(async () => this._updateThread()));
	}

	private async _updateThread() {
		if (!this.currentElement) {
			return;
		}
		const element = this.currentElement;
		const generation = this._renderGeneration;
		const isStale = () => generation !== this._renderGeneration || this.currentElement !== element;

		const infos = await this._getCommentThreadsForCell(element);
		if (isStale()) {
			return;
		}
		const widgetsToDelete = new Set(this._commentThreadWidgets.keys());
		const layoutInfo = element.layoutInfo;
		this.container.style.top = `${layoutInfo.commentOffset}px`;
		for (const info of infos) {
			if (!info) { continue; }
			for (const thread of info.threads) {
				if (isStale()) {
					return;
				}
				widgetsToDelete.delete(thread.threadId);
				const widget = this._commentThreadWidgets.get(thread.threadId)?.widget;
				if (widget) {
					await widget.updateCommentThread(thread);
					if (isStale()) {
						return;
					}
				} else {
					const threadId = thread.threadId;
					await this._createCommentTheadWidget(info.uniqueOwner, thread, element, generation);
					if (isStale()) {
						if (this._commentThreadWidgets.has(threadId)) {
							this._commentThreadWidgets.deleteAndDispose(threadId);
						}
						return;
					}
				}
			}
		}
		for (const threadId of widgetsToDelete) {
			this._commentThreadWidgets.deleteAndDispose(threadId);
		}
		if (isStale()) {
			return;
		}
		this._updateHeight(element);

	}

	private _calculateCommentThreadHeight(bodyHeight: number) {
		const layoutInfo = this.notebookEditor.getLayoutInfo();

		const headHeight = Math.ceil(layoutInfo.fontInfo.lineHeight * 1.2);
		const lineHeight = layoutInfo.fontInfo.lineHeight;
		const arrowHeight = Math.round(lineHeight / 3);
		const frameThickness = Math.round(lineHeight / 9) * 2;

		const computedHeight = headHeight + bodyHeight + arrowHeight + frameThickness + 8 /** margin bottom to avoid margin collapse */;
		return computedHeight;
	}

	private _updateHeight(element: ICellViewModel = this.currentElement!) {
		if (!element) {
			return;
		}
		let height = 0;
		for (const { widget } of this._commentThreadWidgets.values()) {
			height += this._calculateCommentThreadHeight(widget.getDimensions().height);
		}
		element.commentHeight = height;
	}

	private async _getCommentThreadsForCell(element: ICellViewModel): Promise<(INotebookCommentInfo | null)[]> {
		if (this.notebookEditor.hasModel()) {
			return coalesce(await this.commentService.getNotebookComments(element.uri));
		}

		return [];
	}

	private _applyTheme() {
		const fontInfo = this.notebookEditor.getLayoutInfo().fontInfo;
		for (const { widget } of this._commentThreadWidgets.values()) {
			widget.applyTheme(fontInfo);
		}
	}

	override didRenderCell(element: ICellViewModel): void {
		this.initialize(element);
		this._bindListeners();
	}

	override unrenderCell(element: ICellViewModel): void {
		this._renderGeneration++;
		super.unrenderCell(element);
	}

	override prepareLayout(): void {
		if (this.currentElement) {
			this._updateHeight(this.currentElement);
		}
	}

	override updateInternalLayoutNow(element: ICellViewModel): void {
		if (this.currentElement) {
			this.container.style.top = `${element.layoutInfo.commentOffset}px`;
		}
	}
}

