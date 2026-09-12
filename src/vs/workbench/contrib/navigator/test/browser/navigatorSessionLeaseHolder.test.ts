/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IConversationSessionViewLease } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import { ConversationStubService } from '../../../conversation/browser/conversationStubService.js';
import { NavigatorSessionLeaseHolder } from '../../browser/navigatorSessionLeaseHolder.js';

suite('NavigatorSessionLeaseHolder', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('acquire throw after hide notifies onLeaseChanged and does not keep the old lease live', () => {
		const boom = new Error('acquireSessionView: session untitled is not engine-bound');
		class RosterAcquireThenThrow extends ConversationStubService {
			throwOnAcquire = false;
			override acquireSessionView(sessionId: string): IConversationSessionViewLease {
				if (this.throwOnAcquire) {
					throw boom;
				}
				return super.acquireSessionView(sessionId);
			}
		}

		const roster = store.add(new RosterAcquireThenThrow());
		const leaseAtNotify: Array<IConversationSessionViewLease | undefined> = [];
		const acquireErrors: unknown[] = [];
		const holder = store.add(new NavigatorSessionLeaseHolder(
			roster,
			() => leaseAtNotify.push(holder.getLease()),
			error => acquireErrors.push(error),
		));

		holder.setVisible(true);
		const liveLease = holder.getLease();
		assert.ok(liveLease, 'first show must hang a live lease');
		assert.strictEqual(leaseAtNotify.at(-1), liveLease);
		assert.deepStrictEqual(acquireErrors, []);

		holder.setVisible(false);
		assert.strictEqual(holder.getLease(), undefined, 'hide must drop the lease');
		assert.strictEqual(leaseAtNotify.length, 1, 'hide must not notify; callers clear live ids themselves');

		roster.throwOnAcquire = true;
		holder.setVisible(true);
		assert.strictEqual(holder.getLease(), undefined, 'acquire throw must not re-hang the old lease');
		assert.strictEqual(leaseAtNotify.length, 2, 'acquire throw must still call onLeaseChanged');
		assert.strictEqual(leaseAtNotify.at(-1), undefined, 'notify after throw must see no live lease');
		assert.deepStrictEqual(acquireErrors, [boom]);
	});
});
