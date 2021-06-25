import { BlockBuilder, BlockElementType } from '@rocket.chat/apps-engine/definition/uikit';

import { IPoll } from '../definition';
import { buildVoteGraph } from './buildVoteGraph';
import { buildVoters } from './buildVoters';

export function createPollBlocks(block: BlockBuilder, question: string, options: Array<any>, poll: IPoll, showNames: boolean, anonymousOptions: Array<string>) {
    block.addSectionBlock({
        text: block.newPlainTextObject(question),
        ...!poll.finished && {
            accessory: {
                type: BlockElementType.OVERFLOW_MENU,
                actionId: 'finish',
                options: [
                    {
                        text: block.newPlainTextObject('Finish poll'),
                        value: 'finish',
                    },
                ],
            },
        },
    });

    if (poll.finished) {
        block.addContextBlock({
            elements: [
                block.newMarkdownTextObject(`The poll has been finished at ${new Date().toUTCString()}`),
            ],
        });
    }

    block.addDividerBlock();

    const maxVoteQuantity = Math.max(...poll.votes.map(vote => vote.quantity))
    // Forms array of option indices with maximum votes (more than 1 option can be max-voted)
    const maxVoteIndices = poll.votes
        .map(vote => vote.quantity)
        .reduce((ind: number[], el, i) => {
            if (el === maxVoteQuantity)
                ind.push(i);
            return ind;
        }, []);
    options.forEach((option, index) => {
        block.addSectionBlock({
            text: block.newPlainTextObject(option),
            ...!poll.finished && {
                    accessory: {
                    type: BlockElementType.BUTTON,
                    actionId: 'vote',
                    text: block.newPlainTextObject('Vote'),
                    value: String(index),
                },
            },
        });

        if (!poll.votes[index]) {
            return;
        }

        const graph = buildVoteGraph(poll.votes[index], poll.totalVotes, maxVoteIndices.includes(index));
        block.addContextBlock({
            elements: [
                block.newMarkdownTextObject(graph),
            ],
        });

        if (poll.visibility === "confidential") {
            return;
        }

        if(anonymousOptions.includes(poll.options[index])) {
            return;
        }

        const voters = buildVoters(poll.votes[index], showNames);
        if (!voters) {
            return;
        }

        block.addContextBlock({
            elements: [
                block.newMarkdownTextObject(voters),
            ],
        });
    });

    // Add text block for total votes
    block.addDividerBlock(),
    block.addContextBlock({
        elements: [
            block.newMarkdownTextObject(`${ poll.totalVotes } votes ${ poll.finished ? '| Final Results' : '' }`),
        ],
    });
}
