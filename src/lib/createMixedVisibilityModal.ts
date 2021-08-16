import {
    IModify,
    IPersistence,
} from '@rocket.chat/apps-engine/definition/accessors';
import {
    RocketChatAssociationModel,
    RocketChatAssociationRecord,
} from '@rocket.chat/apps-engine/definition/metadata';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';

import { IUIKitViewSubmitIncomingInteraction } from '@rocket.chat/apps-engine/definition/uikit/UIKitIncomingInteractionTypes';
import { uuid } from './uuid';

export async function createMixedVisibilityModal({
    id = '',
    question,
    persistence,
    data,
    modify,
}: {
    id?: string;
    question?: string;
    persistence: IPersistence;
    data: IUIKitViewSubmitIncomingInteraction;
    modify: IModify;
}): Promise<IUIKitModalViewParam> {
    const viewId = id || `create-mixed-visibility-modal-${uuid()}`;

    const association = new RocketChatAssociationRecord(
        RocketChatAssociationModel.MISC,
        viewId,
    );
    await persistence.createWithAssociation(data, association);

    const {
        state,
    }: {
        state?: any;
    } = data.view;

    const options = Object.entries<any>(state.poll || {})
        .filter(([key]) => key !== 'question')
        .map(([, option]) => option)
        .filter((option) => option.trim() !== '');

    const block = modify.getCreator().getBlockBuilder();
    block.addSectionBlock({
        text: block.newMarkdownTextObject(question ? question : ''),
    });

    block
        .addActionsBlock({
            blockId: 'mixedVisibility',
            elements: [
                block.newMultiStaticElement({
                    placeholder: block.newPlainTextObject('Multiple choices'),
                    actionId: 'anonymousOptions',
                    options: options.map((option) => {
                        return {
                            text: block.newPlainTextObject(option),
                            value: option,
                        };
                    }),
                }),
            ],
        })

        .addDividerBlock();

    return {
        id: viewId,
        title: block.newPlainTextObject('Select anonymous options'),
        submit: block.newButtonElement({
            text: block.newPlainTextObject('Create'),
        }),
        close: block.newButtonElement({
            text: block.newPlainTextObject('Dismiss'),
        }),
        blocks: block.getBlocks(),
    };
}
