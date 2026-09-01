/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import {
	projectTrajectoryProcessFoldSpans,
	summarizeTrajectoryProcessSteps,
	TrajectoryProcessFoldSpan,
} from './conversationProcessFoldModel.js';
import {
	conversationLensSessionBarNoTrajectory,
	conversationLensSessionBarTrajectoryListAria,
} from './conversationLensSessionBarStrings.js';
import {
	ConversationTrajectoryKind,
	ConversationTrajectoryRecord,
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

const TRAJECTORY_SUBTOOL_INDENT_PX = 12;

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
	readonly onDidSelectRecord?: (recordId: string) => void;
}

/**
 * Trajectory lens: record table + local inspector with process-fold overlay (default expanded).
 */
export class ConversationTrajectory extends Disposable {

	private readonly host: HTMLElement;
	private readonly emptyState: HTMLElement;
	private readonly body: HTMLElement;
	private readonly table: HTMLElement;
	private readonly tableBody: HTMLElement;
	private readonly inspector: HTMLElement;
	private readonly inspectorContent: HTMLElement;
	private readonly renderDisposables = this._register(new DisposableStore());
	private readonly processFoldOuterExpanded = new Map<string, boolean>();
	private readonly selectedRecordId = { current: undefined as string | undefined };
	private visible = false;
	private records: readonly ConversationTrajectoryRecord[] = [];

	constructor(
		parent: HTMLElement,
		_options: IConversationTrajectoryOptions,
		@IInstantiationService _instantiationService: IInstantiationService,
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

		this.tableBody = append(this.table, $('.conversation-lens-trajectory-table-body'));
		this.tableBody.setAttribute('role', 'rowgroup');

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

	setRecords(records: readonly ConversationTrajectoryRecord[]): void {
		this.records = records;
		this.renderDisposables.clear();
		clearNode(this.tableBody);

		const empty = records.length === 0;
		this.emptyState.style.display = empty ? '' : 'none';
		this.body.hidden = empty;

		if (empty) {
			this.closeInspector();
			return;
		}

		const spans = projectTrajectoryProcessFoldSpans(records);
		const spanByStart = new Map(spans.map(span => [span.startIndex, span]));
		const foldedRecordIds = new Set(spans.flatMap(span => span.recordIds));

		for (let index = 0; index < records.length; index++) {
			const span = spanByStart.get(index);
			if (span) {
				this.renderProcessFoldSpan(span);
				index = span.endIndex - 1;
				continue;
			}

			const record = records[index]!;
			if (foldedRecordIds.has(record.id)) {
				continue;
			}
			this.renderRecordRow(this.tableBody, record);
		}

		if (this.selectedRecordId.current && !records.some(record => record.id === this.selectedRecordId.current)) {
			this.closeInspector();
		} else if (this.selectedRecordId.current) {
			const selected = records.find(record => record.id === this.selectedRecordId.current);
			if (selected) {
				this.openInspector(selected);
			}
		}
	}

	layout(_height: number, _width: number): void {
		// Plain DOM table; no virtualized list layout required for stub fixtures.
	}

	private renderProcessFoldSpan(span: TrajectoryProcessFoldSpan): void {
		const foldHost = append(this.tableBody, $('.conversation-lens-trajectory-fold-host'));
		const root = append(foldHost, $('div.conversation-process-fold'));
		root.setAttribute('data-process-fold', '');
		root.dataset.foldId = span.id;

		const outerExpanded = this.processFoldOuterExpanded.get(span.id) ?? true;

		const header = append(root, $('button.conversation-process-fold-header')) as HTMLButtonElement;
		header.type = 'button';
		header.setAttribute('role', 'button');
		header.setAttribute('aria-expanded', String(outerExpanded));

		const chevron = append(header, $('span.conversation-process-fold-chevron'));
		chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
		chevron.classList.toggle('conversation-process-fold-chevron--expanded', outerExpanded);

		const summary = append(header, $('span.conversation-process-fold-summary'));
		summary.textContent = summarizeTrajectoryProcessSteps(span);

		const children = append(root, $('div.conversation-process-fold-children'));
		children.hidden = !outerExpanded;

		for (const record of span.records) {
			this.renderRecordRow(children, record);
		}

		this.renderDisposables.add(addDisposableListener(header, 'click', (e) => {
			e.stopPropagation();
			const next = !(this.processFoldOuterExpanded.get(span.id) ?? true);
			if (next) {
				this.processFoldOuterExpanded.set(span.id, true);
			} else {
				this.processFoldOuterExpanded.delete(span.id);
			}
			header.setAttribute('aria-expanded', String(next));
			children.hidden = !next;
			chevron.classList.toggle('conversation-process-fold-chevron--expanded', next);
		}));
	}

	private renderRecordRow(parent: HTMLElement, record: ConversationTrajectoryRecord): void {
		const row = append(parent, $('.conversation-lens-trajectory-record-row'));
		row.setAttribute('role', 'row');
		row.setAttribute('data-record-id', record.id);
		row.setAttribute('data-kind', record.kind);
		row.tabIndex = 0;

		const depth = record.depth ?? 0;
		if (depth > 0) {
			row.style.paddingInlineStart = `${depth * TRAJECTORY_SUBTOOL_INDENT_PX}px`;
			row.classList.add('conversation-lens-trajectory-record-row--indented');
		}

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

		const select = () => this.selectRecord(record);
		this.renderDisposables.add(addDisposableListener(row, 'click', select));
		this.renderDisposables.add(addDisposableListener(row, 'keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				select();
			}
		}));

		if (this.selectedRecordId.current === record.id) {
			row.classList.add('conversation-lens-trajectory-record-row--selected');
			row.setAttribute('aria-selected', 'true');
		}
	}

	private selectRecord(record: ConversationTrajectoryRecord): void {
		this.selectedRecordId.current = record.id;
		for (const row of this.host.querySelectorAll('.conversation-lens-trajectory-record-row')) {
			const selected = row.getAttribute('data-record-id') === record.id;
			row.classList.toggle('conversation-lens-trajectory-record-row--selected', selected);
			row.setAttribute('aria-selected', String(selected));
		}
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
		this.selectedRecordId.current = undefined;
		this.inspector.hidden = true;
		clearNode(this.inspectorContent);
		for (const row of this.host.querySelectorAll('.conversation-lens-trajectory-record-row')) {
			row.classList.remove('conversation-lens-trajectory-record-row--selected');
			row.setAttribute('aria-selected', 'false');
		}
	}
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