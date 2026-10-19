/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button, type IButtonStyles } from '../../../../base/browser/ui/button/button.js';
import { ThemeIcon } from '../../../../base/common/themables.js';

/**
 * Styles stay unset so `.engine-catalog-icon-actions` paints the ghost icon.
 * A label here would become visible text on the button.
 */
const catalogIconButtonStyles: IButtonStyles = {
	buttonBackground: undefined,
	buttonHoverBackground: undefined,
	buttonSeparator: undefined,
	buttonForeground: undefined,
	buttonBorder: undefined,
	buttonSecondaryBackground: undefined,
	buttonSecondaryForeground: undefined,
	buttonSecondaryHoverBackground: undefined,
	buttonSecondaryBorder: undefined,
};

export function createCatalogIconButton(parent: HTMLElement, label: string, icon: ThemeIcon): Button {
	const button = new Button(parent, {
		...catalogIconButtonStyles,
		supportIcons: true,
		title: label,
		ariaLabel: label,
	});
	button.icon = icon;
	return button;
}
