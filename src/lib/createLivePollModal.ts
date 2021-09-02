import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';

import { IModalContext } from '../definition';
import { uuid } from './uuid';

export async function createLivePollModal({ id = '', question, persistence, data, modify, options = 2, pollIndex, totalPolls }: {
    id?: string,
    question?: string,
    persistence: IPersistence,
    data: IModalContext,
    modify: IModify,
    options?: number,
    pollIndex: number,
    totalPolls: number,
}): Promise<IUIKitModalViewParam> {
    const viewId = id || `create-live-poll-modal-${uuid()}`;

    if (pollIndex === 0) {
        const association = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, viewId);
        await persistence.updateByAssociation(association, data, true);
    }

    const block = modify.getCreator().getBlockBuilder();
    block.addInputBlock({
        blockId: 'poll',
        element: block.newPlainTextInputElement({ initialValue: question, actionId: 'question' }),
        label: block.newPlainTextObject('Insert your question'),
    });

    block.addInputBlock({
        blockId: 'poll',
        element: block.newPlainTextInputElement({ actionId: 'ttv', placeholder: block.newPlainTextObject('Number of seconds')}),
        label: block.newPlainTextObject('Time limit to vote'),
    })
    .addDividerBlock();

    for (let i = 0; i < options; i++) {
        block.addInputBlock({
            blockId: 'poll',
            optional: true,
            element: block.newPlainTextInputElement({
                actionId: `option-${i}`,
                placeholder: block.newPlainTextObject('Insert an option'),
            }),
            label: block.newPlainTextObject(''),
        });
    }

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
                block.newButtonElement({
                    actionId: 'addChoice',
                    text: block.newPlainTextObject('Add a choice'),
                    value: `live-${String(options + 1)}-${pollIndex}-${totalPolls}`,
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
                }),
            ],
        });

    return {
        id: viewId,
        title: block.newPlainTextObject('Create a poll'),
        submit: block.newButtonElement({
            text: block.newPlainTextObject(pollIndex === totalPolls - 1 ? 'Create' : 'Next'),
        }),
        close: block.newButtonElement({
            text: block.newPlainTextObject('Dismiss'),
        }),
        blocks: block.getBlocks(),
        clearOnClose: true,
    };
}
