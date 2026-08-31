/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';

const $ = dom.$;

/**
 * Honest stub for the Changes tab — no SCM/git wiring, no openDiff routing.
 */
export class SourcesChangesStub extends Disposable {

	constructor(host: HTMLElement) {
		super();

		host.classList.add('sources-changes-panel');

		const empty = dom.append(host, $('.sources-stub-empty'));
		empty.textContent = localize('sourcesChangesStub.empty', "No staged changes — engine not connected.");
	}
}
