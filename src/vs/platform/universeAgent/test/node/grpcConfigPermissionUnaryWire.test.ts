/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentSetPermissionPolicyResult } from '../../common/universeAgentTypes.js';
import {
	decodeSetPermissionPolicyResponse,
	encodeSetPermissionPolicyRequest,
	type SetPermissionPolicyResponseWire,
} from '../../node/grpc/grpcConfigPermissionUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc ConfigService SetPermissionPolicy protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeSetPermissionPolicyRequest roundtrip session_id=1 tool_name=2 policy=3; omits empty/0; not JSON', () => {
		const encoded = encodeSetPermissionPolicyRequest({
			sessionId: 'sess-1',
			toolName: 'bash',
			policy: 'PERMISSION_POLICY_ASK',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(JSON.stringify({ session_id: 'sess-1' }).includes(Buffer.from(encoded).toString('utf8')), false);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'bash');
		assert.strictEqual(protoVarints(encoded).get(3), 1);
		assert.ok(!protoStrings(encoded).has(4));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const agent = encodeSetPermissionPolicyRequest({
			sessionId: 'sess-1',
			toolName: 'bash',
			policy: 'PERMISSION_POLICY_AGENT',
		});
		assert.notStrictEqual(agent[0], 0x7b);
		assert.strictEqual(protoVarints(agent).get(3), 2);

		const permit = encodeSetPermissionPolicyRequest({
			sessionId: 'sess-1',
			toolName: 'bash',
			policy: 'PERMISSION_POLICY_PERMIT',
		});
		assert.strictEqual(protoVarints(permit).get(3), 3);

		const globalAsk = encodeSetPermissionPolicyRequest({
			sessionId: 'sess-1',
			toolName: '',
			policy: 'PERMISSION_POLICY_ASK',
		});
		assert.notStrictEqual(globalAsk[0], 0x7b);
		assert.strictEqual(protoStrings(globalAsk).get(1), 'sess-1');
		assert.ok(!protoStrings(globalAsk).has(2));
		assert.strictEqual(protoVarints(globalAsk).get(3), 1);

		const unspecified = encodeSetPermissionPolicyRequest({
			sessionId: 'sess-1',
			toolName: 'bash',
			policy: 'PERMISSION_POLICY_UNSPECIFIED',
		});
		assert.strictEqual(protoStrings(unspecified).get(1), 'sess-1');
		assert.strictEqual(protoStrings(unspecified).get(2), 'bash');
		assert.ok(!protoVarints(unspecified).has(3));

		assert.strictEqual(encodeSetPermissionPolicyRequest({
			sessionId: '',
			toolName: '',
			policy: 'PERMISSION_POLICY_UNSPECIFIED',
		}).length, 0);
	});

	test('decodeSetPermissionPolicyResponse reads success=1 message=2; false omit; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'saved'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeSetPermissionPolicyResponse(encoded);
		assert.deepStrictEqual(wire, { success: true, message: 'saved' });
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapSetPermissionPolicy(wire), { ok: true, message: 'saved' });

		const empty = decodeSetPermissionPolicyResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { success: undefined, message: undefined });
		assert.deepStrictEqual(mapSetPermissionPolicy(empty), { ok: false, message: undefined });

		const rejected = decodeSetPermissionPolicyResponse(encodeInt32Field(1, 0));
		assert.deepStrictEqual(rejected, { success: undefined, message: undefined });
		assert.deepStrictEqual(mapSetPermissionPolicy(rejected), { ok: false, message: undefined });
	});
});

/** Same mapping as Config.SetPermissionPolicy JSON unary (`ok: wire.success === true`). */
function mapSetPermissionPolicy(wire: SetPermissionPolicyResponseWire): UniverseAgentSetPermissionPolicyResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
}

function protoStrings(encoded: Uint8Array): Map<number, string> {
	const strings = new Map<number, string>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 2) {
			strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return strings;
}

function protoVarints(encoded: Uint8Array): Map<number, number> {
	const numbers = new Map<number, number>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 0) {
			numbers.set(field.field, Number(field.varint));
		}
	}
	return numbers;
}
