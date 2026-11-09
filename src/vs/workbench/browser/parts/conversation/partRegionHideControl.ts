/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { Action } from '../../../../base/common/actions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { ToggleConversationVisibilityActionId, ToggleSourcesVisibilityActionId } from '../../actions/layoutActions.js';

const partRegionHideIcon = registerIcon('part-region-hide', Codicon.remove, localize('partRegionHideIcon', 'Icon to hide a workbench region.'));

/**
 * ADR-052 region chrome: local hide control (IDEA-style remove/dash glyph) that routes through {@link IWorkbenchLayoutService.setPartHidden}.
 * With a keybinding service the tooltip carries the region toggle's current keybinding.
 */
export function appendPartRegionHideControl(
	parent: HTMLElement,
	layoutService: IWorkbenchLayoutService,
	part: Parts.CONVERSATION_PART | Parts.SOURCES_PART,
	label: string,
	register: <T extends IDisposable>(disposable: T) => T,
	keybindingService?: IKeybindingService,
): HTMLElement {
	const actionsContainer = append(parent, $('.title-actions.part-region-hide-actions'));
	const actionBar = new ActionBar(actionsContainer);
	register(actionBar);
	const hideAction = new Action(
		`workbench.action.hidePart.${part}`,
		label,
		ThemeIcon.asClassName(partRegionHideIcon),
		true,
		() => layoutService.setPartHidden(true, part),
	);
	register(hideAction);
	const toggleCommandId = part === Parts.CONVERSATION_PART ? ToggleConversationVisibilityActionId : ToggleSourcesVisibilityActionId;
	const updateTooltip = () => {
		const keybinding = keybindingService?.lookupKeybinding(toggleCommandId)?.getLabel();
		hideAction.tooltip = keybinding ? localize('partRegionHideTooltip', "{0} ({1})", label, keybinding) : label;
	};
	updateTooltip();
	if (keybindingService) {
		register(keybindingService.onDidUpdateKeybindings(updateTooltip));
	}
	actionBar.push(hideAction, { icon: true, label: false });
	actionBar.setFocusable(true);

	// eslint-disable-next-line no-restricted-syntax -- the codicons are built by the action bar, not by this control
	for (const codicon of actionsContainer.querySelectorAll('.codicon')) {
		codicon.setAttribute('aria-hidden', 'true');
	}

	return actionsContainer;
}
