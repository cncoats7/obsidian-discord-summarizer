import { symlink } from "node:fs";
import { DateUtils } from "./dateUtils";

interface ChannelInfo {
    channelName: string;
    serverName: string;
}

interface Message {
    id: string;
    author: { username: string };
    content: string;
    timestamp: string;
}

interface GuildInfo {
    name: string;
}

export class Discord {
    private apiBase: string;
    private rateLimitDelay: number;

    constructor(apiBase: string, rateLimitDelay: number) {
        this.apiBase = apiBase;
        this.rateLimitDelay = rateLimitDelay;
    }

    formatMessagesForPrompt(messages: Message[]): string {
        return messages
            .filter(msg => msg && msg.author && msg.content)
            .map(msg => `${msg.author.username}: ${msg.content.trim()}`)
            .join('\n');
    }

    createPrompt(messageText: string): string {
        return `Please summarize the following Discord chat messages in a blog post style with paragraphs and bullet points where appropriate. 
        Focus on the key discussions, decisions, and new information shared.  
        Include a list of any stocks mentioned with a sentence for each describing its importance and the directional sentiment.
        This is very important: Ensure that any time a PRICE or LEVEL is mentioned, you include the corresponding stock, ETF, or index.
        Organize the content logically and highlight important points:\n\n${messageText}`;
    }

    private async handleResponse(response: Response): Promise<any> {
        if (response.ok) {
            return response.json();
        }

        let errorMessage = `HTTP error! status: ${response.status}`;

        switch (response.status) {
            case 401:
                errorMessage = 'Invalid Discord token. Please check your credentials.';
                break;
            case 403:
                errorMessage = 'Access denied. Please ensure you have permission to view this channel.';
                break;
            case 429:
                const retryAfter = response.headers.get('Retry-After') || '5';
                throw {
                    status: 429,
                    retryAfter: parseInt(retryAfter, 10) || 5,
                    message: 'Rate limited by Discord API',
                };
            case 404:
                errorMessage = 'Channel not found. Please check the channel ID.';
                break;
        }

        throw new Error(errorMessage);
    }

    async fetchChannelInfo(channelId: string, userToken: string): Promise<ChannelInfo> {
        try {
            const channelResponse = await fetch(`${this.apiBase}/channels/${channelId}`, {
                headers: {
                    Authorization: userToken,
                    'Content-Type': 'application/json',
                },
            });

            const channelInfo = await this.handleResponse(channelResponse);

            if (channelInfo.guild_id) {
                await this.delay(this.rateLimitDelay);

                const guildResponse = await fetch(`${this.apiBase}/guilds/${channelInfo.guild_id}`, {
                    headers: {
                        Authorization: userToken,
                        'Content-Type': 'application/json',
                    },
                });

                const guildInfo: GuildInfo = await this.handleResponse(guildResponse);

                return {
                    channelName: channelInfo.name,
                    serverName: guildInfo.name,
                };
            }

            return {
                channelName: channelInfo.name || 'Direct Message',
                serverName: 'Private',
            };
        } catch (error) {
            console.warn('Error fetching channel info:', error);
            return {
                channelName: 'Unknown Channel',
                serverName: 'Unknown Server',
            };
        }
    }

    async fetchGuildChannels(guildId: string, userToken: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiBase}/guilds/${guildId}/channels`, {
                headers: {
                    Authorization: userToken,
                    'Content-Type': 'application/json',
                },
            });

            return this.handleResponse(response);
        } catch (error) {
            console.error('Error fetching guild channels:', error);
            throw new Error(`Failed to fetch guild channels: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async fetchMessagesPage(
        channelId: string,
        userToken: string,
        before: string | null,
        after: string | null = null
    ): Promise<Message[]> {
        try {
            let url = `${this.apiBase}/channels/${channelId}/messages?limit=100`;
            if (before) url += `&before=${before}`;
            if (after) url += `&after=${after}`;

            const response = await fetch(url, {
                headers: {
                    Authorization: userToken,
                    'Content-Type': 'application/json',
                },
            });

            return this.handleResponse(response);
        } catch (error) {
            console.error('Error fetching messages:', error);
            throw error;
        }
    }

    async fetchUserGuilds(userToken: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiBase}/users/@me/guilds`, {
                headers: {
                    Authorization: userToken,
                    'Content-Type': 'application/json',
                },
            });

            return this.handleResponse(response);
        } catch (error) {
            console.error('Error fetching user guilds:', error);
            throw new Error(`Failed to fetch user guilds: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getAllMessagesBetweenDates(
        channelId: string,
        userToken: string,
        fromDate: Date,
        toDate: Date | null = null,
        maxPages = 50
    ): Promise<Message[]> {
        try {
            const effectiveToDate = toDate || new Date();
            const dateUtils = new DateUtils();
            const beforeSnowflake = dateUtils.dateToDiscordSnowflake(effectiveToDate);
            const allMessages = new Map<string, Message>();
            let currentBefore = beforeSnowflake;
            let pageCount = 0;
            let hasMore = true;
            let hitOldMessage = false;

            while (hasMore && pageCount < maxPages && !hitOldMessage) {
                if (pageCount > 0) {
                    await this.delay(this.rateLimitDelay);
                }

                const messages = await this.fetchMessagesPage(channelId, userToken, currentBefore);

                if (!messages.length) {
                    hasMore = false;
                    continue;
                }

                for (const msg of messages) {
                    const msgTime = new Date(msg.timestamp).getTime();

                    if (msgTime < fromDate.getTime()) {
                        hitOldMessage = true;
                        break;
                    }

                    if (msgTime >= fromDate.getTime() && msgTime <= effectiveToDate.getTime()) {
                        allMessages.set(msg.id, msg);
                    }
                }

                if (!hitOldMessage && messages.length === 100) {
                    currentBefore = messages[messages.length - 1].id;
                    pageCount++;
                } else {
                    hasMore = false;
                }
            }

            const uniqueMessages = Array.from(allMessages.values()).sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            return uniqueMessages;
        } catch (error) {
            console.error('Error fetching messages:', error);
            throw new Error(`Failed to fetch messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
