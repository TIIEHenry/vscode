/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ConversationReviewNavService } from './conversationReviewNavService.js';
import { IConversationReviewNavService } from '../common/conversationReviewEntry.js';

registerSingleton(IConversationReviewNavService, ConversationReviewNavService, InstantiationType.Delayed);
