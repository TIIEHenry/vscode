/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode } from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { summarizeTrajectoryProcessSteps } from './conversationProcessFoldModel.js';
import {
	conversationLensSessionBarNoTrajectory,
	conversationLensSessionBarTrajectoryListAria,
} from './conversationLensSessionBarStrings.js';
import {
	buildTrajectoryTableViewModel,
	ConversationTrajectoryKind,
	ConversationTrajectoryRecord,
	findTurnIdForTrajectoryRecord,
	TrajectoryTableDisplayItem,
} from './conversationTrajectoryModel.js';

export const conversationTrajectoryKindUser = localize('conversationTrajectory.kindUser', "USER");
export const conversationTrajectoryKindContext = localize('conversationTrajectory.kindContext', "CONTEXT");
export const conversationTrajectoryKindSystem = localize('conversationTrajectory.kindSystem', "SYSTEM");
export const conversationTrajectoryKindAssistant = localize('conversationTrajectory.kindAssistant', "ASSISTANT");
export const conversationTrajectoryKindTool = localize('conversationTrajectory.kindTool', "TOOL");
export const conversationTrajectoryKindSubtool = localize('conversationTrajectory.kindSubtool', "SUBTOOL");
export const conversationTrajectoryKindThinking = localize('conversationTrajectory.kindThinking', "THINKING");
export const conversationTrajectoryKindCompacted = localize('conversationTrajectory.kindCompacted', "COMPACTED");

export const conversationTrajectoryInspectorSummary = localize('conversationTrajectory.inspectorSummary', "Summary");
export const conversationTrajectoryInspectorPayload = localize('conversationTrajectory.inspectorPayload', "Payload");
export const conversationTrajectoryInspectorResult = localize('conversationTrajectory.inspectorResult', "Result");
export const conversationTrajectoryInspectorClose = localize('conversationTrajectory.inspectorClose', "Close inspector");
export const conversationTrajectoryTableKindColumn = localize('conversationTrajectory.tableKind', "Kind");
export const conversationTrajectoryTablePreviewColumn = localize('conversationTrajectory.tablePreview', "Preview");
export const conversationTrajectorySearchPlaceholder = localize('conversationTrajectory.searchPlaceholder', "Search trajectory");
export const conversationTrajectorySearchAria = localize('conversationTrajectory.searchAria', "Filter trajectory records");
export const conversationTrajectoryLimitNotice = localize(
	'conversationTrajectory.limitNotice',
	"Showing the most recent {0} of {1} records. Older records are omitted.",
);

export function formatConversationTrajectoryLimitNotice(visibleCount: number, totalCount: number): string {
	return conversationTrajectoryLimitNotice
		.replace('{0}', String(visibleCount))
		.replace('{1}', String(totalCount));
}

const TRAJECTORY_SUBTOOL_INDENT_PX = 12;
const TRAJECTORY_ROW_HEIGHT = 28;
const TRAJECTORY_FOLD_HEADER_HEIGHT = 28;
const TRAJECTORY_SEARCH_DEBOUNCE_MS = 150;

/** Kind column label for trajectory record rows. */
export function getTrajectoryKindLabel(kind: ConversationTrajectoryKind): string {
	switch (kind) {
		case 'user':
			return conversationTrajectoryKindUser;
		case 'context':
			return conversationTrajectoryKindContext;
		case 'system':
			return conversationTrajectoryKindSystem;
		case 'message':
			return conversationTrajectoryKindAssistant;
		case 'tool':
			return conversationTrajectoryKindTool;
		case 'subtool':
			return conversationTrajectoryKindSubtool;
		case 'thinking':
			return conversationTrajectoryKindThinking;
		case 'compacted':
			return conversationTrajectoryKindCompacted;
	}
}

/** One-line preview for trajectory table navigation. */
export function getTrajectoryRecordPreview(record: ConversationTrajectoryRecord): string {
	if (record.kind === 'user' && record.sourceBlocks?.length) {
		const chips = record.sourceBlocks.map(block => block.toolName ?? block.content).join(', ');
		const trimmed = record.text.trim();
		return trimmed ? `${trimmed} · ${chips}` : chips;
	}

	const trimmed = record.text.trim();
	if (!trimmed) {
		return localize('conversationTrajectory.emptyPreview', "(empty)");
	}
	return trimmed.length > 120 ? `${trimmed.slice(0, 119)}…` : trimmed;
}

