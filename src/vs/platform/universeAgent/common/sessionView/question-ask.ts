/**
 * Presentation: Chat demux `arm:'question'` side-effect body → U1 `kind:'question'`
 * TimelineItemView row(s). Pure; fixture chrome + Overlay/Pending/localFact consumers
 * (INV-QA-2 / INV-QAF-4). Never wired through DOMAIN_TIMELINE_ARMS fold (INV-QA-4).
 *
 * Identity layers (ADR-017 Amendment 1 · INV-QAP-* · ADR-018 INV-QKEY-*):
 * - Display / Timeline row id = compound `${questionId}:${childKey}` (INV-QAF-2)
 * - Display childKey = `questionAskChildKey` — may use `q_i` **仅展示**（INV-QKEY-2）
 * - answers-map key = 逐字 `QuestionItem.id` ≡ `summary.items[].id`（ADR-018；禁止经 childKey）
 * - Top-level pending requestId = questionId only (INV-QAP-1) — NOT compound
 *
 * Multi-question fan-out (INV-QAF-*): one event → N display rows; childKey =
 * questions[i].id || `q_${i}`（展示 only — 不对齐 wire answers）。
 * Parent pending summary 携带 ask 级有界 `items` + `answerKeysValid`（ADR-018；切片 3 端态必填）。
 *
 * INV-QAC-ADDR-1: parent `questionId` correlation identity is fail-closed at
 * `timelineItemsFromQuestionAsk` mint — withhold `answerKeysValid` only for
 * exact-canonical-but-unaddressable parents; items / row id / orderKey stay
 * verbatim (refuse, do not wash).
 *
 * INV-QASK-ID-2: questionId into timeline / pending ids is exact-canonical
 * only (`length > 0 && value === value.trim()`). Helpers never trim-write
 * questionId; padded / blank parent → withhold mint (`[]`). childKey display
 * fallback rules unchanged.
 *
 * INV-QASK-SING-1: singular `timelineItemFromQuestionAsk` is first fan-out row
 * or `undefined` when mint withholds (`[]`); 0× non-null assert. Callers
 * fail-closed (skip upsert / skip row); never invent a summary.
 *
 * INV-QASK-OPT-1: omit unset `optionsPreview` (0× invent `[]` via `?? []`);
 * absent/non-array → omit field. Empty / blank-only labels still omit.
 *
 * INV-QASK-TTL-1: `titleFromQuestion` — 0× invent `'Question'` when
 * header / question / override are all empty; withhold mint (row + preview
 * item) when no real title. Out of scope: QASK-SING/ID/OPT redo; demux
 * display Held; ContinueGeneration.
 *
 * INV-QASK-SYN-1: `timelineItemsFromQuestionAsk` — 0× invent synthetic `q_0`
 * when `questions.length === 0`; empty → withhold `[]` even with title
 * override. Out of scope: TTL redo; ContinueGeneration.
 *
 * INV-QAI-OWN-1: items[].id is own-data only (descriptor value; no accessor).
 * Missing own / accessor / non-string → blank-isomorphic. Each index snapshots
 * id once for count + projection (TOCTOU-closed).
 */

import type { QuestionSummaryItem, TimelineItemId, TimelineItemView } from './types.js'

/** INV-SPC-13: bounded option label preview only (O(10²) chars). */
export const QUESTION_OPTION_PREVIEW_MAX = 120

/** ADR-018: bounded sub-questions on parent summary (preview-only). */
export const QUESTION_ITEMS_PREVIEW_MAX = 4

/** ADR-018: bounded options per item on parent summary. */
export const QUESTION_ITEM_OPTIONS_PREVIEW_MAX = 4

/**
 * Fallback **display** child key when `questions[i].id` is missing/blank.
 * Textual twin of legacy ui `q_0` — **禁止**进入 `items[].id` 或 wire answers（INV-QKEY-2）。
 */
export const QUESTION_ASK_FALLBACK_CHILD_KEY = 'q_0'

/**
 * Mapper-only input SSOT (dual of ClientToolCallChromeInput).
 * Field subset of demux `arm:'question'` body — do not invent a second shape.
 */
