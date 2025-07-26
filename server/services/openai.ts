import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function enhanceEventDescription(
  title: string,
  originalDescription: string,
  location: string,
  category: string
): Promise<string> {
  try {
    const prompt = `
You are a local Des Moines event expert. Enhance the following event description to be more engaging and informative for locals and visitors. Include relevant details about what to expect, who might enjoy it, and any local context that would be helpful.

Event Title: ${title}
Original Description: ${originalDescription}
Location: ${location}
Category: ${category}

Please provide an enhanced description that is:
- More engaging and descriptive
- Includes practical information
- Highlights what makes this event special
- Maintains accuracy to the original content
- Is 2-3 sentences long

Respond with only the enhanced description text.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
    });

    return response.choices[0].message.content?.trim() || originalDescription;
  } catch (error) {
    console.error("Failed to enhance event description:", error);
    return originalDescription;
  }
}

export async function generateLocalRecommendations(category: string): Promise<{
  restaurants: Array<{ name: string; cuisine: string; rating: number; description: string }>;
  attractions: Array<{ name: string; type: string; description: string }>;
  playgrounds: Array<{ name: string; features: string; description: string; ageRange: string }>;
}> {
  try {
    const prompt = `
Generate authentic recommendations for Des Moines, Iowa in the category of ${category}. 
Provide real, well-known establishments and locations that actually exist in Des Moines.

Respond with JSON in this exact format:
{
  "restaurants": [
    { "name": "Restaurant Name", "cuisine": "Cuisine Type", "rating": 4, "description": "Brief description" }
  ],
  "attractions": [
    { "name": "Attraction Name", "type": "Type", "description": "Brief description" }
  ],
  "playgrounds": [
    { "name": "Playground Name", "features": "Key features", "description": "Brief description", "ageRange": "Age range" }
  ]
}

Include 3-5 items per category. Only include real places that exist in Des Moines.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a Des Moines local expert. Only provide information about real, existing places in Des Moines, Iowa."
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  } catch (error) {
    console.error("Failed to generate local recommendations:", error);
    return { restaurants: [], attractions: [], playgrounds: [] };
  }
}
