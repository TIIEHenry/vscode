/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Minimal proto3 binary helpers for handshake messages. Not a general protobuf runtime. */

const WIRE_VARINT = 0;
const WIRE_LEN = 2;

export function encodeVarint(value: number | bigint): Buffer {
	let n = typeof value === 'bigint' ? value : BigInt(value);
	if (n < 0n) {
		n = (1n << 64n) + n;
	}
	const bytes: number[] = [];
	while (n >= 0x80n) {
		bytes.push(Number(n & 0x7fn) | 0x80);
		n >>= 7n;
	}
	bytes.push(Number(n));
	return Buffer.from(bytes);
}

export function decodeVarint(bytes: Uint8Array, offset: number): { readonly value: bigint; readonly next: number } {
	let value = 0n;
	let shift = 0n;
	let pos = offset;
	while (pos < bytes.length) {
		const b = bytes[pos++];
		value |= BigInt(b & 0x7f) << shift;
		if ((b & 0x80) === 0) {
			return { value, next: pos };
		}
		shift += 7n;
		if (shift > 63n) {
			throw new Error('protobuf varint too long');
		}
	}
	throw new Error('truncated protobuf varint');
}

function encodeTag(field: number, wireType: number): Buffer {
	return encodeVarint((field << 3) | wireType);
}

function encodeLengthDelimited(field: number, payload: Uint8Array): Buffer {
	if (payload.length === 0) {
		return Buffer.alloc(0);
	}
	return Buffer.concat([
		encodeTag(field, WIRE_LEN),
		encodeVarint(payload.length),
		Buffer.from(payload),
	]);
}

export function encodeStringField(field: number, value: string | undefined): Buffer {
	if (!value) {
		return Buffer.alloc(0);
	}
	return encodeLengthDelimited(field, Buffer.from(value, 'utf8'));
}

export function encodeBytesField(field: number, value: Uint8Array | undefined): Buffer {
	if (!value || value.length === 0) {
		return Buffer.alloc(0);
	}
	return encodeLengthDelimited(field, value);
}

export function encodeMessageField(field: number, value: Uint8Array | undefined): Buffer {
	return encodeBytesField(field, value);
}

export function encodeInt32Field(field: number, value: number | undefined): Buffer {
	if (!value) {
		return Buffer.alloc(0);
	}
	return Buffer.concat([encodeTag(field, WIRE_VARINT), encodeVarint(value)]);
}

export function encodeInt64Field(field: number, value: number | bigint | undefined): Buffer {
	if (value === undefined || value === 0 || value === 0n) {
		return Buffer.alloc(0);
	}
	return Buffer.concat([encodeTag(field, WIRE_VARINT), encodeVarint(value)]);
}

export type ProtoField =
	| { readonly field: number; readonly wireType: 0; readonly varint: bigint }
	| { readonly field: number; readonly wireType: 2; readonly bytes: Uint8Array };

export function readProtoFields(bytes: Uint8Array): ProtoField[] {
	const fields: ProtoField[] = [];
	let offset = 0;
	while (offset < bytes.length) {
		const tag = decodeVarint(bytes, offset);
		offset = tag.next;
		const field = Number(tag.value >> 3n);
		const wireType = Number(tag.value & 7n);
		if (wireType === WIRE_VARINT) {
			const value = decodeVarint(bytes, offset);
			offset = value.next;
			fields.push({ field, wireType: 0, varint: value.value });
			continue;
		}
		if (wireType === WIRE_LEN) {
			const len = decodeVarint(bytes, offset);
			const start = len.next;
			const end = start + Number(len.value);
			if (end > bytes.length) {
				throw new Error('truncated protobuf length-delimited field');
			}
			fields.push({ field, wireType: 2, bytes: bytes.subarray(start, end) });
			offset = end;
			continue;
		}
		if (wireType === 1) {
			offset += 8;
			continue;
		}
		if (wireType === 5) {
			offset += 4;
			continue;
		}
		throw new Error(`unsupported protobuf wire type ${wireType}`);
	}
	return fields;
}

export function lastString(fields: readonly ProtoField[], field: number): string | undefined {
	for (let i = fields.length - 1; i >= 0; i--) {
		const item = fields[i];
		if (item.field === field && item.wireType === 2) {
			return Buffer.from(item.bytes).toString('utf8');
		}
	}
	return undefined;
}

export function lastBytes(fields: readonly ProtoField[], field: number): Uint8Array | undefined {
	for (let i = fields.length - 1; i >= 0; i--) {
		const item = fields[i];
		if (item.field === field && item.wireType === 2) {
			return item.bytes;
		}
	}
	return undefined;
}

export function lastVarint(fields: readonly ProtoField[], field: number): bigint | undefined {
	for (let i = fields.length - 1; i >= 0; i--) {
		const item = fields[i];
		if (item.field === field && item.wireType === 0) {
			return item.varint;
		}
	}
	return undefined;
}

export function allLengthDelimited(fields: readonly ProtoField[], field: number): Uint8Array[] {
	return fields.filter((item): item is Extract<ProtoField, { wireType: 2 }> => item.field === field && item.wireType === 2)
		.map(item => item.bytes);
}