export type QuestionAskChromeInput = {
	/** Stable parent id ≡ respond correlation (wire questionId). */
	readonly questionId: string
	readonly questions: ReadonlyArray<{
		readonly id?: string
		readonly header?: string
		readonly question?: string
		readonly optionsPreview?: readonly string[]
		readonly multiSelect?: boolean
		readonly allowCustom?: boolean
	}>
}

export type QuestionAskItemsProjection = {
	readonly items: readonly QuestionSummaryItem[]
	readonly answerKeysValid: boolean
}

function truncatePreview(raw: string, max: number): string | undefined {
	const trimmed = raw.trim()
	if (trimmed.length === 0) return undefined
	if (trimmed.length <= max) return trimmed
	return `${trimmed.slice(0, Math.max(0, max - 1))}…`
}

/**
 * INV-QASK-TTL-1: real title only — override → header → question;
 * all empty / whitespace → `undefined` (0× invent `'Question'`).
 */
function titleFromQuestion(
	q:
		| {
				readonly header?: string
				readonly question?: string
			}
		| undefined,
	override?: string,
): string | undefined {
	// INV-QASK-TTL-1: 0× invent `'Question'` when all sources empty.
	const fromOverride = override?.trim()
	if (fromOverride) return fromOverride
	const header = q?.header?.trim()
	if (header) return header
	const question = q?.question?.trim()
	if (question) return question
	return undefined
}

function optionsPreviewFromQuestion(
	q: { readonly optionsPreview?: readonly string[] } | undefined,
	maxOptions: number,
): readonly string[] | undefined {
	// INV-QASK-OPT-1: omit unset optionsPreview (0× invent [] via ?? []).
	const raw = q?.optionsPreview
	if (!Array.isArray(raw)) return undefined
	const optionsPreviewRaw = raw
		.map((label) => truncatePreview(label, QUESTION_OPTION_PREVIEW_MAX))
		.filter((label): label is string => label !== undefined)
		.slice(0, maxOptions)
	return optionsPreviewRaw.length > 0 ? (optionsPreviewRaw as readonly string[]) : undefined
}

/** INV-QAI-OWN-1: own data property only; never invoke accessors. */
function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

/**
 * Ask-level items projection (ADR-018 · INV-QKEY-4 · INV-QKEY-PROTO-1 · Grok MF-1).
 * Detect blank/duplicate/`__proto__` ids on the **full** source array before truncation;
 * never synthesize `q_i` into `items[].id`.
 * INV-QKEY-PROTO-1: trim 后 `'__proto__'` 与 blank 同构 — 不进 idCounts / surviving；
 * `constructor` / `prototype` 合法，逐字保留。
 * INV-QAI-OWN-1: own-data `id` only; non-own / accessor / non-string → blank-isomorphic.
 * Each index snapshots `id` once for count and projection passes.
 */
export function projectQuestionAskItems(
	questions: QuestionAskChromeInput['questions'],
): QuestionAskItemsProjection {
	const blankIndexes = new Set<number>()
	const unsafeIndexes = new Set<number>()
	const idCounts = new Map<string, number>()
	const idSnapshots: Array<string | undefined> = []

	for (let i = 0; i < questions.length; i++) {
		const q = questions[i]
		if (q === null || typeof q !== 'object') {
			blankIndexes.add(i)
			continue
		}
		const rawId = readOwnDataValue(q as object, 'id')
		if (typeof rawId !== 'string') {
			blankIndexes.add(i)
			continue
		}
		const id = rawId.trim()
		if (id.length === 0) {
			blankIndexes.add(i)
			continue
		}
		if (id === '__proto__') {
			unsafeIndexes.add(i)
			continue
		}
		idSnapshots[i] = id
		idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
	}

	const duplicateIds = new Set<string>()
	for (const [id, count] of idCounts) {
		if (count > 1) duplicateIds.add(id)
	}

	const answerKeysValid =
		blankIndexes.size === 0 && duplicateIds.size === 0 && unsafeIndexes.size === 0

	const surviving: QuestionSummaryItem[] = []
	for (let i = 0; i < questions.length; i++) {
		if (blankIndexes.has(i) || unsafeIndexes.has(i)) continue
		const id = idSnapshots[i]
		if (id === undefined) continue
		if (duplicateIds.has(id)) continue
		const q = questions[i]!

		// INV-QASK-TTL-1: withhold preview item mint when header/question empty
		// (0× invent `'Question'`).
		const title = titleFromQuestion(q)
		if (title === undefined) continue

		const optionsPreview = optionsPreviewFromQuestion(q, QUESTION_ITEM_OPTIONS_PREVIEW_MAX)
		const multiSelect = q.multiSelect === true ? true : undefined
		const allowCustom = q.allowCustom === true ? true : undefined

		surviving.push({
			id,
			title,
			...(optionsPreview !== undefined ? { optionsPreview } : {}),
			...(multiSelect !== undefined ? { multiSelect } : {}),
			...(allowCustom !== undefined ? { allowCustom } : {}),
		})
	}

	return {
		items: surviving.slice(0, QUESTION_ITEMS_PREVIEW_MAX),
		answerKeysValid,
	}
}

