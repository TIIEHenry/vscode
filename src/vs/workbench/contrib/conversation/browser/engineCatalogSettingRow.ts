/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';

/** Separate display fields without losing the complete protocol label or empty values. */
export function appendCatalogSettingFields(parent: HTMLElement, fields: readonly { readonly role: string; readonly value: string }[], label: string): void {
	parent.setAttribute('aria-label', label);
	for (const [index, field] of fields.entries()) {
		if (index > 0) {
			const separator = DOM.append(parent, DOM.$('span.engine-record-separator'));
			separator.textContent = ' — ';
			separator.setAttribute('aria-hidden', 'true');
		}
		const element = DOM.append(parent, DOM.$(`span.engine-record-${field.role}`));
		element.textContent = field.value;
	}
}