export interface IConversationTrajectoryOptions {
	readonly onNavigateToLinkedTurn?: (turnId: string) => void;
}

interface ITrajectoryRecordTemplateData {
	readonly row: HTMLElement;
}

interface ITrajectoryFoldTemplateData {
	readonly root: HTMLElement;
	readonly header: HTMLButtonElement;
	readonly chevron: HTMLElement;
	readonly summary: HTMLElement;
	readonly children: HTMLElement;
}

interface ITrajectoryTableHost {
	readonly selectedRecordId: string | undefined;
	isFoldExpanded(spanId: string): boolean;
	onSelectRecord(record: ConversationTrajectoryRecord, navigateToConversation: boolean): void;
	onToggleFold(spanId: string): void;
}

class TrajectoryTableDelegate implements IListVirtualDelegate<TrajectoryTableDisplayItem> {

	constructor(
		private readonly host: ITrajectoryTableHost,
	) { }

	getHeight(element: TrajectoryTableDisplayItem): number {
		if (element.type === 'record') {
			return TRAJECTORY_ROW_HEIGHT;
		}
		if (!this.host.isFoldExpanded(element.span.id)) {
			return TRAJECTORY_FOLD_HEADER_HEIGHT;
		}
		return TRAJECTORY_FOLD_HEADER_HEIGHT + element.span.records.length * TRAJECTORY_ROW_HEIGHT;
	}

	getTemplateId(element: TrajectoryTableDisplayItem): string {
		return element.type === 'fold' ? TrajectoryFoldRenderer.TEMPLATE_ID : TrajectoryRecordRenderer.TEMPLATE_ID;
	}

	hasDynamicHeight(): boolean {
		return true;
	}
}

class TrajectoryRecordRenderer implements IListRenderer<TrajectoryTableDisplayItem, ITrajectoryRecordTemplateData> {

	static readonly TEMPLATE_ID = 'conversationTrajectoryRecord';

	readonly templateId = TrajectoryRecordRenderer.TEMPLATE_ID;

	constructor(
		private readonly host: ITrajectoryTableHost,
		private readonly renderDisposables: DisposableStore,
	) { }

	renderTemplate(container: HTMLElement): ITrajectoryRecordTemplateData {
		const row = append(container, $('.conversation-lens-trajectory-record-row'));
		row.setAttribute('role', 'row');
		row.tabIndex = 0;
		append(row, $('.conversation-lens-trajectory-table-kind')).setAttribute('role', 'cell');
		append(row, $('.conversation-lens-trajectory-table-preview')).setAttribute('role', 'cell');
		return { row };
	}

	renderElement(element: TrajectoryTableDisplayItem, _index: number, templateData: ITrajectoryRecordTemplateData): void {
		if (element.type !== 'record') {
			return;
		}
		populateTrajectoryRecordRow(templateData.row, element.record, this.host.selectedRecordId);
	}

	disposeTemplate(): void {
		// noop
	}
}

class TrajectoryFoldRenderer implements IListRenderer<TrajectoryTableDisplayItem, ITrajectoryFoldTemplateData> {

	static readonly TEMPLATE_ID = 'conversationTrajectoryFold';

	readonly templateId = TrajectoryFoldRenderer.TEMPLATE_ID;

	constructor(
		private readonly host: ITrajectoryTableHost,
		private readonly renderDisposables: DisposableStore,
	) { }

	renderTemplate(container: HTMLElement): ITrajectoryFoldTemplateData {
		const root = append(container, $('div.conversation-process-fold'));
		root.setAttribute('data-process-fold', '');

		const header = append(root, $('button.conversation-process-fold-header')) as HTMLButtonElement;
		header.type = 'button';
		header.setAttribute('role', 'button');

		const chevron = append(header, $('span.conversation-process-fold-chevron'));
		chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));

		const summary = append(header, $('span.conversation-process-fold-summary'));
		const children = append(root, $('div.conversation-process-fold-children'));

		return { root, header, chevron, summary, children };
	}

	renderElement(element: TrajectoryTableDisplayItem, _index: number, templateData: ITrajectoryFoldTemplateData): void {
		if (element.type !== 'fold') {
			return;
		}

		const span = element.span;
		const expanded = this.host.isFoldExpanded(span.id);
		templateData.root.dataset.foldId = span.id;
		templateData.header.setAttribute('aria-expanded', String(expanded));
		templateData.summary.textContent = summarizeTrajectoryProcessSteps(span);
		templateData.chevron.classList.toggle('conversation-process-fold-chevron--expanded', expanded);
		templateData.children.hidden = !expanded;
		clearNode(templateData.children);

		if (expanded) {
			for (const record of span.records) {
				const row = append(templateData.children, $('.conversation-lens-trajectory-record-row'));
				populateTrajectoryRecordRow(row, record, this.host.selectedRecordId);
			}
		}

		this.renderDisposables.add(addDisposableListener(templateData.header, 'click', (e) => {
			e.stopPropagation();
			this.host.onToggleFold(span.id);
		}));
	}

	disposeTemplate(): void {
		// noop
	}
}

