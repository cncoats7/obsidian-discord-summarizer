import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TextComponent, setIcon } from 'obsidian';
import { Discord } from './discord/discord'
import { getCompletion } from './ai/openai';
import { DiscordSummarizerPluginSettings, DEFAULT_SETTINGS} from './settings'

export default class DiscordSummarizerPlugin extends Plugin {
	settings: DiscordSummarizerPluginSettings;

	async getDiscordSummary(editor: Editor) {
		const modal = new CalendarModal(this.app, async (startDate: Date, endDate: Date) => {
			new Notice(`Fetching messages from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
			const client = new Discord(this.settings.discordApiBase, this.settings.discordRateLimitDelay);
			const messages =  await client.getAllMessagesBetweenDates(this.settings.discordChannelId, this.settings.discordToken, startDate, endDate);
			if (messages.length > 0) {
				// Concatentate messages to a single string
				const formattedMessages = await client.formatMessagesForPrompt(messages);
				// Combine prompt and message string
				const prompt = client.createPrompt(formattedMessages);
				// Call OpenAI
				const result = await getCompletion(prompt, this.settings.openAIKey);
				// Write to Active Editor
				if (result) {
					editor.replaceSelection(result);
				}
			}
			
		});
		modal.open()
	}
	async onload() {
		await this.loadSettings();

		const ribbonIconEl = this.addRibbonIcon('gamepad-2', 'Discord Summarizer', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const editor = activeView.editor;
				this.getDiscordSummary(editor);
			}
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'get-discord-summary',
			name: 'Get Summary of Discord Channel',

			editorCallback: async (editor: Editor, view: MarkdownView) => {
				this.getDiscordSummary(editor)
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	
}

/**
 * Obsidian Plugin: Calendar Modal
 * This plugin opens a modal with two calendar controls
 * and prints the selected start and end dates to the active note.
 */

class CalendarModal extends Modal {
    private onSelectDates: (startDate: Date, endDate: Date) => void;

    constructor(app: App, onSelectDates: (startDate: Date, endDate: Date) => void) {
        super(app);
        this.onSelectDates = onSelectDates;
    }

    onOpen(): void {
        const { contentEl } = this;

        // Add a title to the modal
        contentEl.createEl('h2', {
            text: 'Select Date Range',
            cls: 'calendar-modal-title',
        });

        // Add a wrapper for the calendar controls
        const wrapper = contentEl.createEl('div', {
            cls: 'calendar-modal-wrapper',
        });

        // Create a calendar control for the start date
        const startDateContainer = wrapper.createEl('div', {
            cls: 'calendar-modal-date-container',
        });

		const today = new Date().toISOString().split('T')[0];

        startDateContainer.createEl('label', {
            text: 'Start Date:',
            cls: 'calendar-modal-label',
        });
        const startDatePicker = startDateContainer.createEl('input', {
            type: 'date',
            cls: 'calendar-modal-input',
			attr: { max: today },
        });

        // Create a calendar control for the end date
        const endDateContainer = wrapper.createEl('div', {
            cls: 'calendar-modal-date-container',
        });
        endDateContainer.createEl('label', {
            text: 'End Date:',
            cls: 'calendar-modal-label',
        });
        const endDatePicker = endDateContainer.createEl('input', {
            type: 'date',
            cls: 'calendar-modal-input',
			attr: { max: today },
        });

        // Add a confirm button
        const buttonContainer = contentEl.createEl('div', {
            cls: 'calendar-modal-button-container',
        });
        const confirmButton = buttonContainer.createEl('button', {
            text: 'Confirm',
            cls: 'calendar-modal-button',
        });
		confirmButton.addEventListener('click', () => {
            const startDate = startDatePicker.value;
            const endDate = endDatePicker.value;

            if (!startDate || !endDate) {
                new Notice('Please select both a start and an end date.');
                return;
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            const timeSpan = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

            if (timeSpan < 0) {
                new Notice('End date must be after start date.');
                return;
            }

            if (timeSpan > 7) {
                new Notice('Please select a time span of 7 days or less.');
                return;
            }

            this.onSelectDates(start, end);
            this.close();
        });

        // Add some instructions
		contentEl.createEl('p', {
			text: 'Select a start and end date from the calendars above, ensuring the range is 7 days or less, then click Confirm. Future dates are disabled.',
			cls: 'calendar-modal-instructions',
		});
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }

}


class SettingTab extends PluginSettingTab {
	plugin: DiscordSummarizerPlugin;

	constructor(app: App, plugin: DiscordSummarizerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Discord Channel ID')
			.setDesc('ID of Discord channel to summarize')
			.addText(text => text
				.setPlaceholder('Enter Channel ID')
				.setValue(this.plugin.settings.discordChannelId)
				.onChange(async (value) => {
					this.plugin.settings.discordChannelId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Discord Server ID')
			.setDesc('ID of Discord Server')
			.addText(text => text
				.setPlaceholder('Enter Server ID')
				.setValue(this.plugin.settings.discordServerId)
				.onChange(async (value) => {
					this.plugin.settings.discordServerId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Discord Token')
			.setDesc('Authentication Token for Discord')
			.addText(text => { 
				wrapTextWithPasswordHide(text); 
				text
				.setPlaceholder('Enter Discord Token')
				.setValue(this.plugin.settings.discordToken)
				.onChange(async (value) => {
					this.plugin.settings.discordToken = value;
					await this.plugin.saveSettings();
				});
				text.inputEl.style.width = '500px';
			});

		new Setting(containerEl)
			.setName('OpenAI Key')
			.setDesc('Authentication Key for OpenAI')
			.addText(text => { 
				wrapTextWithPasswordHide(text);
				text
				.setPlaceholder('Enter OpenAI Key')
				.setValue(this.plugin.settings.openAIKey)
				.onChange(async (value) => {
					this.plugin.settings.openAIKey = value;
					await this.plugin.saveSettings();
				});
				text.inputEl.style.width = '500px';
			});
	}
}

const wrapTextWithPasswordHide = (text: TextComponent) => {
	const hider = text.inputEl.insertAdjacentElement(
		"beforebegin",
		createSpan()
	);
	if (!hider) {
		return;
	}
	setIcon(hider as HTMLElement, "eye-off");

	hider.addEventListener("click", () => {
		const isText = text.inputEl.getAttribute("type") === "text";
		if (isText) {
			setIcon(hider as HTMLElement, "eye-off");
			text.inputEl.setAttribute("type", "password");
		} else {
			setIcon(hider as HTMLElement, "eye");
			text.inputEl.setAttribute("type", "text");
		}
		text.inputEl.focus();
	});
	text.inputEl.setAttribute("type", "password");
	return text;
};