import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { PollApp } from '../PollApp';
import { createLivePollMessage } from './lib/createLivePollMessage';
import { createLivePollModal } from './lib/createLivePollModal';
import { createPollModal } from './lib/createPollModal';

export class PollCommand implements ISlashCommand {
    public command = 'poll';
    public i18nParamsExample = 'params_example';
    public i18nDescription = 'cmd_description';
    public providesPreview = false;

    constructor(private readonly app: PollApp) { }

    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const triggerId = context.getTriggerId();

        const [subcommand] = context.getArguments();

        if (subcommand === 'live') {
            let totalPolls;
            let question;
            let save;
            if (context.getArguments()[1] === 'save') {
                totalPolls = +context.getArguments()[2]; // Convert to number
                question = context.getArguments().slice(3).join(' ');
                save = true;
            } else if (context.getArguments()[1] === 'load') {
                const pollId = context.getArguments()[2];
                if (pollId) {
                    try {
                        const association = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, pollId);
                        const [readData] = await read.getPersistenceReader().readByAssociation(association) as any;
                        if (!readData) {
                            const messageStructure = await modify.getCreator().startMessage();
                            const sender = context.getSender(); // the user calling the slashcommand
                            const room = context.getRoom(); // the current room

                            messageStructure
                            .setSender(sender)
                            .setRoom(room)
                            .setText(`Live Poll with id \`${pollId}\` does not exist.`);

                            await modify
                             .getNotifier()
                             .notifyUser(
                                 sender,
                                 messageStructure.getMessage(),
                             );
                        } else {
                            await createLivePollMessage(
                                {
                                    appId: readData.appId,
                                    view: readData.view,
                                    triggerId: readData.triggerId,
                                    user: readData.user,
                                    room: context.getRoom(),
                                },
                                read,
                                modify,
                                persis,
                                readData.user.id,
                                0,
                                );
                        }
                    } catch (e) {
                        throw new Error(`Unable to load poll with id ${pollId}. Error ${e}`);
                    }
                } else {
                    this.app.getLogger().log('Please enter a valid poll id');
                }
                return;
            } else {
                totalPolls = +context.getArguments()[1]; // Convert to number
                question = context.getArguments().slice(2).join(' ');
                save = false;
            }
            if (totalPolls && triggerId) {
                const data = {
                    room: (context.getRoom() as any).value,
                    threadId: context.getThreadId(),
                    totalPolls,
                    pollIndex: 0,
                    save,
                };
                const modal = await createLivePollModal({question, persistence: persis, modify, data, pollIndex: 0, totalPolls});
                await modify.getUiController().openModalView(modal, {triggerId}, context.getSender());
            } else {
                const messageStructure = await modify.getCreator().startMessage();
                const sender = context.getSender(); // the user calling the slashcommand
                const room = context.getRoom(); // the current room

                messageStructure
                .setSender(sender)
                .setRoom(room)
                .setText('Please enter the number of live polls to create. Example usage: \`/poll live 2\` or \`/poll live save 2\`');

                await modify
                    .getNotifier()
                    .notifyUser(
                        sender,
                        messageStructure.getMessage(),
                    );
            }
        } else {

            const data = {
                room: (context.getRoom() as any).value,
                threadId: context.getThreadId(),
            };

            const question = context.getArguments().join(' ');

            if (triggerId) {
                try {
                    const modal = await createPollModal({ question, persistence: persis, modify, data });
                    await modify.getUiController().openModalView(modal, { triggerId }, context.getSender());
                } catch (e) {
                    throw new Error(`Unable to open poll modal. Error ${e}`);
                }
            }
        }
    }
}