class TrajectoryTableAccessibilityProvider implements IListAccessibilityProvider<TrajectoryTableDisplayItem> {
	getWidgetAriaLabel(): string {
		return conversationLensSessionBarTrajectoryListAria;
	}

	getAriaLabel(element: TrajectoryTableDisplayItem): string {
		if (element.type === 'record') {
			return `${getTrajectoryKindLabel(element.record.kind)}: ${getTrajectoryRecordPreview(element.record)}`;
		}
		return summarizeTrajectoryProcessSteps(element.span);
	}
}

/**
 * Trajectory lens: searchable virtualized record table + local inspector with process-fold overlay (default expanded).
 */
export class ConversationTrajectory extends Disposable implements ITrajectoryTableHost {

	private readonly host: HTMLElement;
	private readonly emptyState: HTMLElement;
	private readonly body: HTMLElement;
	private readonly toolbar: HTMLElement;
	private readonly searchInput: HTMLInputElement;
	private readonly limitNotice: HTMLElement;
	private readonly table: HTMLElement;
	private readonly tableScroll: HTMLElement;
	private readonly inspector: HTMLElement;
	private readonly inspectorContent: HTMLElement;
	private readonly renderDisposables = this._register(new DisposableStore());
	private readonly processFoldOuterExpanded = new Map<string, boolean>();
	private readonly selectedRecordIdHolder = { current: undefined as string | undefined };
	private readonly linkedTurnIds = { current: new Set<string>() };
	private readonly listDelegate: TrajectoryTableDelegate;
	private readonly list: WorkbenchList<TrajectoryTableDisplayItem>;
	private readonly searchScheduler: RunOnceScheduler;
	private currentRecords: readonly ConversationTrajectoryRecord[] = [];
	private displayItems: readonly TrajectoryTableDisplayItem[] = [];
	private searchQuery = '';
	private omittedCount = 0;
	private pendingRevealRecordId: string | undefined;
	private listHeight = 0;
	private listWidth = 0;
	private visible = false;

