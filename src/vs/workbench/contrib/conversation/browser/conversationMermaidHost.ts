/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, getWindow } from '../../../../base/browser/dom.js';
import { IMouseWheelEvent } from '../../../../base/browser/mouseEvent.js';
import { CodeWindow } from '../../../../base/browser/window.js';
import { autorun } from '../../../../base/common/observable.js';
import { Schemas } from '../../../../base/common/network.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { asWebviewUri, webviewGenericCspSource } from '../../webview/common/webview.js';
import { IWebviewElement, IWebviewService } from '../../webview/browser/webview.js';

export const MERMAID_MARKDOWN_EXTENSION_ID = 'vscode.mermaid-markdown-features';

/** Distinct from donor chat output renderer to avoid Open-in-Editor context menu. */
export const CONVERSATION_VISUALIZE_WEBVIEW_VIEW_TYPE = 'vscode.conversation.visualizeMermaid';

export interface ConversationMermaidExtensionInfo {
	readonly extensionLocation: URI;
	readonly extensionId: ExtensionIdentifier;
}

export interface ConversationMermaidHostContext {
	readonly extensionInfo: ConversationMermaidExtensionInfo | undefined;
	readonly webviewService: IWebviewService;
	readonly targetWindow: CodeWindow;
}

export interface ConversationMermaidMountOptions {
	readonly mode: 'inline' | 'overlay';
	readonly source: string;
	readonly title?: string;
	readonly onLayoutChange?: () => void;
	readonly onWheelDelegate?: (event: IMouseWheelEvent) => void;
}

export interface ConversationMermaidMountResult {
	readonly element: HTMLElement;
	readonly fallback: boolean;
	readonly webview?: IWebviewElement;
}

export function resolveConversationMermaidExtension(
	extensionService: IExtensionService,
): Promise<ConversationMermaidExtensionInfo | undefined> {
	return extensionService.getExtension(MERMAID_MARKDOWN_EXTENSION_ID).then(extension => {
		if (!extension) {
			return undefined;
		}
		return {
			extensionLocation: extension.extensionLocation,
			extensionId: extension.identifier,
		};
	});
}

export function mountConversationMermaidHost(
	parent: HTMLElement,
	context: ConversationMermaidHostContext,
	options: ConversationMermaidMountOptions,
	disposables: DisposableStore,
): ConversationMermaidMountResult {
	const host = append(parent, $('div.conversation-visualize-mermaid-host'));
	host.setAttribute('data-mermaid-host', '');

	if (!context.extensionInfo) {
		return mountMermaidSourceFallback(host, options.source);
	}

	try {
		const mediaRoot = URI.joinPath(context.extensionInfo.extensionLocation, 'chat-webview-out');
		const webview = disposables.add(context.webviewService.createWebviewElement({
			title: options.title,
			providedViewType: CONVERSATION_VISUALIZE_WEBVIEW_VIEW_TYPE,
			options: {},
			contentOptions: {
				allowScripts: true,
				localResourceRoots: [mediaRoot],
			},
			extension: { id: context.extensionInfo.extensionId },
		}));

		webview.mountTo(host, context.targetWindow);
		webview.setHtml(buildConversationMermaidHtml(
			mediaRoot,
			context.extensionInfo.extensionLocation,
			options.source,
			options.mode === 'overlay' ? 'index-editor' : 'index',
		));

		if (options.mode === 'inline') {
			disposables.add(autorun(reader => {
				const size = reader.readObservable(webview.intrinsicContentSize);
				if (size) {
					host.style.height = `${Math.min(size.height, 240)}px`;
					options.onLayoutChange?.();
				}
			}));

			if (options.onWheelDelegate) {
				disposables.add(webview.onDidWheel(e => options.onWheelDelegate!(e)));
			}
		} else {
			host.classList.add('conversation-visualize-mermaid-host--overlay');
		}

		disposables.add(webview.onFatalError(() => {
			host.replaceChildren();
			mountMermaidSourceFallback(host, options.source);
		}));

		return { element: host, fallback: false, webview };
	} catch {
		host.replaceChildren();
		return mountMermaidSourceFallback(host, options.source);
	}
}

function mountMermaidSourceFallback(host: HTMLElement, source: string): ConversationMermaidMountResult {
	host.removeAttribute('data-mermaid-host');
	const pre = append(host, $('pre.conversation-visualize-mermaid-source')) as HTMLPreElement;
	pre.setAttribute('data-mermaid-source', '');
	pre.textContent = source.trim();
	return { element: host, fallback: true };
}

function buildConversationMermaidHtml(
	mediaRoot: URI,
	extensionLocation: URI,
	source: string,
	scriptName: 'index' | 'index-editor',
): string {
	const nonce = generateUuid();
	const scriptUri = toWebviewResourceUri(URI.joinPath(mediaRoot, `${scriptName}.js`), extensionLocation);
	const codiconsUri = toWebviewResourceUri(URI.joinPath(mediaRoot, 'codicon.css'), extensionLocation);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Mermaid Diagram</title>
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; script-src 'nonce-${nonce}'; style-src ${webviewGenericCspSource} 'unsafe-inline'; font-src data:;" />
	<link rel="stylesheet" type="text/css" href="${codiconsUri}">
	<style>
		body {
			margin: 0;
			padding: 0;
		}
		.mermaid {
			visibility: hidden;
		}
		.mermaid.rendered {
			visibility: visible;
		}
	</style>
</head>
<body>
	<span id="markdown-mermaid" aria-hidden="true" data-config="{}"></span>
	<pre class="mermaid">${escapeHtmlText(source.trim())}</pre>
	<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function toWebviewResourceUri(resource: URI, extensionLocation: URI): string {
	const remoteInfo = extensionLocation.scheme === Schemas.vscodeRemote
		? { isRemote: true, authority: extensionLocation.authority }
		: undefined;
	return asWebviewUri(resource, remoteInfo).toString(true);
}

function escapeHtmlText(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function createMermaidHostContext(
	parent: HTMLElement,
	extensionInfo: ConversationMermaidExtensionInfo | undefined,
	webviewService: IWebviewService,
): ConversationMermaidHostContext {
	return {
		extensionInfo,
		webviewService,
		targetWindow: getWindow(parent),
	};
}