/**
 * Child key for **display** compound row id only (INV-QAF-2).
 * Empty/missing `id` → `q_${index}` (`q_0` at index 0).
 * **Not** a pending requestId; **not** a wire answers key（ADR-018 INV-QKEY-2）.
 */
export function questionAskChildKey(
	question: { readonly id?: string } | undefined,
	index: number,
): string {
	const id = question?.id?.trim()
	if (id) return id
	// index 0 → `q_0` ≡ QUESTION_ASK_FALLBACK_CHILD_KEY（展示 only）
	return `q_${index}`
}

/**
 * Stable Timeline / display row id (INV-QAF-2 · INV-QASK-ID-2).
 * Parent questionId + childKey — unique across concurrent asks.
 * questionId is verbatim (exact-canonical admit at mint); 0× trim-write.
 *
 * **Not** a pending `requestId` (INV-QAP-2). Top-level pending uses
 * {@link questionAskPendingRequestId} ≡ questionId (1× parent · ADR-017 Am.1).
 */
export function questionAskItemId(questionId: string, childKey: string): string {
	return `${questionId}:${childKey}`
}

/**
 * Top-level pending / respond correlation id (INV-QAP-1 / ADR-017 Amendment 1 ·
 * INV-QASK-ID-2). Always ≡ wire `questionId` verbatim — never the compound
 * display id; 0× trim-write.
 */
export function questionAskPendingRequestId(questionId: string): string {
	return questionId
}

function summaryFromQuestion(
	q:
		| {
				readonly header?: string
				readonly question?: string
				readonly optionsPreview?: readonly string[]
				readonly multiSelect?: boolean
				readonly allowCustom?: boolean
			}
		| undefined,
	askItems: QuestionAskItemsProjection,
	titleOverride?: string,
): TimelineItemView['summary'] | undefined {
	// INV-QASK-TTL-1: withhold summary mint when no real title (0× `'Question'`).
	const title = titleFromQuestion(q, titleOverride)
	if (title === undefined) return undefined

	const optionsPreview = optionsPreviewFromQuestion(q, Number.POSITIVE_INFINITY)
	const multiSelect = q?.multiSelect === true ? true : undefined
	const allowCustom = q?.allowCustom === true ? true : undefined

	return {
		kind: 'question',
		title,
		...(optionsPreview !== undefined ? { optionsPreview } : {}),
		...(multiSelect !== undefined ? { multiSelect } : {}),
		...(allowCustom !== undefined ? { allowCustom } : {}),
		items: askItems.items,
		answerKeysValid: askItems.answerKeysValid,
	}
}

/** INV-QAC-ADDR-1: local view-layer bound; not upstream SSOT; not exported. */
const QUESTION_ASK_CORRELATION_MAX = 128

const QUESTION_ASK_STRINGIFY_GARBAGE = new Set(['undefined', 'null', '[object Object]', 'NaN'])