	constructor(
		parent: HTMLElement,
		private readonly options: IConversationTrajectoryOptions,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		this.host = append(parent, $('.conversation-lens-trajectory'));
		this.host.hidden = true;
		this.host.setAttribute('role', 'region');
		this.host.setAttribute('aria-label', conversationLensSessionBarTrajectoryListAria);

		this.emptyState = append(this.host, $('.conversation-lens-trajectory-empty'));
		append(this.emptyState, $('p.conversation-lens-trajectory-empty-title')).textContent =
			conversationLensSessionBarNoTrajectory;

		this.body = append(this.host, $('.conversation-lens-trajectory-body'));
		this.body.hidden = true;

		this.toolbar = append(this.body, $('.conversation-lens-trajectory-toolbar'));
		this.searchInput = append(this.toolbar, $('input.conversation-lens-trajectory-search')) as HTMLInputElement;
		this.searchInput.type = 'search';
		this.searchInput.placeholder = conversationTrajectorySearchPlaceholder;
		this.searchInput.setAttribute('aria-label', conversationTrajectorySearchAria);
		this.searchInput.autocomplete = 'off';
		this.searchInput.spellcheck = false;

		this.limitNotice = append(this.body, $('.conversation-lens-trajectory-limit-notice'));
		this.limitNotice.hidden = true;
		this.limitNotice.setAttribute('role', 'status');

		this.table = append(this.body, $('.conversation-lens-trajectory-table'));
		this.table.setAttribute('role', 'table');

		const headerRow = append(this.table, $('.conversation-lens-trajectory-table-header'));
		headerRow.setAttribute('role', 'row');
		const kindHeader = append(headerRow, $('.conversation-lens-trajectory-table-kind-header'));
		kindHeader.setAttribute('role', 'columnheader');
		kindHeader.textContent = conversationTrajectoryTableKindColumn;
		const previewHeader = append(headerRow, $('.conversation-lens-trajectory-table-preview-header'));
		previewHeader.setAttribute('role', 'columnheader');
		previewHeader.textContent = conversationTrajectoryTablePreviewColumn;

		this.tableScroll = append(this.table, $('.conversation-lens-trajectory-table-scroll'));

		this.listDelegate = new TrajectoryTableDelegate(this);
		this.list = this._register(instantiationService.createInstance(
			WorkbenchList,
			'ConversationTrajectoryTable',
			this.tableScroll,
			this.listDelegate,
			[
				new TrajectoryRecordRenderer(this, this.renderDisposables),
				new TrajectoryFoldRenderer(this, this.renderDisposables),
			],
			{
				identityProvider: {
					getId: (element: TrajectoryTableDisplayItem) =>
						element.type === 'record' ? element.record.id : element.span.id,
				},
				accessibilityProvider: new TrajectoryTableAccessibilityProvider(),
				openOnSingleClick: true,
				mouseSupport: true,
				keyboardSupport: true,
			},
		)) as WorkbenchList<TrajectoryTableDisplayItem>;

		this._register(addDisposableListener(this.tableScroll, 'click', (e) => {
			this.activateRecordFromTableRow(e.target as HTMLElement);
		}));
		this._register(addDisposableListener(this.tableScroll, 'keydown', (e) => {
			if (e.key !== 'Enter' && e.key !== ' ') {
				return;
			}
			const row = this.resolveTrajectoryRecordRow(e.target as HTMLElement);
			if (!row) {
				return;
			}
			e.preventDefault();
			this.activateRecordFromTableRow(row);
		}));

		this.searchScheduler = this._register(new RunOnceScheduler(() => {
			this.searchQuery = this.searchInput.value;
			this.refreshTable();
		}, TRAJECTORY_SEARCH_DEBOUNCE_MS));

		this._register(addDisposableListener(this.searchInput, 'input', () => {
			this.searchScheduler.schedule();
		}));

		this.inspector = append(this.body, $('.conversation-lens-trajectory-inspector'));
		this.inspector.hidden = true;

		const inspectorHeader = append(this.inspector, $('.conversation-lens-trajectory-inspector-header'));
		const inspectorTitle = append(inspectorHeader, $('span.conversation-lens-trajectory-inspector-title'));
		inspectorTitle.textContent = localize('conversationTrajectory.inspectorTitle', "Inspector");

		const closeButton = append(inspectorHeader, $('button.conversation-lens-trajectory-inspector-close')) as HTMLButtonElement;
		closeButton.type = 'button';
		closeButton.setAttribute('aria-label', conversationTrajectoryInspectorClose);
		closeButton.classList.add(...ThemeIcon.asClassNameArray(Codicon.close));
		this._register(addDisposableListener(closeButton, 'click', () => this.closeInspector()));

		this.inspectorContent = append(this.inspector, $('.conversation-lens-trajectory-inspector-content'));
	}

	get selectedRecordId(): string | undefined {
		return this.selectedRecordIdHolder.current;
	}

	isFoldExpanded(spanId: string): boolean {
		return this.processFoldOuterExpanded.get(spanId) ?? true;
	}

	onSelectRecord(record: ConversationTrajectoryRecord, navigateToConversation: boolean): void {
		this.selectRecord(record, navigateToConversation);
	}

	onToggleFold(spanId: string): void {
		this.processFoldOuterExpanded.set(spanId, !this.isFoldExpanded(spanId));
		this.refreshTable();
	}

	show(): void {
		this.visible = true;
		this.host.hidden = false;
	}

	hide(): void {
		this.visible = false;
		this.host.hidden = true;
	}

	isVisible(): boolean {
		return this.visible;
	}

	setRecords(records: readonly ConversationTrajectoryRecord[], linkedTurnIds?: ReadonlySet<string>): void {
		this.currentRecords = records;
		if (linkedTurnIds) {
			this.linkedTurnIds.current = new Set(linkedTurnIds);
		}
		this.refreshTable();
	}

