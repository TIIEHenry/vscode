/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesDiffPanel.css';
import * as dom from '../../../../base/browser/dom.js';
import { DisposableStore, IReference, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { IDiffEditorConstructionOptions } from '../../../../editor/browser/editorBrowser.js';
import { CodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { DiffEditorWidget } from '../../../../editor/browser/widget/diffEditor/diffEditorWidget.js';
import { IEditorOptions } from '../../../../editor/common/config/editorOptions.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { IResolvedTextEditorModel, ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { EditorModel } from '../../../common/editor/editorModel.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { ISourcesChangeRef } from '../common/sourcesChangeRef.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { SOURCES_DIFF_PANEL_VIEW_ID } from './sourcesDiffPanelIds.js';

const $ = dom.$;

class SourcesDiffEditorModel extends EditorModel {
	readonly original: ITextModel;
	readonly modified: ITextModel;

	constructor(
		private readonly originalRef: IReference<IResolvedTextEditorModel>,
		private readonly modifiedRef: IReference<IResolvedTextEditorModel>,
	) {
		super();
		this.original = originalRef.object.textEditorModel;
		this.modified = modifiedRef.object.textEditorModel;
	}

	override dispose(): void {
		super.dispose();
		this.originalRef.dispose();
		this.modifiedRef.dispose();
	}
}

const readOnlyEditorOptions: IEditorOptions = {
	readOnly: true,
	scrollBeyondLastLine: false,
	minimap: { enabled: false },
	automaticLayout: false,
	lineNumbers: 'on',
};

export class SourcesDiffPanelView extends ViewPane {

	static readonly ID = SOURCES_DIFF_PANEL_VIEW_ID;

	private readonly bodyDisposables = this._register(new DisposableStore());
	private readonly diffWidget = this._register(new MutableDisposable<DiffEditorWidget>());
	private readonly codeWidget = this._register(new MutableDisposable<CodeEditorWidget>());
	private readonly model = this._register(new MutableDisposable<SourcesDiffEditorModel>());
	private readonly modifiedModelRef = this._register(new MutableDisposable<IReference<IResolvedTextEditorModel>>());

	private bodyContainer: HTMLElement | undefined;
	private editorContainer: HTMLElement | undefined;
	private headerElement: HTMLElement | undefined;
	private newFileNoticeElement: HTMLElement | undefined;
	private dimension: dom.Dimension | undefined;
	private currentRef: ISourcesChangeRef | undefined;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@ITextModelService private readonly textModelService: ITextModelService,
		@ISourcesDiffPanelService private readonly sourcesDiffPanelService: ISourcesDiffPanelService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this.element.classList.add('sources-diff-panel');

		this._register(this.sourcesDiffPanelService.onDidChangeRef(ref => {
			this.currentRef = ref;
			void this.renderRef(ref);
		}));

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('diffEditor.renderSideBySide') && this.diffWidget.value) {
				this.diffWidget.value.updateOptions(this.getDiffEditorOptions());
			}
		}));

		this.currentRef = this.sourcesDiffPanelService.getCurrentRef();
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.bodyContainer = dom.append(container, $('.sources-diff-panel-body'));
		this.headerElement = dom.append(this.bodyContainer, $('.sources-diff-panel-header'));
		this.newFileNoticeElement = dom.append(this.bodyContainer, $('.sources-diff-panel-new-file-notice'));
		this.newFileNoticeElement.style.display = 'none';
		this.editorContainer = dom.append(this.bodyContainer, $('.sources-diff-panel-editor'));

		void this.renderRef(this.currentRef);
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.dimension = new dom.Dimension(width, height);

		const headerHeight = this.headerElement?.offsetHeight ?? 0;
		const noticeHeight = this.newFileNoticeElement?.style.display === 'none' ? 0 : (this.newFileNoticeElement?.offsetHeight ?? 0);
		const editorHeight = Math.max(0, height - headerHeight - noticeHeight);
		const editorDimension = new dom.Dimension(width, editorHeight);

		this.diffWidget.value?.layout(editorDimension);
		this.codeWidget.value?.layout(editorDimension);
	}

	private getDiffEditorOptions(): IDiffEditorConstructionOptions {
		return {
			...readOnlyEditorOptions,
			originalEditable: false,
			renderSideBySide: this.configurationService.getValue<boolean>('diffEditor.renderSideBySide') ?? true,
			renderOverviewRuler: false,
		};
	}

	private async renderRef(ref: ISourcesChangeRef | undefined): Promise<void> {
		this.bodyDisposables.clear();
		this.clearEditors();

		if (!this.headerElement || !this.newFileNoticeElement || !this.editorContainer) {
			return;
		}

		if (!ref) {
			this.headerElement.textContent = '';
			this.newFileNoticeElement.style.display = 'none';
			return;
		}

		this.headerElement.textContent = basename(ref.modified);
		this.headerElement.title = ref.modified.fsPath;

		if (!ref.original) {
			this.newFileNoticeElement.textContent = localize('sourcesDiffPanel.newFile', "New file with no previous version to compare.");
			this.newFileNoticeElement.style.display = '';
			await this.renderModifiedOnly(ref.modified);
		} else {
			this.newFileNoticeElement.style.display = 'none';
			await this.renderDiff(ref.original, ref.modified);
		}

		if (this.dimension) {
			this.layoutBody(this.dimension.height, this.dimension.width);
		}
	}

	private showLoadNotice(message: string): void {
		if (!this.newFileNoticeElement) {
			return;
		}
		this.newFileNoticeElement.textContent = message;
		this.newFileNoticeElement.style.display = '';
	}

	private async renderDiff(original: URI, modified: URI): Promise<void> {
		if (!this.editorContainer) {
			return;
		}

		let originalRef: IReference<IResolvedTextEditorModel> | undefined;
		let modifiedRef: IReference<IResolvedTextEditorModel> | undefined;
		try {
			originalRef = await this.textModelService.createModelReference(original);
			modifiedRef = await this.textModelService.createModelReference(modified);
		} catch {
			originalRef?.dispose();
			modifiedRef?.dispose();
			this.showLoadNotice(localize('sourcesDiffPanel.loadFailed', "Unable to load this comparison."));
			return;
		}

		this.bodyDisposables.add(originalRef);
		this.bodyDisposables.add(modifiedRef);

		const editorModel = this.model.value = new SourcesDiffEditorModel(originalRef, modifiedRef);
		const widget = this.diffWidget.value = this.instantiationService.createInstance(
			DiffEditorWidget,
			this.editorContainer,
			this.getDiffEditorOptions(),
			{},
		);
		widget.setModel(editorModel);

		if (this.dimension) {
			const headerHeight = this.headerElement?.offsetHeight ?? 0;
			widget.layout(new dom.Dimension(this.dimension.width, Math.max(0, this.dimension.height - headerHeight)));
		}
	}

	private async renderModifiedOnly(modified: URI): Promise<void> {
		if (!this.editorContainer) {
			return;
		}

		let modifiedRef: IReference<IResolvedTextEditorModel>;
		try {
			modifiedRef = await this.textModelService.createModelReference(modified);
		} catch {
			this.showLoadNotice(localize('sourcesDiffPanel.loadFailed', "Unable to load this comparison."));
			return;
		}
		this.modifiedModelRef.value = modifiedRef;
		this.bodyDisposables.add(modifiedRef);

		const widget = this.codeWidget.value = this.instantiationService.createInstance(
			CodeEditorWidget,
			this.editorContainer,
			readOnlyEditorOptions,
			{ isSimpleWidget: true },
		);
		widget.setModel(modifiedRef.object.textEditorModel);

		if (this.dimension) {
			const headerHeight = this.headerElement?.offsetHeight ?? 0;
			const noticeHeight = this.newFileNoticeElement?.offsetHeight ?? 0;
			widget.layout(new dom.Dimension(this.dimension.width, Math.max(0, this.dimension.height - headerHeight - noticeHeight)));
		}
	}

	private clearEditors(): void {
		this.model.clear();
		this.modifiedModelRef.clear();
		this.diffWidget.clear();
		this.codeWidget.clear();
	}
}