/** INV-VIEW-CTRL-1: no-control-regex — C0/DEL via charCode instead of /[\u0000-\u001f\u007f]/ regex. */
function hasControlChar(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i)
		if (code <= 0x1f || code === 0x7f) return true
	}
	return false
}

/**
 * INV-QASK-ID-2: exact-canonical parent questionId (non-empty ∧ trim-identity).
 * Check-only — never written back. File-private.
 */
function isQuestionAskExactCanonicalId(value: string): boolean {
	return value.length > 0 && value === value.trim()
}

/**
 * INV-QAC-ADDR-1: addressable parent questionId for respond correlation.
 * Requires exact-canonical (INV-QASK-ID-2) then refuse proto / garbage /
 * control / oversized. Trim is check-only; never write back. File-private.
 */
function isQuestionAskCorrelationAddress(value: string): boolean {
	if (typeof value !== 'string') return false
	if (!isQuestionAskExactCanonicalId(value)) return false
	if (value === '__proto__') return false
	if (QUESTION_ASK_STRINGIFY_GARBAGE.has(value)) return false
	if (hasControlChar(value)) return false
	return value.length <= QUESTION_ASK_CORRELATION_MAX
}

/**
 * Maps a questionEvent side-effect body onto N U1 question summary rows (INV-QAF-1).
 * INV-QASK-SYN-1: empty `questions` → withhold mint (`[]`); 0× invent synthetic
 * `q_0` even when a title override is present.
 * Row ids are compound display ids only — pending remains 1× parent (INV-QAP-1).
 * Every summary carries the same ask-level `items` + `answerKeysValid` (ADR-018).
 * INV-QASK-ID-2: non-exact-canonical parent withholds mint (`[]`); 0× trim-write.
 * INV-QAC-ADDR-1: exact-canonical but unaddressable parent withholds
 * `answerKeysValid` only.
 * INV-QASK-TTL-1: header/question/override all empty → withhold row (0× `'Question'`).
 */
export function timelineItemsFromQuestionAsk(
	input: QuestionAskChromeInput,
	options?: {
		readonly title?: string
		readonly orderKey?: string
	},
): readonly TimelineItemView[] {
	// INV-QASK-ID-2: exact-canonical admit; padded / blank → withhold mint.
	if (!isQuestionAskExactCanonicalId(input.questionId)) {
		return []
	}
	// INV-QASK-SYN-1: empty questions → withhold (0× invent synthetic q_0).
	if (input.questions.length === 0) {
		return []
	}
	const questionId = input.questionId
	const correlationOk = isQuestionAskCorrelationAddress(questionId)
	const sources = input.questions

	const projected = projectQuestionAskItems(input.questions)
	const askItems = correlationOk ? projected : { items: projected.items, answerKeysValid: false }
	const orderKeyBase = options?.orderKey?.trim()

	const rows: TimelineItemView[] = []
	for (let index = 0; index < sources.length; index++) {
		const q = sources[index]
		const summary = summaryFromQuestion(q, askItems, options?.title)
		// INV-QASK-TTL-1: no real title → withhold row mint (0× invent `'Question'`).
		if (summary === undefined) continue
		const childKey = questionAskChildKey(q, index)
		const id = questionAskItemId(questionId, childKey)
		const orderKey = orderKeyBase ? questionAskItemId(orderKeyBase, childKey) : id
		rows.push({
			id: id as TimelineItemId,
			orderKey,
			summary,
		})
	}
	return rows
}

/**
 * First fan-out row only — Actor / fixture compat (Actor still 1× parent pending
 * via {@link questionAskPendingRequestId}; compound row id is display-only).
 * Prefer {@link timelineItemsFromQuestionAsk} for multi-question display SSOT.
 * Parent pending summary includes full ask-level `items` (ADR-018).
 * INV-QASK-SING-1: empty mint (INV-QASK-ID-2 padded/blank) → `undefined`;
 * never non-null-assert `[0]`.
 */
export function timelineItemFromQuestionAsk(
	input: QuestionAskChromeInput,
	options?: {
		readonly title?: string
		readonly orderKey?: string
	},
): TimelineItemView | undefined {
	return timelineItemsFromQuestionAsk(input, options)[0]
}
