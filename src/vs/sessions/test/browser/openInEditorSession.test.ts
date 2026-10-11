/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mock } from '../../../base/test/common/mock.js';
import { constObservable } from '../../../base/common/observable.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { URI } from '../../../base/common/uri.js';
import { setOpenInEditorSessionParam } from '../../common/openInEditorSession.js';
import { IActiveSession } from '../../services/sessions/common/sessionsManagement.js';

suite('Open in Editor session query', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('omits the session param until the session is created', () => {
		const provisional = createSession('provisional', false);
		const materialized = createSession('materialized', true);
		const provisionalParams = paramsFor(provisional);
		const materializedParams = paramsFor(materialized);
		const missingParams = paramsFor(undefined);

		assert.deepStrictEqual({
			provisionalHasSession: provisionalParams.has('session'),
			provisionalWindow: provisionalParams.get('windowId'),
			materializedSession: materializedParams.get('session'),
			materializedWindow: materializedParams.get('windowId'),
			missingHasSession: missingParams.has('session'),
		}, {
			provisionalHasSession: false,
			provisionalWindow: '_blank',
			materializedSession: materialized.resource.toString(),
			materializedWindow: '_blank',
			missingHasSession: false,
		});
	});
});

function paramsFor(session: IActiveSession | undefined): URLSearchParams {
	const params = new URLSearchParams();
	params.set('windowId', '_blank');
	setOpenInEditorSessionParam(params, session);
	return params;
}

function createSession(id: string, isCreated: boolean): IActiveSession {
	return new class extends mock<IActiveSession>() {
		override readonly resource = URI.from({ scheme: 'test', path: `/${id}` });
		override readonly isCreated = constObservable(isCreated);
	}();
}
