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
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';

const partRegionHideIcon = registerIcon('part-region-hide', Codicon.remove, localize('partRegionHideIcon', 'Icon to hide a workbench region.'));

/**
 * ADR-052 region chrome (−): local hide control that routes through {@link IWorkbenchLayoutService.setPartHidden}.
 */
export function appendPartRegionHideControl(
	parent: HTMLElement,
	layoutService: IWorkbenchLayoutService,
	part: Parts.CONVERSATION_PART | Parts.SOURCES_PART,
	label: string,
	register: <T extends IDisposable>(disposable: T) => T,
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
	hideAction.tooltip = label;
	actionBar.push(hideAction, { icon: true, label: false });
	actionBar.setFocusable(false);

	for (const codicon of actionsContainer.querySelectorAll('.codicon')) {
		codicon.setAttribute('aria-hidden', 'true');
	}

	return actionsContainer;
}