	revealRecord(recordId: string): void {
		const record = this.currentRecords.find(candidate => candidate.id === recordId);
		if (!record) {
			return;
		}

		const viewModel = buildTrajectoryTableViewModel(this.currentRecords, this.searchQuery);
		const visibleRecord = viewModel.items.some(item =>
			item.type === 'record'
				? item.record.id === recordId
				: item.span.recordIds.includes(recordId),
		);
		if (!visibleRecord) {
			return;
		}

		for (const item of viewModel.items) {
			if (item.type === 'fold' && item.span.recordIds.includes(recordId)) {
				this.processFoldOuterExpanded.set(item.span.id, true);
				break;
			}
		}

		this.pendingRevealRecordId = recordId;
		this.selectedRecordIdHolder.current = recordId;
		this.refreshTable();
		this.selectRecord(record, false);
	}

	layout(height: number, width: number): void {
		this.listHeight = Math.max(0, height - 160);
		this.listWidth = width;
		if (this.displayItems.length > 0) {
			this.list.layout(this.listHeight, this.listWidth);
		}
	}

	private refreshTable(): void {
		this.renderDisposables.clear();

		const viewModel = buildTrajectoryTableViewModel(this.currentRecords, this.searchQuery);
		this.displayItems = viewModel.items;
		this.omittedCount = viewModel.omittedCount;

		const empty = viewModel.totalCount === 0;
		this.emptyState.style.display = empty ? '' : 'none';
		this.body.hidden = empty;

		if (empty) {
			this.closeInspector();
			this.limitNotice.hidden = true;
			this.list.splice(0, this.list.length, []);
			return;
		}

		this.limitNotice.hidden = this.omittedCount === 0;
		if (this.omittedCount > 0) {
			this.limitNotice.textContent = formatConversationTrajectoryLimitNotice(
				viewModel.visibleRecordCount,
				viewModel.totalCount,
			);
		}

		const selectedStillVisible = this.selectedRecordIdHolder.current
			&& viewModel.items.some(item =>
				item.type === 'record'
					? item.record.id === this.selectedRecordIdHolder.current
					: item.span.recordIds.includes(this.selectedRecordIdHolder.current!),
			);
		if (this.selectedRecordIdHolder.current && !selectedStillVisible) {
			this.closeInspector();
		} else if (this.selectedRecordIdHolder.current && selectedStillVisible) {
			const selected = this.currentRecords.find(record => record.id === this.selectedRecordIdHolder.current);
			if (selected) {
				this.openInspector(selected);
			}
		}

		this.list.splice(0, this.list.length, [...viewModel.items]);
		if (this.listHeight > 0 && this.listWidth > 0) {
			this.list.layout(this.listHeight, this.listWidth);
		}

		if (this.pendingRevealRecordId) {
			const recordId = this.pendingRevealRecordId;
			this.pendingRevealRecordId = undefined;
			this.scrollRecordIntoView(recordId);
		}
	}

	private scrollRecordIntoView(recordId: string): void {
		const index = this.displayItems.findIndex(item =>
			item.type === 'record'
				? item.record.id === recordId
				: item.span.recordIds.includes(recordId),
		);
		if (index >= 0) {
			this.list.reveal(index, 0.5);
		}
	}

	private selectRecord(record: ConversationTrajectoryRecord, navigateToConversation: boolean): void {
		const linkedTurnId = findTurnIdForTrajectoryRecord(record, this.linkedTurnIds.current);
		if (navigateToConversation && linkedTurnId && this.options.onNavigateToLinkedTurn) {
			this.options.onNavigateToLinkedTurn(linkedTurnId);
			return;
		}

		this.selectedRecordIdHolder.current = record.id;
		this.syncTrajectoryRowSelectionStyles();
		this.openInspector(record);
	}

	private openInspector(record: ConversationTrajectoryRecord): void {
		this.inspector.hidden = false;
		clearNode(this.inspectorContent);

		appendInspectorSection(this.inspectorContent, conversationTrajectoryInspectorSummary, record.text);

		const payload = buildInspectorPayload(record);
		if (payload) {
			appendInspectorSection(this.inspectorContent, conversationTrajectoryInspectorPayload, payload);
		}

		const result = record.result ?? record.outputDetail;
		if (result && (record.kind === 'tool' || record.kind === 'subtool' || record.kind === 'thinking')) {
			appendInspectorSection(this.inspectorContent, conversationTrajectoryInspectorResult, result);
		}
	}

