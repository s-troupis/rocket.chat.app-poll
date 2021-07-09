import {
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
    RocketChatAssociationModel,
    RocketChatAssociationRecord,
} from "@rocket.chat/apps-engine/definition/metadata";

import { createPollBlocks } from "./createPollBlocks";
import { getPoll } from "./getPoll";

export async function updatePollMessage({
    data,
    read,
    persistence,
    modify,
}: {
    data;
    read: IRead;
    persistence: IPersistence;
    modify: IModify;
}) {
    const poll = await getPoll(String(data.view.id), read);

    if (!poll) {
        throw new Error("no such poll");
    }

    if (poll.finished) {
        throw new Error("this poll is already finished");
    }

    try {
        const {
            state,
        }: {
            state?: any;
        } = data.view;

        poll.options.push(state.addOption.option);
        poll.votes.push({ quantity: 0, voters: [] });

        const message = await modify
            .getUpdater()
            .message(poll.msgId, data.user);
        message.setEditor(message.getSender());

        const block = modify.getCreator().getBlockBuilder();

        const showNames = await read
            .getEnvironmentReader()
            .getSettings()
            .getById("use-user-name");

        createPollBlocks(
            block,
            poll.question,
            poll.options,
            poll,
            showNames.value
        );

        message.setBlocks(block);

        const association = new RocketChatAssociationRecord(
            RocketChatAssociationModel.MISC,
            poll.msgId
        );
        persistence.updateByAssociation(association, poll);

        return modify.getUpdater().finish(message);
    } catch (e) {
        console.error("Error", e);
    }
}
