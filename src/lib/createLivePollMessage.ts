import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import {
    IUIKitViewSubmitIncomingInteraction,
} from '@rocket.chat/apps-engine/definition/uikit/UIKitIncomingInteractionTypes';

import { IModalContext, IPoll } from '../definition';
import { createPollBlocks } from './createPollBlocks';

export async function createLivePollMessage(data: IUIKitViewSubmitIncomingInteraction, read: IRead, modify: IModify, persistence: IPersistence, uid: string, pollIndex: number) {
    const { view: { id } } = data;

    const association = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, id);
    const [record] = await read.getPersistenceReader().readByAssociation(association) as Array<IModalContext>;

    if (!record.room) {
        throw new Error('Invalid room');
    }

    const state = record["polls"][pollIndex];

    const options = Object.entries<any>(state.poll || {})
        .filter(([key]) => key !== 'question')
        .map(([, option]) => option)
        .filter((option) => option.trim() !== '');

    try {
        const { config = { mode: 'multiple', visibility: 'open' } } = state;
        const { mode = 'multiple', visibility = 'open' } = config;

        const showNames = await read.getEnvironmentReader().getSettings().getById('use-user-name');

        const builder = modify.getCreator().startMessage()
            .setUsernameAlias((showNames.value && data.user.name) || data.user.username)
            .setRoom(record.room)
            .setText(state.poll.question);

        // if poll created from inside a thread, need to set the thread id
        if (record.threadId) {
            builder.setThreadId(record.threadId);
        }

        const poll: IPoll = {
            question: state.poll.question,
            uid,
            msgId: '',
            options,
            totalVotes: 0,
            votes: options.map(() => ({ quantity: 0, voters: [] })),
            confidential: visibility === 'confidential',
            singleChoice: mode === 'single',
            liveId: id,
            pollIndex: pollIndex,
            totalLivePolls: record["totalPolls"],
            activeLivePoll: true
        };

        const block = modify.getCreator().getBlockBuilder();
        console.log("LivePollMessage PollIndex = ", pollIndex)
        console.log("LivePollMessage totalPolls = ", record["totalPolls"])
        createPollBlocks(block, poll.question, options, poll, showNames.value);

        builder.setBlocks(block);

        const messageId = await modify.getCreator().finish(builder);
        poll.msgId = messageId;

        const pollAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, messageId);

        await persistence.createWithAssociation(poll, pollAssociation);
    } catch (e) {
        throw e;
    }
}
