/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');

const contracts = [
	['src/vs/workbench/browser/parts/editor/media/breadcrumbscontrol.css', 'breadcrumbs-editor-type:active::after', 'breadcrumbs-editor-type:focus-visible::after'],
	['src/vs/workbench/browser/parts/editor/media/editorgroupview.css', 'editor-group-watermark-toolbar-container .action-label:active::after', 'editor-group-watermark-toolbar-container .action-label:focus-visible::after'],
	['src/vs/workbench/browser/parts/editor/media/editorgroupview.css', 'preview-category-empty-group-actions .action-label:active::after', 'preview-category-empty-group-actions .action-label:focus-visible::after'],
	['src/vs/workbench/browser/parts/editor/media/editorgroupview.css', 'editor-group-container-toolbar .action-label:active::after', 'editor-group-container-toolbar .action-label:focus-visible::after'],
	['src/vs/workbench/browser/parts/editor/media/editorquickaccess.css', 'action-label.dirty-editor:active::after', 'action-label.dirty-editor:focus-visible::after'],
	['src/vs/workbench/browser/parts/editor/media/modalEditorPart.css', 'modal-editor-action-container .actions-container .action-label:active::after', 'modal-editor-action-container .actions-container .action-label:focus-visible::after'],
	['src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css', 'tabs-container > .tab > .tab-actions .action-label:active::after', 'tabs-container > .tab > .tab-actions .action-label:focus-visible::after'],
	['src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css', 'add-tab-action:active::after', 'add-tab-action:focus-visible::after'],
	['src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css', 'editor-actions .action-item .action-label:active::after', 'editor-actions .action-item .action-label:focus-visible::after'],
	['src/vs/workbench/browser/parts/editor/media/singleeditortabscontrol.css', 'title > .title-actions .action-label:active::after', 'title > .title-actions .action-label:focus-visible::after'],
	['src/vs/workbench/contrib/debug/browser/media/debugViewlet.css', 'debug-pane .monaco-list-row .monaco-action-bar .action-label:active::after', 'debug-pane .monaco-list-row .monaco-action-bar .action-label:focus-visible::after'],
	['src/vs/workbench/contrib/preferences/browser/media/keybindingsEditor.css', 'keybindings-search-actions-container .monaco-action-bar .action-item .action-label:active::after', 'keybindings-search-actions-container .monaco-action-bar .action-item .action-label:focus-visible::after'],
	['src/vs/workbench/contrib/preferences/browser/media/settingsEditor2.css', 'search-container-widgets .action-label:not(.monaco-custom-toggle):active::after', 'search-container-widgets .action-label:not(.monaco-custom-toggle):focus-visible::after'],
	['src/vs/workbench/contrib/terminal/browser/media/terminal.css', 'tabs-list .actions .action-label:active::after', 'tabs-list .actions .action-label:focus-visible::after'],
	['src/vs/workbench/browser/parts/editor/media/singleeditortabscontrol.css', 'title.breadcrumbs .breadcrumbs-control .monaco-breadcrumb-item:active', 'title.breadcrumbs .breadcrumbs-control .monaco-breadcrumb-item:focus-visible'],
	['src/vs/workbench/contrib/debug/browser/media/debugViewlet.css', 'start-debug-action-item .configuration .monaco-dropdown > .dropdown-label:active', 'start-debug-action-item .configuration .monaco-dropdown > .dropdown-label:focus-visible'],
	['src/vs/workbench/contrib/terminal/browser/media/terminal.css', 'terminal-tabs-chat-entry:active', 'terminal-tabs-chat-entry:focus-visible'],
	['src/vs/workbench/contrib/terminal/browser/media/terminal.css', 'terminal-tabs-chat-entry-delete:active', 'terminal-tabs-chat-entry-delete:focus-visible'],
	['src/vs/workbench/contrib/comments/browser/media/panel.css', 'comments-panel-container .text a:active', 'comments-panel-container .text a:focus-visible'],
	['src/vs/workbench/contrib/search/browser/media/searchview.css', 'query-details .more:active', 'query-details .more:focus-visible'],
	['src/vs/workbench/contrib/search/browser/media/searchview.css', 'search-view .message a:active', 'search-view .message a:focus-visible'],
	['src/vs/workbench/contrib/search/browser/media/searchview.css', 'providerMessage a:active', 'providerMessage a:focus-visible'],
	['src/vs/workbench/contrib/search/browser/media/searchview.css', 'monaco-list-row .monaco-action-bar .action-label:active::after', 'monaco-list-row .monaco-action-bar .action-label:focus-visible::after'],
	['src/vs/workbench/contrib/userDataProfile/browser/media/userDataProfilesEditor.css', 'profile-tree-item-actions-container .action-label:active::after', 'profile-tree-item-actions-container .action-label:focus-visible::after'],
	['src/vs/workbench/contrib/terminal/browser/media/terminal.css', 'single-terminal-tab:active', 'single-terminal-tab:focus-visible'],
	['src/vs/workbench/contrib/terminal/browser/media/terminal.css', 'single-terminal-tab:active::after', 'single-terminal-tab:focus-visible::after'],
	['src/vs/workbench/contrib/debug/browser/media/exceptionWidget.css', 'stack-trace a:active', 'stack-trace a:focus-visible'],
	['src/vs/workbench/browser/parts/editor/media/modalEditorPart.css', 'modal-editor-nav-button.monaco-button:active:not(.disabled)', 'modal-editor-nav-button.monaco-button:focus-visible:not(.disabled)'],
] as const;

suite('Pressed interaction face ordering', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('pressed faces override focused faces while a pointer is held', () => {
		for (const [relativePath, activeMarker, focusMarker] of contracts) {
			const css = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
			const active = css.lastIndexOf(activeMarker);
			const focus = css.lastIndexOf(focusMarker);
			assert.ok(active >= 0, `${relativePath} must define ${activeMarker}`);
			assert.ok(focus >= 0, `${relativePath} must define ${focusMarker}`);
			assert.ok(active > focus, `${relativePath} must paint the pressed face after the focused face`);
		}
	});
});
