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
import { addOptionModal } from './src/lib/addOptionModal';
import { createLivePollMessage } from './src/lib/createLivePollMessage';
import { createLivePollModal } from './src/lib/createLivePollModal';

import timeZones from './src/assets/timezones';
import { IModalContext, pollVisibility } from './src/definition';
import { createMixedVisibilityModal } from './src/lib/createMixedVisibilityModal';
import { createPollMessage } from './src/lib/createPollMessage';
import { createPollModal } from './src/lib/createPollModal';
import { finishPollMessage } from './src/lib/finishPollMessage';
import { nextPollMessage } from './src/lib/nextPollMessage';
import { updatePollMessage } from './src/lib/updatePollMessage';
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
                            additionalChoices?: string,
                            wordCloud?: string;
                        },
                    },
                    config?: {
                        mode?: string,
                        visibility?: string,
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

                if (state.config && state.config.visibility !== pollVisibility.mixed) {
                try {
                    await createPollMessage(data, read, modify, persistence, data.user.id);
                } catch (err) {
                    return context.getInteractionResponder().viewErrorResponse({
                        viewId: data.view.id,
                        errors: err,
                    });
                }
            } else {
                // Open mixed visibility modal
                try {
                    const modal = await createMixedVisibilityModal({ question: state.poll.question, persistence, modify, data });
                    await modify.getUiController().openModalView(modal, context.getInteractionData(), data.user);

                    return {
                        success: true,
                    };

                } catch (err) {
                    return context.getInteractionResponder().viewErrorResponse({
                        viewId: data.view.id,
                        errors: err,
                    });
                }
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
            const [readData] = await read.getPersistenceReader().readByAssociation(association) as any;
            const polls = readData.polls || [];
            const pollIndex = +readData.pollIndex + 1;
            const totalPolls = +readData.totalPolls;
            // Prompt user to enter values for poll if left blank
            try {

                if (!state.poll || !state.poll.question || state.poll.question.trim() === '') {
                    throw { question: 'Please type your question here' };
                }
                if (!state.poll || !state.poll.ttv || isNaN(+state.poll.ttv)) {
                    throw { ttv: 'Please enter a valid time for the poll to end' };
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
            readData.polls = polls;
            readData.pollIndex = pollIndex;
            readData.user = data.user;
            readData.appId = data.appId;
            readData.view = data.view;
            readData.triggerId = data.triggerId;
            await persistence.updateByAssociation(association, readData, true);
            if (pollIndex === totalPolls) {
                const pollId = `live-${Math.random().toString(36).slice(7)}`;
                const livePollAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, pollId);
                await persistence.createWithAssociation(readData, livePollAssociation);
                try {
                    if (readData.save) {
                        const message = modify
                             .getCreator()
                             .startMessage()
                             .setSender(data.user)
                             .setText(`Live Poll has been saved with id ${pollId}. Use \`/poll live load ${pollId}\` to start.`)
                             .setUsernameAlias('Poll');

                        if (readData.room) {
                                message.setRoom(readData.room);
                        }
                        modify
                             .getNotifier()
                             .notifyUser(
                                 data.user,
                                 message.getMessage(),
                             );

                    } else {
                        await createLivePollMessage(data, read, modify, persistence, data.user.id, 0);
                    }
                } catch (err) {
                    this.getLogger().log(err);
                    return context.getInteractionResponder().viewErrorResponse({
                        viewId: data.view.id,
                        errors: err,
                    });
                }
        } else {

        const modal = await createLivePollModal({id: data.view.id, question: '', persistence, modify, data, pollIndex, totalPolls});
        return context.getInteractionResponder().updateModalViewResponse(modal);
        }
            } else if (/create-mixed-visibility-modal/.test(id)) {

                const { state }: {
                    state: {
                        mixedVisibility: {
                        anonymousOptions: any,
                        additionalChoices?: string;
                        },
                    },
                } = data.view as any;

                if (!state) {
                    return context.getInteractionResponder().viewErrorResponse({
                        viewId: data.view.id,
                        errors: {
                            question: 'Error building mixed visibility modal',
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
            } else if (/add-option-modal/.test(id)) {
                const { state }: {
                    state: {
                        addOption: {
                            option: string,
                        },
                    },
                } = data.view as any;
                if (!state) {
                    return context.getInteractionResponder().viewErrorResponse({
                        viewId: data.view.id,
                        errors: {
                            option: 'Error adding option',
                        },
                    });
                }

                try {
                    const logger = this.getLogger();
                    await updatePollMessage({data, read, modify, persistence, logger});
                } catch (err) {
                    this.getLogger().log(err);
                    return context.getInteractionResponder().viewErrorResponse({
                        viewId: data.view.id,
                        errors: err,
                    });
                }

                return {
                    success: true,
                };
            }

        return {
        success: true,
    };
}

    public async executeBlockActionHandler(context: UIKitBlockInteractionContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) {
        const data = context.getInteractionData();

        const { actionId } = data;

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
                let modal;
                const association = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, data.container.id);
                const [record] = await read.getPersistenceReader().readByAssociation(association) as Array<IModalContext>;
                data.room = record.room;
                (data as any).threadId = record.threadId;
                if (data.value && data.value.includes('live-')) {
                    (data as any).totalPolls = (record as any).totalPolls;
                    (data as any).pollIndex = (record as any).pollIndex;
                    (data as any).save = (record as any).save;
                    modal = await createLivePollModal({
                        id: data.container.id,
                        data, persistence, modify,
                        options: parseInt(data.value.split('-')[1], 10),
                        pollIndex: parseInt(data.value.split('-')[2], 10),
                        totalPolls: parseInt(data.value.split('-')[3], 10),
                    });
                } else {
                 modal = await createPollModal({ id: data.container.id, data, persistence, modify, options: parseInt(String(data.value), 10) });
                }
                return context.getInteractionResponder().updateModalViewResponse(modal);
            }

            case 'nextPoll': {
                try {
                    const logger = this.getLogger();
                    await nextPollMessage({ data, read, persistence, modify, logger });
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
            case 'addUserChoice': {
                const modal = await addOptionModal({ id: data.container.id, read, modify });

                return context.getInteractionResponder().openModalViewResponse(modal);
            }

            case 'finish': {
                try {
                    const logger = this.getLogger();
                    await finishPollMessage({ data, read, persistence, modify, http, logger });
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

            case 'mode': {
                const viewId = data.container.id;
                const viewAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, viewId);
                const optionsAssociation = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'options');
                const [record] = await read.getPersistenceReader().readByAssociation(viewAssociation) as Array<IModalContext>;
                data.room = record.room;
                (data as any).threadId = record.threadId;
                try {
                    const [existingOptions] = await read.getPersistenceReader()
                    .readByAssociations([viewAssociation, optionsAssociation]) as any;

                    const modal = await createPollModal({ id: viewId,
                        data,
                        persistence,
                        modify,
                        mode: data.value,
                        ...existingOptions && existingOptions.options && { options: existingOptions.options },
                    });
                    return context.getInteractionResponder().updateModalViewResponse(modal);

                } catch (e) {
                    this.getLogger().log(e);
                }
            }
        }

        return {
            success: true,
            triggerId: data.triggerId,
        };
    }

    public async initialize(configuration: IConfigurationExtend): Promise<void> {
        configuration.scheduler.registerProcessors([
            {
                id: 'nextPoll',
                processor: async (jobContext, read, modify, http, persis) => {
                    try {
                        const logger = this.getLogger();
                        await nextPollMessage({ data: jobContext, read, persistence: persis, modify, logger });

                    } catch (e) {
                        const errorMessage = modify
                             .getCreator()
                             .startMessage()
                             .setSender(jobContext.user)
                             .setText(e.message)
                             .setUsernameAlias('Poll');

                        if (jobContext.room) {
                                errorMessage.setRoom(jobContext.room);
                        }
                        await modify
                             .getNotifier()
                             .notifyUser(
                                 jobContext.user,
                                 errorMessage.getMessage(),
                             );
                    }
                },
            },
        ]);
        await configuration.slashCommands.provideSlashCommand(new PollCommand(this));
        await configuration.settings.provideSetting({
            id : 'use-user-name',
            i18nLabel: 'use_user_name_label',
            i18nDescription: 'use_user_name_description',
            required: false,
            type: SettingType.BOOLEAN,
            public: true,
            packageValue: false,
        });
        await configuration.settings.provideSetting({
            id : 'wordcloud-api',
            i18nLabel: 'word_cloud_api_label',
            i18nDescription: 'word_cloud_api_description',
            required: false,
            type: SettingType.STRING,
            public: true,
            packageValue: 'https://quickchart.io/wordcloud',
            value: 'https://quickchart.io/wordcloud',
        });
        await configuration.settings.provideSetting({
            id : 'timezone',
            i18nLabel: 'timezone_label',
            i18nDescription: 'timezone_description',
            required: true,
            type: SettingType.SELECT,
            public: true,
            packageValue: 'America/Danmarkshavn',
            value: 'America/Danmarkshavn',
            values: timeZones.timeZones.map((tz) => ({
                i18nLabel: `${tz.value} (UTC ${tz.offset >= 0 ? '+ ' + tz.offset : '- ' + Math.abs(tz.offset)} )`,
                key: tz.utc[0],
            })),
        });
    }
}
