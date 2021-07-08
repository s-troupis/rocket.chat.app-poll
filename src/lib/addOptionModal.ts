import { IModify, IRead } from "@rocket.chat/apps-engine/definition/accessors";
import {
    RocketChatAssociationModel,
    RocketChatAssociationRecord,
} from "@rocket.chat/apps-engine/definition/metadata";
import { IUIKitModalViewParam } from "@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder";

import { uuid } from "./uuid";
import { IModalContext, IPoll } from "../definition";

export async function addOptionModal({
    id = "",
    read,
    modify,
}: {
    id?: string;
    read: IRead;
    modify: IModify;
}): Promise<IUIKitModalViewParam> {
    const viewId = id || uuid();

    const association = new RocketChatAssociationRecord(
        RocketChatAssociationModel.MISC,
        viewId
    );
    const [record] = (await read
        .getPersistenceReader()
        .readByAssociation(association)) as Array<IModalContext>;

    const block = modify.getCreator().getBlockBuilder();
    block.addSectionBlock({
        text: block.newMarkdownTextObject((record as IPoll).question),
    });

    block.addInputBlock({
        blockId: "addOption",
        optional: false,
        element: block.newPlainTextInputElement({
            actionId: `option`,
            placeholder: block.newPlainTextObject("Insert an option"),
        }),
        label: block.newPlainTextObject(""),
    });

    return {
        id: viewId,
        title: block.newPlainTextObject("Add Option"),
        submit: block.newButtonElement({
            text: block.newPlainTextObject("Add"),
        }),
        close: block.newButtonElement({
            text: block.newPlainTextObject("Dismiss"),
        }),
        blocks: block.getBlocks(),
    };
}
