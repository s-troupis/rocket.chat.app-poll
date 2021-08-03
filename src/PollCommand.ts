import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { createLivePollModal } from './lib/createLivePollModal';
import { createPollModal } from './lib/createPollModal';

export class PollCommand implements ISlashCommand {
    public command = 'poll';
    public i18nParamsExample = 'params_example';
    public i18nDescription = 'cmd_description';
    public providesPreview = false;

    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const triggerId = context.getTriggerId();

        const [subcommand] = context.getArguments();

        if(subcommand === 'live') {
            const totalPolls = +context.getArguments()[1]; // Convert to number
            if(totalPolls && triggerId) {
                const data = {
                    room: (context.getRoom() as any).value,
                    threadId: context.getThreadId(),
                    totalPolls,
                    pollIndex: 0,
                };
                const question = context.getArguments().slice(2).join(' ');
                const modal = await createLivePollModal({question, persistence: persis, modify, data, pollIndex: 0, totalPolls});
                await modify.getUiController().openModalView(modal, {triggerId}, context.getSender());
            }
            else {
                console.log("Please enter a valid number of polls after the live subcommand");
            }
        } else {

            const data = {
                room: (context.getRoom() as any).value,
                threadId: context.getThreadId(),
            };

            const question = context.getArguments().join(' ');

            if (triggerId) {
                const modal = await createPollModal({ question, persistence: persis, modify, data });

                await modify.getUiController().openModalView(modal, { triggerId }, context.getSender());
            }
        }
    }
}
