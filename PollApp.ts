import {
    IConfigurationExtend,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo, RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { SettingType } from '@rocket.chat/apps-engine/definition/settings';
import {
    IUIKitInteractionHandler,
    UIKitBlockInteractionContext,
    UIKitViewSubmitInteractionContext,
} from '@rocket.chat/apps-engine/definition/uikit';
import { createLivePollMessage } from './src/lib/createLivePollMessage';
import { createLivePollModal } from './src/lib/createLivePollModal';

import { createPollMessage } from './src/lib/createPollMessage';
import { createPollModal } from './src/lib/createPollModal';
import { finishPollMessage } from './src/lib/finishPollMessage';
import { nextPollMessage } from './src/lib/nextPollMessage';
import { votePoll } from './src/lib/votePoll';
import { PollCommand } from './src/PollCommand';

export class PollApp extends App implements IUIKitInteractionHandler {

    constructor(info: IAppInfo, logger: ILogger) {
        super(info, logger);
    }

    public async executeViewSubmitHandler(context: UIKitViewSubmitInteractionContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) {
        const data = context.getInteractionData();

        const id = data.view.id;

        if (/create-poll-modal/i.test(id)) {

            const { state }: {
                state: {
                    poll: {
                        question: string,
                        [option: string]: string,
                    },
                    config?: {
                        mode?: string,
                        visibility?: string,
                    },
                },    
            } = data.view as any;

            if (!state) {
                return context.getInteractionResponder().viewErrorResponse({
                    viewId: data.view.id,
                    errors: {
                        question: 'Error creating poll',
                    },
                });
            }

            try {
                await createPollMessage(data, read, modify, persistence, data.user.id);
            } catch (err) {
                return context.getInteractionResponder().viewErrorResponse({
                    viewId: data.view.id,
                    errors: err,
                });
            }

            return {
                success: true,
            };
        } else if (/create-live-poll-modal/.test(id)) {
            const { state }: {
                state: {
                    poll: {
                        question: string,
                        [option: string]: string,
                    },
                    config?: {
                        mode?: string,
                        visibility?: string,
                    },
                },
            } = data.view as any;
            if (!state) {
                return context.getInteractionResponder().viewErrorResponse({
                    viewId: data.view.id,
                    errors: {
                        option: 'Error creating poll',
                    },
                });
            }
            const association = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, data.view.id);
            const readData = await read.getPersistenceReader().readByAssociation(association);
            console.log("Read Data = ", readData)
            console.log("Read Data Polls = ", readData[0]["polls"])
            const polls = readData[0]["polls"] || [];
            const pollIndex = +readData[0]["pollIndex"] + 1
            const totalPolls = +readData[0]["totalPolls"]
            // Prompt user to enter values for poll if left blank
            try {

                if (!state.poll || !state.poll.question || state.poll.question.trim() === '') {
                    throw { question: 'Please type your question here' };
                }
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
            } catch (err) {
                this.getLogger().log(err);
                return context.getInteractionResponder().viewErrorResponse({
                    viewId: data.view.id,
                    errors: err,
                });
            }   
            polls.push(state);
            readData[0]["polls"] = polls;
            readData[0]["pollIndex"] = pollIndex;
            await persistence.updateByAssociation(association, readData[0], true);
            if(pollIndex === totalPolls){
                try {
                    await createLivePollMessage(data, read, modify, persistence, data.user.id, 0);
                } catch (err) {
                    console.log("Error =", err);
                    this.getLogger().log(err);
                    return context.getInteractionResponder().viewErrorResponse({
                        viewId: data.view.id,
                        errors: err,
                    });
                }   
            } else {

            console.log("Reached within new modal creation block");
            // TODO: Make fields blank for next poll
            const modal = await createLivePollModal({id: data.view.id, question: "", persistence, modify, data, pollIndex, totalPolls});
            return context.getInteractionResponder().updateModalViewResponse(modal);
            }
        }

    return {
        success: true,
    };
}


    public async executeBlockActionHandler(context: UIKitBlockInteractionContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) {
        const data = context.getInteractionData();

        const { actionId } = data;

        console.log("Data = ", data);

        switch (actionId) {
            case 'vote': {
                await votePoll({ data, read, persistence, modify });

                return {
                    success: true,
                };
            }

            case 'create': {
                const modal = await createPollModal({ data, persistence, modify });

                return context.getInteractionResponder().openModalViewResponse(modal);
            }

            case 'addChoice': {
                const modal = await createPollModal({ id: data.container.id, data, persistence, modify, options: parseInt(String(data.value), 10) });

                return context.getInteractionResponder().updateModalViewResponse(modal);
            }

            case 'nextPoll': {
                try {
                    await nextPollMessage({ data, read, persistence, modify });
                } catch (e) {

                    const { room } = context.getInteractionData();
                    const errorMessage = modify
                         .getCreator()
                         .startMessage()
                         .setSender(context.getInteractionData().user)
                         .setText(e.message)
                         .setUsernameAlias('Poll');

                    if (room) {
                            errorMessage.setRoom(room);
                    }
                    modify
                         .getNotifier()
                         .notifyUser(
                             context.getInteractionData().user,
                             errorMessage.getMessage(),
                         );
                }
                break;
            }

            case 'finish': {
                try {
                    await finishPollMessage({ data, read, persistence, modify });
                } catch (e) {

                    const { room } = context.getInteractionData();
                    const errorMessage = modify
                         .getCreator()
                         .startMessage()
                         .setSender(context.getInteractionData().user)
                         .setText(e.message)
                         .setUsernameAlias('Poll');

                    if (room) {
                            errorMessage.setRoom(room);
                    }
                    modify
                         .getNotifier()
                         .notifyUser(
                             context.getInteractionData().user,
                             errorMessage.getMessage(),
                         );
                }
            }
        }

        return {
            success: true,
            triggerId: data.triggerId,
        };
    }

    public async initialize(configuration: IConfigurationExtend): Promise<void> {
        await configuration.slashCommands.provideSlashCommand(new PollCommand());
        await configuration.settings.provideSetting({
            id : 'use-user-name',
            i18nLabel: 'Use name attribute to display voters, instead of username',
            i18nDescription: 'When checked, display voters as full user names instead of username',
            required: false,
            type: SettingType.BOOLEAN,
            public: true,
            packageValue: false,
        });
    }
}
