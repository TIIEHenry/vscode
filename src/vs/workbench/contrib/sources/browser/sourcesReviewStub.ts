/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';

const $ = dom.$;

/**
 * Honest stub for the Review tab — not a second Conversation surface.
 */
export class SourcesReviewStub extends Disposable {

	constructor(host: HTMLElement) {
		super();

		host.classList.add('sources-review-panel');

		const empty = dom.append(host, $('.sources-stub-empty'));
		empty.textContent = localize('sourcesReviewStub.empty', "Review is not wired yet.");
	}
}
