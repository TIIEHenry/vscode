/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as dom from '../../../../../base/browser/dom.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MenuItemAction } from '../../../../../platform/actions/common/actions.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { ISessionChangeset } from '../../../../services/sessions/common/session.js';
import { ChangesPickerActionItem } from '../../browser/changesView.js';
import { IChangesViewService } from '../../common/changesViewService.js';

suite('Changes picker label', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not keep a closed changeset name when nothing is selected', () => {
		const selected = observableValue<ISessionChangeset | undefined>('selected', undefined);
		const changesViewService = upcastPartial<IChangesViewService>({
			activeSessionChangesetObs: selected,
			activeSessionChangesetsObs: observableValue<readonly ISessionChangeset[] | undefined>('changesets', []),
		});
		const picker = disposables.add(new ChangesPickerActionItem(
			upcastPartial<MenuItemAction>({ id: 'chatEditing.versionsPicker', label: 'Versions', tooltip: 'Versions', enabled: true }),
			upcastPartial<IActionWidgetService>({}),
			upcastPartial<IKeybindingService>({ appendKeybinding: (label: string) => label }),
			upcastPartial<IContextKeyService>({}),
			changesViewService,
			upcastPartial<ITelemetryService>({}),
		));
		const element = dom.$('a.action-label');
		picker.element = element;

		const branch = upcastPartial<ISessionChangeset>({ id: 'branchChanges', label: 'Branch Changes' });
		const allChanges = upcastPartial<ISessionChangeset>({ id: 'allChanges', label: 'All Changes' });
		selected.set(branch, undefined);
		assert.strictEqual(labelText(element), 'Branch Changes');

		selected.set(allChanges, undefined);
		assert.strictEqual(labelText(element), 'All Changes');

		selected.set(undefined, undefined);
		assert.strictEqual(labelText(element), 'Versions');
	});

	function labelText(element: HTMLElement): string | undefined {
		return element.querySelector('span:not(.codicon)')?.textContent ?? undefined;
	}
});
