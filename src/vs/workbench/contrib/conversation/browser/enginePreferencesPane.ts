/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/enginePreferencesPane.css';
import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import type { IPreferencesEditorPane } from '../../preferences/browser/preferencesEditorRegistry.js';
import { EngineSkillsSection } from './engineSkillsSection.js';
import { resolveEngineSkillsPaneMode } from './engineSkillCatalog.js';

/** Honest Test Engine result — no engine probe, no fake success. */
export function getEngineTestStatusText(): string {
	return localize('ua.engineTestNotConnected', "Not connected — no engine.");
}

export function getEngineEmptyCopy(): string {
	return localize('ua.engineEmptyWelcome', "No engines yet");
}

export class EnginePreferencesPane extends Disposable implements IPreferencesEditorPane {

	private readonly container: HTMLElement;
	private readonly emptyWelcome: HTMLElement;
	private readonly skillsSection: EngineSkillsSection;
	private readonly testStatus: HTMLElement;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IUniverseAgentConnection private readonly connectionService: IUniverseAgentConnection,
	) {
		super();

		this.container = DOM.$('.engine-preferences-pane');
		this.container.style.padding = '24px';

		const title = DOM.append(this.container, DOM.$('h2'));
		title.textContent = localize('ua.enginePaneTitle', "Engine");

		this.emptyWelcome = DOM.append(this.container, DOM.$('.engine-empty-welcome'));
		this.emptyWelcome.textContent = getEngineEmptyCopy();
		this.emptyWelcome.style.opacity = '0.8';

		this.skillsSection = this._register(instantiationService.createInstance(EngineSkillsSection, this.container));

		const testRow = DOM.append(this.container, DOM.$('.engine-test-row'));
		const testButton = this._register(new Button(testRow, defaultButtonStyles));
		testButton.label = localize('ua.engineTest', "Test Engine");
		this.testStatus = DOM.append(testRow, DOM.$('.engine-test-status'));
		this.testStatus.setAttribute('role', 'status');
		this.testStatus.setAttribute('aria-live', 'polite');
		this._register(testButton.onDidClick(() => {
			this.testStatus.textContent = this.connectionService.isEngineConnected()
				? localize('ua.engineTestConnected', "Engine is connected.")
				: getEngineTestStatusText();
		}));

		this._register(this.connectionService.onDidChangeConnection(() => {
			this.updateEmptyState();
		}));

		this.updateEmptyState();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.height = `${dimension.height}px`;
		const skillsHeight = Math.max(0, dimension.height - 160);
		this.skillsSection.layout(dimension.width - 48, skillsHeight);
	}

	search(_text: string): void {
		// Header search disabled for this pane family.
	}

	private updateEmptyState(): void {
		const mode = resolveEngineSkillsPaneMode(
			this.connectionService.isEngineConnected(),
			this.connectionService.getCapabilitySnapshot().skills.support,
		);
		const showDisconnectedEmpty = mode === 'disconnected';
		this.emptyWelcome.style.display = showDisconnectedEmpty ? '' : 'none';
	}
}
