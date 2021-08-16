import {
    IConfigurationExtend,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { SettingType } from '@rocket.chat/apps-engine/definition/settings';
import {
    IUIKitInteractionHandler,
    UIKitBlockInteractionContext,
    UIKitViewSubmitInteractionContext,
} from '@rocket.chat/apps-engine/definition/uikit';
import { addOptionModal } from './src/lib/addOptionModal';

import { pollVisibility } from './src/definition';
import { createMixedVisibilityModal } from './src/lib/createMixedVisibilityModal';
import { createPollMessage } from './src/lib/createPollMessage';
import { createPollModal } from './src/lib/createPollModal';
import { finishPollMessage } from './src/lib/finishPollMessage';
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
                            wordCloud?:string;
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
            } else if (/create-mixed-visibility-modal/.test(id)) {

                const { state }: {
                    state: {
                        mixedVisibility: {
                        anonymousOptions: any,
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

                return {
                    success: true,
                };
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
                const modal = await createPollModal({ id: data.container.id, data, persistence, modify, options: parseInt(String(data.value), 10) });

                return context.getInteractionResponder().updateModalViewResponse(modal);
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
            i18nDescription: "word_cloud_api_description",
            required: false,
            type: SettingType.STRING,
            public: true,
            packageValue: "https://quickchart.io/wordcloud",
        });
    }
}
