import { BlockBuilder, BlockElementType } from '@rocket.chat/apps-engine/definition/uikit';

import { IPoll } from '../definition';
import { buildVoteGraph } from './buildVoteGraph';
import { buildVoters } from './buildVoters';

export function createPollBlocks(block: BlockBuilder, question: string, options: Array<any>, poll: IPoll, showNames: boolean) {
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

    const voteQuantities = poll.votes.map(vote => vote.quantity)
    
    const maxVoteIndices = voteQuantities.reduce(function(ind: number[], el, i) { 
        if (el === Math.max(...voteQuantities)) 
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

        if (poll.confidential) {
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

    // Add text for total votes. TODO: Add text for time left
    block.addDividerBlock(),
    block.addContextBlock({
        elements: [
            block.newMarkdownTextObject(`${poll.totalVotes} votes`),
        ],
    });
}