	private closeInspector(): void {
		this.selectedRecordIdHolder.current = undefined;
		this.inspector.hidden = true;
		clearNode(this.inspectorContent);
		this.syncTrajectoryRowSelectionStyles();
	}

	/** T5 virtual list `rerender()` does not re-run row renderers; sync selection chrome in DOM. */
	private syncTrajectoryRowSelectionStyles(): void {
		const selectedId = this.selectedRecordIdHolder.current;
		for (const row of this.host.querySelectorAll('.conversation-lens-trajectory-record-row')) {
			const recordId = row.getAttribute('data-record-id');
			const selected = !!selectedId && recordId === selectedId;
			row.classList.toggle('conversation-lens-trajectory-record-row--selected', selected);
			row.setAttribute('aria-selected', String(selected));
		}
	}

	private resolveTrajectoryRecordRow(target: HTMLElement): HTMLElement | undefined {
		const row = target.closest('.conversation-lens-trajectory-record-row');
		if (!row || !this.tableScroll.contains(row)) {
			return undefined;
		}
		return row as HTMLElement;
	}

	private activateRecordFromTableRow(target: HTMLElement): void {
		const row = this.resolveTrajectoryRecordRow(target);
		if (!row) {
			return;
		}
		const recordId = row.getAttribute('data-record-id');
		if (!recordId) {
			return;
		}
		const record = this.currentRecords.find(candidate => candidate.id === recordId);
		if (record) {
			this.selectRecord(record, true);
		}
	}
}

function populateTrajectoryRecordRow(
	row: HTMLElement,
	record: ConversationTrajectoryRecord,
	selectedRecordId: string | undefined,
): void {
	clearNode(row);
	row.setAttribute('data-record-id', record.id);
	row.setAttribute('data-kind', record.kind);
	row.tabIndex = 0;

	const depth = record.depth ?? 0;
	row.style.paddingInlineStart = depth > 0 ? `${depth * TRAJECTORY_SUBTOOL_INDENT_PX}px` : '';
	row.classList.toggle('conversation-lens-trajectory-record-row--indented', depth > 0);

	const kindCell = append(row, $('.conversation-lens-trajectory-table-kind'));
	kindCell.setAttribute('role', 'cell');
	kindCell.textContent = getTrajectoryKindLabel(record.kind);

	const previewCell = append(row, $('.conversation-lens-trajectory-table-preview'));
	previewCell.setAttribute('role', 'cell');
	previewCell.textContent = getTrajectoryRecordPreview(record);

	if (record.sourceBlocks?.length) {
		for (const block of record.sourceBlocks) {
			const chip = append(previewCell, $('span.conversation-lens-trajectory-source-block'));
			chip.textContent = block.toolName ?? block.content;
		}
	}

	const selected = selectedRecordId === record.id;
	row.classList.toggle('conversation-lens-trajectory-record-row--selected', selected);
	row.setAttribute('aria-selected', String(selected));
}

function appendInspectorSection(parent: HTMLElement, title: string, body: string): void {
	const section = append(parent, $('.conversation-lens-trajectory-inspector-section'));
	append(section, $('h4.conversation-lens-trajectory-inspector-section-title')).textContent = title;
	const content = append(section, $('.conversation-lens-trajectory-inspector-section-body'));
	content.textContent = body;
}

function buildInspectorPayload(record: ConversationTrajectoryRecord): string | undefined {
	const parts: string[] = [];

	if (record.messageSource) {
		parts.push(`${record.messageSource.kind}${record.messageSource.label ? `: ${record.messageSource.label}` : ''}`);
	}

	if (record.environment) {
		const envParts = [record.environment.cwd, record.environment.os, record.environment.extra].filter(Boolean);
		if (envParts.length) {
			parts.push(envParts.join(' · '));
		}
	}

	if (record.promptDetail) {
		parts.push(record.promptDetail);
	}

	if (record.inputDetail) {
		parts.push(record.inputDetail);
	}

	if (record.sourceBlocks?.length) {
		for (const block of record.sourceBlocks) {
			parts.push(`${block.type}${block.toolName ? ` (${block.toolName})` : ''}: ${block.content}`);
		}
	}

	return parts.length > 0 ? parts.join('\n') : undefined;
}
