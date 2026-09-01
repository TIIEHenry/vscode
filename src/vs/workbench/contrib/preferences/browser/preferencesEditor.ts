/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/preferencesEditor.css';
import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { localize } from '../../../../nls.js';
import { IContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { Event } from '../../../../base/common/event.js';
import { getInputBoxStyle, defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { CONTEXT_PREFERENCES_SEARCH_FOCUS } from '../common/preferences.js';
import { settingsTextInputBorder } from '../common/settingsEditorColorRegistry.js';
import { SearchWidget } from './preferencesWidgets.js';
import { ActionBar, ActionsOrientation } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import type { IPreferencesEditorPaneRegistry, IPreferencesEditorPaneDescriptor, IPreferencesEditorPane } from './preferencesEditorRegistry.js';
import { Extensions } from './preferencesEditorRegistry.js';
import { Action } from '../../../../base/common/actions.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { MutableDisposable } from '../../../../base/common/lifecycle.js';
import { IPreferencesEditorOptions } from '../../../services/preferences/common/preferences.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

class PreferenceTabAction extends Action {
	constructor(readonly descriptor: IPreferencesEditorPaneDescriptor, actionCallback: () => void) {
		super(descriptor.id, descriptor.title, '', true, actionCallback);
	}
}

export class PreferencesEditor extends EditorPane {

	static readonly ID: string = 'workbench.editor.preferences';

	private readonly editorPanesRegistry = Registry.as<IPreferencesEditorPaneRegistry>(Extensions.PreferencesEditorPane);

	private readonly element: HTMLElement;
	private readonly headerContainer: HTMLElement;
	private readonly searchContainer: HTMLElement;
	private readonly backButtonContainer: HTMLElement;
	private readonly bodyElement: HTMLElement;
	private readonly searchWidget: SearchWidget;
	private readonly backButton: Button;
	private readonly preferencesTabActionBar: ActionBar;
	private readonly preferencesTabActions: PreferenceTabAction[] = [];
	private readonly preferencesEditorPane = this._register(new MutableDisposable<IPreferencesEditorPane>());

	private readonly searchFocusContextKey: IContextKey<boolean>;

	private dimension: DOM.Dimension | undefined;
	private activeDescriptor: IPreferencesEditorPaneDescriptor | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(PreferencesEditor.ID, group, telemetryService, themeService, storageService);

		this.searchFocusContextKey = CONTEXT_PREFERENCES_SEARCH_FOCUS.bindTo(contextKeyService);

		this.element = DOM.$('.preferences-editor');
		this.headerContainer = DOM.append(this.element, DOM.$('.preferences-editor-header'));

		this.backButtonContainer = DOM.append(this.headerContainer, DOM.$('.back-to-client-settings-container'));
		this.backButton = this._register(new Button(this.backButtonContainer, defaultButtonStyles));
		this.backButton.label = localize('ua.backToClientSettings', "Back to Client Settings");
		this.backButtonContainer.style.display = 'none';
		this._register(this.backButton.onDidClick(() => {
			this.commandService.executeCommand('workbench.action.backToClientSettings');
		}));

		this.searchContainer = DOM.append(this.headerContainer, DOM.$('.search-container'));
		this.searchWidget = this._register(this.instantiationService.createInstance(SearchWidget, this.searchContainer, {
			focusKey: this.searchFocusContextKey,
			inputBoxStyles: getInputBoxStyle({
				inputBorder: settingsTextInputBorder
			})
		}));
		this._register(Event.debounce(this.searchWidget.onDidChange, () => undefined, 300)(() => {
			if (this.isHeaderSearchEnabled()) {
				this.preferencesEditorPane.value?.search(this.searchWidget.getValue());
			}
		}));

		const preferencesTabsContainer = DOM.append(this.headerContainer, DOM.$('.preferences-tabs-container'));
		this.preferencesTabActionBar = this._register(new ActionBar(preferencesTabsContainer, {
			orientation: ActionsOrientation.HORIZONTAL,
			focusOnlyEnabledItems: true,
			ariaLabel: localize('preferencesTabSwitcherBarAriaLabel', "Preferences Tab Switcher"),
			ariaRole: 'tablist',
		}));
		this.onDidChangePreferencesEditorPane(this.editorPanesRegistry.getPreferencesEditorPanes(), []);
		this._register(this.editorPanesRegistry.onDidRegisterPreferencesEditorPanes(descriptors => this.onDidChangePreferencesEditorPane(descriptors, [])));
		this._register(this.editorPanesRegistry.onDidDeregisterPreferencesEditorPanes(descriptors => this.onDidChangePreferencesEditorPane([], descriptors)));

		this.bodyElement = DOM.append(this.element, DOM.$('.preferences-editor-body'));
	}

	protected createEditor(parent: HTMLElement): void {
		DOM.append(parent, this.element);
	}

	layout(dimension: DOM.Dimension): void {
		this.dimension = dimension;
		if (this.isHeaderSearchEnabled()) {
			this.searchWidget.layout(dimension);
			this.searchWidget.inputBox.inputElement.style.paddingRight = `12px`;
		}

		this.preferencesEditorPane.value?.layout(new DOM.Dimension(this.bodyElement.clientWidth, dimension.height - 87 /* header height */));
	}

	override async setInput(input: EditorInput, options: IPreferencesEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		if (this.preferencesTabActions.length) {
			const paneId = options?.paneId;
			if (paneId && this.preferencesTabActions.some(action => action.id === paneId)) {
				this.onDidSelectPreferencesEditorPane(paneId);
			} else {
				this.onDidSelectPreferencesEditorPane(this.preferencesTabActions[0].id);
			}
		}
	}

	private onDidChangePreferencesEditorPane(toAdd: readonly IPreferencesEditorPaneDescriptor[], toRemove: readonly IPreferencesEditorPaneDescriptor[]): void {
		for (const desc of toRemove) {
			const index = this.preferencesTabActions.findIndex(action => action.id === desc.id);
			if (index !== -1) {
				this.preferencesTabActionBar.pull(index);
				this.preferencesTabActions[index].dispose();
				this.preferencesTabActions.splice(index, 1);
			}
		}
		if (toAdd.length > 0) {
			const all = this.editorPanesRegistry.getPreferencesEditorPanes();
			for (const desc of toAdd) {
				const index = all.findIndex(action => action.id === desc.id);
				if (index !== -1) {
					const action = new PreferenceTabAction(desc, () => this.onDidSelectPreferencesEditorPane(desc.id));
					this.preferencesTabActions.splice(index, 0, action);
					this.preferencesTabActionBar.push(action, { index });
				}
			}
		}
	}

	private onDidSelectPreferencesEditorPane(id: string): void {
		let selectedAction: PreferenceTabAction | undefined;
		for (const action of this.preferencesTabActions) {
			if (action.id === id) {
				action.checked = true;
				selectedAction = action;
			} else {
				action.checked = false;
			}
		}

		this.activeDescriptor = selectedAction?.descriptor;
		this.updateHeaderChrome();

		if (selectedAction && this.isHeaderSearchEnabled()) {
			this.searchWidget.inputBox.setPlaceHolder(localize('FullTextSearchPlaceholder', "Search {0}", selectedAction.descriptor.title));
			this.searchWidget.inputBox.setAriaLabel(localize('FullTextSearchPlaceholder', "Search {0}", selectedAction.descriptor.title));
		}

		this.renderBody(selectedAction?.descriptor);

		if (this.dimension) {
			this.layout(this.dimension);
		}
	}

	private updateHeaderChrome(): void {
		const showBack = !!this.activeDescriptor?.showBackToClientSettings;
		this.backButtonContainer.style.display = showBack ? '' : 'none';
		this.searchContainer.style.display = showBack ? 'none' : '';
	}

	private isHeaderSearchEnabled(): boolean {
		return !this.activeDescriptor?.showBackToClientSettings;
	}

	private renderBody(descriptor?: IPreferencesEditorPaneDescriptor): void {
		this.preferencesEditorPane.value = undefined;
		DOM.clearNode(this.bodyElement);

		if (descriptor) {
			const editorPane = this.instantiationService.createInstance<IPreferencesEditorPane>(descriptor.ctorDescriptor.ctor);
			this.preferencesEditorPane.value = editorPane;
			this.bodyElement.appendChild(editorPane.getDomNode());
		}
	}

	override dispose(): void {
		super.dispose();
		this.preferencesTabActions.forEach(action => action.dispose());
	}
}
