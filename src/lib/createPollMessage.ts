import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import {
    IUIKitViewSubmitIncomingInteraction,
} from '@rocket.chat/apps-engine/definition/uikit/UIKitIncomingInteractionTypes';

import { IModalContext, IPoll, pollVisibility } from '../definition';
import { createPollBlocks } from './createPollBlocks';

export async function createPollMessage(data: IUIKitViewSubmitIncomingInteraction, read: IRead, modify: IModify, persistence: IPersistence, uid: string) {
    const { view: { id } } = data;
    let { state }: {
        state?: any;
    } = data.view;

    const association = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, id);
    const [record] = await read.getPersistenceReader().readByAssociation(association) as Array<IModalContext>;
    let anonymousOptions = [];

    // When createPollMessage is called from mixed visibility modal case
    // the second-last view id contains slashcommand data
    if ((record as IUIKitViewSubmitIncomingInteraction).view) {
        const testAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, (record as IUIKitViewSubmitIncomingInteraction).view.id);
        const [test] = await read.getPersistenceReader().readByAssociation(testAssociation) as Array<IModalContext>;
        record.threadId = test.threadId;
        record.room = test.room;
        // Extract anonymous options before state is modified
        anonymousOptions = state.mixedVisibility.anonymousOptions;
        state = (record as IUIKitViewSubmitIncomingInteraction).view.state;
    }

    if (!state.poll || !state.poll.question || state.poll.question.trim() === '') {
        throw { question: 'Please type your question here' };
    }

    if (!record.room) {
        throw new Error('Invalid room');
    }

    const options = Object.entries<any>(state.poll || {})
        .filter(([key]) => key !== 'question')
        .map(([, option]) => option)
        .filter((option) => option.trim() !== '');

    if (!options.length) {
        throw {
            'option-0': 'Please provide some options',
            'option-1': 'Please provide some options',
        };
    }

    if (options.length === 1) {
        if (!state.poll['option-0'] || state.poll['option-0'] === '') {
            throw {
                'option-0': 'Please provide one more option',
            };
        }
        if (!state.poll['option-1'] || state.poll['option-1'] === '') {
            throw {
                'option-1': 'Please provide one more option',
            };
        }
    }

    try {
        const { config = { mode: 'multiple', visibility: pollVisibility.open, additionalChoices: 'disallowAddingChoices', wordCloud: 'disabled' } } = state;
        const { mode = 'multiple', visibility = pollVisibility.open, additionalChoices = 'disallowAddingChoices', wordCloud = 'disabled' } = config;

        const showNames = await read.getEnvironmentReader().getSettings().getById('use-user-name');
        const wordCloudAPI = await read.getEnvironmentReader().getSettings().getById('wordcloud-api');

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
            visibility,
            singleChoice: mode === 'single',
            wordCloud: wordCloud === 'enabled',
            anonymousOptions,
            allowAddingOptions: additionalChoices !== 'disallowAddingChoices',
        };

        const block = modify.getCreator().getBlockBuilder();
        createPollBlocks(block, poll.question, options, poll, showNames.value, poll.anonymousOptions,  wordCloudAPI.value);

        builder.setBlocks(block);

        const messageId = await modify.getCreator().finish(builder);
        poll.msgId = messageId;

        const pollAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, messageId);

        await persistence.createWithAssociation(poll, pollAssociation);
    } catch (e) {
        throw e;
    }
}
