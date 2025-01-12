// Import the OpenAI npm module
import { OpenAI } from 'openai';

// Define the function to call the OpenAI chat endpoint
export async function getCompletion(prompt: string, key: string, model: string = 'gpt-4o') {
    try {
        // Configure the OpenAI API client
        const openai = new OpenAI({
            apiKey: key,
             dangerouslyAllowBrowser: true 
        });
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
              { role: 'user', content: prompt },
            ],
          });

        return response.choices[0]?.message?.content;

    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        throw error;
    }
}
