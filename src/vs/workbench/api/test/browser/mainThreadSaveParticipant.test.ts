/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { upcastPartial } from '../../../../base/test/common/mock.js';
import { runWithFakedTimers } from '../../../../base/test/common/timeTravelScheduler.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { Progress } from '../../../../platform/progress/common/progress.js';
import { SaveReason } from '../../../common/editor.js';
import { IExtHostContext } from '../../../services/extensions/common/extHostCustomers.js';
import { Proxied } from '../../../services/extensions/common/proxyIdentifier.js';
import { ITextFileEditorModel } from '../../../services/textfile/common/textfiles.js';
import { ExtHostSaveParticipant } from '../../browser/mainThreadSaveParticipant.js';
import { ExtHostDocumentSaveParticipantShape } from '../../common/extHost.protocol.js';

suite('MainThreadSaveParticipant', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function createParticipant(reply: Promise<boolean[]>) {
		const tokens: CancellationToken[] = [];
		const proxy = upcastPartial<ExtHostDocumentSaveParticipantShape>({
			$participateInSave: (_resource, _reason, token) => {
				tokens.push(token);
				return reply;
			}
		});
		const participant = new ExtHostSaveParticipant(upcastPartial<IExtHostContext>({ getProxy: <T>() => proxy as unknown as Proxied<T> }));
		const editorModel = upcastPartial<ITextFileEditorModel>({
			resource: URI.parse('foo:bar'),
			textEditorModel: upcastPartial<ITextModel>({ isTooLargeForSyncing: () => false, isForSimpleWidget: false }),
		});
		const participate = (token: CancellationToken) => participant.participate(editorModel, { reason: SaveReason.EXPLICIT }, new Progress(() => { }), token);
		return { tokens, participate };
	}

	test('cancels the extension host participation when the 1750ms budget runs out', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
		const { tokens, participate } = createParticipant(new Promise<boolean[]>(() => { }));
		const saveCts = new CancellationTokenSource();

		const error = await participate(saveCts.token).then(() => undefined, err => err);

		assert.deepStrictEqual({
			message: error?.message,
			extHostCancelled: tokens.map(t => t.isCancellationRequested),
			saveCancelled: saveCts.token.isCancellationRequested,
		}, {
			message: 'Aborted onWillSaveTextDocument-event after 1750ms',
			extHostCancelled: [true],
			saveCancelled: false,
		});
		saveCts.dispose();
	}));

	test('does not cancel the extension host participation once it has replied', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
		const reply = new DeferredPromise<boolean[]>();
		const { tokens, participate } = createParticipant(reply.p);

		const participation = participate(CancellationToken.None);
		reply.complete([true]);
		await participation;
		await new Promise(resolve => setTimeout(resolve, 2000));

		assert.deepStrictEqual(tokens.map(t => t.isCancellationRequested), [false]);
	}));
});
