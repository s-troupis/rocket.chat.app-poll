import {
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
    RocketChatAssociationModel,
    RocketChatAssociationRecord,
} from "@rocket.chat/apps-engine/definition/metadata";
import { IMessageAttachment } from "@rocket.chat/apps-engine/definition/messages";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";

import { IPoll } from "../definition";
import { createPollBlocks } from "./createPollBlocks";
import { getPoll } from "./getPoll";
const fs = require("fs");

async function finishPoll(poll: IPoll, { persis }: { persis: IPersistence }) {
    const association = new RocketChatAssociationRecord(
        RocketChatAssociationModel.MISC,
        poll.msgId
    );
    poll.finished = true;
    return persis.updateByAssociation(association, poll);
}

export async function finishPollMessage({
    data,
    read,
    persistence,
    modify,
    http,
    logger
}: {
    data;
    read: IRead;
    persistence: IPersistence;
    modify: IModify;
    http: IHttp;
    logger: ILogger;
}) {
    if (!data.message) {
        return {
            success: true,
        };
    }

    const poll = await getPoll(String(data.message.id), read);

    if (!poll) {
        throw new Error("no such poll");
    }

    if (poll.finished) {
        throw new Error("this poll is already finished");
    }

    if (poll.uid !== data.user.id) {
        throw new Error("You are not allowed to finish the poll"); // send an ephemeral message
    }

    try {
        await finishPoll(poll, { persis: persistence });

        const message = await modify
            .getUpdater()
            .message(data.message.id as string, data.user);
        message.setEditor(message.getSender());

        const block = modify.getCreator().getBlockBuilder();

        const showNames = await read
            .getEnvironmentReader()
            .getSettings()
            .getById("use-user-name");
        const wordCloudAPI = await read
            .getEnvironmentReader()
            .getSettings()
            .getById("wordcloud-api");

        if (poll.wordCloud && wordCloudAPI.value) {
            let wordList = [] as string[];
            poll.options.map((option, index) => {
                wordList = wordList.concat(
                    Array(poll.votes[index].quantity).fill(option)
                );
            });
            const attachment = <IMessageAttachment>{
                imageUrl: `${wordCloudAPI.value}?text=${wordList.join(" ")}`,
            };
            const response = await http.get(`${wordCloudAPI.value}?text=${wordList.join(" ")}`)
            if(response) {
                const wordCloudBuilder = modify
                .getCreator()
                .startMessage()
                .setUsernameAlias(data.user.username)
                .setRoom(<IRoom>{ ...data.room })
                .addAttachment(attachment);

            return modify.getCreator().finish(wordCloudBuilder);                
            } else {
                createPollBlocks(
                    block,
                    poll.question,
                    poll.options,
                    poll,
                    showNames.value,
                    false
                );
        
                message.setBlocks(block);
        
                modify.getUpdater().finish(message);
            }
        } else {
            createPollBlocks(
                block,
                poll.question,
                poll.options,
                poll,
                showNames.value,
                false
            );
    
            message.setBlocks(block);
    
            modify.getUpdater().finish(message);
        }
        return;
    } catch (e) {
        logger.error("Error", e);
    }
    return;
}
