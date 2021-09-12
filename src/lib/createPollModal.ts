import { IModify, IPersistence } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';

import { IModalContext, pollVisibility } from '../definition';
import { uuid } from './uuid';

export async function createPollModal({ id = '', question, persistence, data, modify, options = 2, mode }: {
    id?: string,
    question?: string,
    persistence: IPersistence,
    data: IModalContext,
    modify: IModify,
    options?: number,
    mode?: string,
}): Promise<IUIKitModalViewParam> {
    const viewId = id || `create-poll-modal-${uuid()}`;

    const viewAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, viewId);
    await persistence.createWithAssociation(data, viewAssociation);

    const optionsAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'options');
    await persistence.createWithAssociations({ options }, [viewAssociation, optionsAssociation]);

    const block = modify.getCreator().getBlockBuilder();
    block.addInputBlock({
        blockId: 'poll',
        element: block.newPlainTextInputElement({ initialValue: question, actionId: 'question' }),
        label: block.newPlainTextObject('Insert your question'),
    })
    .addDividerBlock();

    // If mode is multiple, single or undefined show option fields
    if (mode === 'multiple' || mode === 'single' || !mode) {
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
    }

    block
        .addActionsBlock({
            blockId: 'config',
            elements: [
                block.newStaticSelectElement({
                    placeholder: block.newPlainTextObject('Multiple choices'),
                    actionId: 'mode',
                    initialValue: `${mode ? mode : 'multiple'}`,
                    options: [
                        {
                            text: block.newPlainTextObject('Multiple choices'),
                            value: 'multiple',
                        },
                        {
                            text: block.newPlainTextObject('Single choice'),
                            value: 'single',
                        },
                        {
                            text: block.newPlainTextObject('Overrated/Underrated Poll'),
                            value: 'over-under',
                        },
                        {
                            text: block.newPlainTextObject('1-to-5 Poll'),
                            value: '1-to-5',
                        },
                        {
                            text: block.newPlainTextObject('1-to-10 Poll'),
                            value: '1-to-10',
                        },
                        {
                            text: block.newPlainTextObject('Agree/Disagree Poll'),
                            value: 'agree-disagree',
                        },
                        {
                            text: block.newPlainTextObject('Emoji Rank Poll'),
                            value: 'emoji-rank',
                        },
                    ],
                }),
                ...(mode === 'multiple' || mode === 'single' || !mode) ? [block.newButtonElement({
                    actionId: 'addChoice',
                    text: block.newPlainTextObject('Add a choice'),
                    value: String(options + 1),
                })] : [],
                block.newStaticSelectElement({
                    placeholder: block.newPlainTextObject('Open vote'),
                    actionId: 'visibility',
                    initialValue: pollVisibility.open,
                    options: [
                        {
                            text: block.newPlainTextObject('Open vote'),
                            value: pollVisibility.open,
                        },
                        {
                            text: block.newPlainTextObject('Confidential vote'),
                            value: pollVisibility.confidential,
                        },
                        {
                            text: block.newPlainTextObject('Mixed Visibility vote'),
                            value: pollVisibility.mixed,
                        },
                    ],
                }),
            ],
        });

    return {
        id: viewId,
        title: block.newPlainTextObject('Create a Poll'),
        submit: block.newButtonElement({
            text: block.newPlainTextObject('Create'),
        }),
        close: block.newButtonElement({
            text: block.newPlainTextObject('Dismiss'),
        }),
        blocks: block.getBlocks(),
    };
}
