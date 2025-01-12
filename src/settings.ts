
export interface DiscordSummarizerPluginSettings {
	discordApiBase: string;
	discordRateLimitDelay: number;
	discordChannelId: string;
	discordServerId: string;
	discordToken: string;
	openAIKey: string;
	openAIEndpoint: string;

}

export const DEFAULT_SETTINGS: DiscordSummarizerPluginSettings = {
	discordApiBase: 'https://discord.com/api/v9',
	discordRateLimitDelay: 500,
	discordChannelId: '',
	discordServerId: '',
	discordToken: '',
	openAIKey: '',
	openAIEndpoint: 'https://api.openai.com/v1/chat/completions',
}