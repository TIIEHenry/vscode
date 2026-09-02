/**
 * Pure outbound answer-keys decide (ADR-018 INV-QKEY-1/2/4).
 *
 * Local test tags INV-QAK-* ≡ INV-QKEY outbound decide — not a parallel INV catalog.
 * Does not wire Actor / Codec / UI (see plan question-respond-answer-keys-outbound-gate;
 * unprojected sunset: question-respond-answer-keys-unprojected-sunset;
 * key-domain fail-closed: question-respond-answer-keys-key-domain / INV-QAK-KEYDOM-1).
 *
 * INV-QAK-OWN-1: S4 items[].id own-data-key domain fail-closed. Admit only own
 * data-property id before trim / __proto__ KEYDOM checks — never prototype chain
 * or accessor. Missing own / accessor → answer_keys_invalid; accessors never run.
 *
 * Order: S1 answers container → S2 items array → S3 answerKeysValid →
 * S4 items element domain (__proto__ only) → S5 unknown_answer_key → S6 ok.
 */

export type QuestionRespondAnswerKeysPlan =
	| { readonly kind: 'ok' }
	| {
			readonly kind: 'reject'
			readonly reason: 'unknown_answer_key' | 'answer_keys_invalid'
		}

/**
 * Narrow structural input — question-arm summary fields only.
 * Optional fields are runtime defense for incomplete structural args
 * (fail-closed → answer_keys_invalid); they do **not** reopen U1
 * view/types optional exit (slice-3 required remains SSOT).
 */
export type QuestionRespondAnswerKeysSummary = {
	readonly items?: ReadonlyArray<{ readonly id: string }>
	readonly answerKeysValid?: boolean
}

export type QuestionRespondAnswersInput = Readonly<
	Record<string, { readonly selectedLabels: readonly string[] }>
>

const REJECT_INVALID: QuestionRespondAnswerKeysPlan = {
	kind: 'reject',
	reason: 'answer_keys_invalid',
}

function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

/**
 * Plan whether `answers` keys are verbatim members of projected `summary.items`.
 *
 * INV-QAK-KEYDOM-1 (S1–S6):
 * - S1 answers 非 plain object 容器（null / 非 object / Array / own symbol）→ answer_keys_invalid
 * - S2 `items === undefined` 或非数组 → answer_keys_invalid
 * - S3 `answerKeysValid !== true` → answer_keys_invalid
 * - S4 items 元素非法或 trim 后 id === `'__proto__'` → answer_keys_invalid
 *   （**不**拒 `constructor` / `prototype` — 对齐 INV-QRE-11）
 * - S5 任一 own string key（`getOwnPropertyNames`，===，不 trim）∉ items[].id → unknown_answer_key
 * - S6 else → ok
 *
 * INV-QAK-OWN-1: S4 admits only own data-property id before the KEYDOM trim /
 * `__proto__` checks above.
 *
 * Keys are compared raw (no trim). Mapper ids are already trimmed; unequal
 * whitespace → unknown_answer_key (MF-7). Blank answers keys with valid items
 * remain unknown_answer_key.
 */
export function planQuestionRespondAnswerKeys(
	summary: QuestionRespondAnswerKeysSummary,
	answers: QuestionRespondAnswersInput,
): QuestionRespondAnswerKeysPlan {
	// S1 — answers container domain (runtime defense; callers may as-cast)
	// Plain object only: Object.prototype or null prototype. Rejects Map / arrays /
	// null / primitives / own-symbol keys (INV-QAK-8).
	if (answers === null || typeof answers !== 'object' || Array.isArray(answers)) {
		return REJECT_INVALID
	}
	const answersProto = Object.getPrototypeOf(answers)
	if (
		(answersProto !== Object.prototype && answersProto !== null) ||
		Object.getOwnPropertySymbols(answers).length > 0
	) {
		return REJECT_INVALID
	}

	// S2 — items must be a defined array
	const items = summary.items
	if (items === undefined || !Array.isArray(items)) {
		return REJECT_INVALID
	}

	// S3 — answerKeysValid must be exactly true
	if (summary.answerKeysValid !== true) {
		return REJECT_INVALID
	}

	// S4 — items element domain; only __proto__ (trim) is a forbidden id
	const allowed = new Set<string>()
	for (const item of items) {
		if (item === null || typeof item !== 'object') {
			return REJECT_INVALID
		}
		const id = readOwnDataValue(item, 'id')
		if (typeof id !== 'string' || id.trim() === '' || id.trim() === '__proto__') {
			return REJECT_INVALID
		}
		allowed.add(id)
	}

	// S5 — membership via own property names (includes non-enumerable)
	for (const key of Object.getOwnPropertyNames(answers)) {
		if (!allowed.has(key)) {
			return { kind: 'reject', reason: 'unknown_answer_key' }
		}
	}

	// S6
	return { kind: 'ok' }
}
