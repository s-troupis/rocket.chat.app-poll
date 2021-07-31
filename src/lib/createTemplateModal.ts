import { IModify, IPersistence } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';

import { IModalContext } from '../definition';
import { uuid } from './uuid';

export async function createTemplateModal({ id = '', question, persistence, data, modify }: {
    id?: string,
    question?: string,
    persistence: IPersistence,
    data: IModalContext,
    modify: IModify,
}): Promise<IUIKitModalViewParam> {
    const viewId = id || `create-template-modal-${uuid()}`;

    const association = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, viewId);
    await persistence.createWithAssociation(data, association);

    const block = modify.getCreator().getBlockBuilder();
    block.addInputBlock({
        blockId: 'poll',
        element: block.newPlainTextInputElement({ initialValue: question, actionId: 'question' }),
        label: block.newPlainTextObject('Insert your question'),
    })
    .addDividerBlock();

    block
        .addActionsBlock({
            blockId: 'template',
            elements: [
                block.newStaticSelectElement({
                    placeholder: block.newPlainTextObject('Select Poll Template'),
                    actionId: 'type',
                    initialValue: 'over-under',
                    options: [
                        {
                            text: block.newPlainTextObject('Overrated/Underrated Poll'),
                            value: 'over-under',
                        },
                        {
                            text: block.newPlainTextObject('1-5 Poll'),
                            value: '1-5',
                        },
                    ],
                }),
            ],
        });


        block
        .addActionsBlock({
            blockId: 'config',
            elements: [
                block.newStaticSelectElement({
                    placeholder: block.newPlainTextObject('Multiple choices'),
                    actionId: 'mode',
                    initialValue: 'multiple',
                    options: [
                        {
                            text: block.newPlainTextObject('Multiple choices'),
                            value: 'multiple',
                        },
                        {
                            text: block.newPlainTextObject('Single choice'),
                            value: 'single',
                        },
                    ],
                }),
                block.newStaticSelectElement({
                    placeholder: block.newPlainTextObject('Open vote'),
                    actionId: 'visibility',
                    initialValue: 'open',
                    options: [
                        {
                            text: block.newPlainTextObject('Open vote'),
                            value: 'open',
                        },
                        {
                            text: block.newPlainTextObject('Confidential vote'),
                            value: 'confidential',
                        },
                    ],
                })],
            })

    return {
        id: viewId,
        title: block.newPlainTextObject('Create a Poll from Template'),
        submit: block.newButtonElement({
            text: block.newPlainTextObject('Create'),
        }),
        close: block.newButtonElement({
            text: block.newPlainTextObject('Dismiss'),
        }),
        blocks: block.getBlocks(),
    };
}
