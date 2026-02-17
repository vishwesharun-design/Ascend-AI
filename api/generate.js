import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    // CORS handling
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { goal, isPriority, mode } = req.body;

    if (!goal) {
        return res.status(400).json({ error: 'Goal is required' });
    }

    const apiKeys = [
        process.env.GEMINI_API_KEY
    ].filter(Boolean);

    if (apiKeys.length === 0) {
        return res.status(500).json({ error: "Server configuration error: No API key found" });
    }

    // Simple key rotation strategy for stateless function
    // In a real serverless env, we can't easily persist the index across invocations without external storage (Redis/KV)
    // causing this to always start at 0. For now, we'll pick a random key to distribute load.
    const currentKeyIndex = Math.floor(Math.random() * apiKeys.length);
    const key = apiKeys[currentKeyIndex];

    const getAI = () => new GoogleGenAI({ apiKey: key });

    const preferredModels = isPriority
        ? ['gemini-1.5-pro', 'gemini-1.5-flash']
        : ['gemini-1.5-flash', 'gemini-1.5-pro'];

    const modeInstructions = {
        "Standard": "Focus on a balanced, high-impact strategy with realistic timelines.",
        "Detailed": "Provide extremely deep, granular analysis. Break down milestones into highly specific technical or operational tasks. Elaborate on vision.",
        "Rapid": "Focus only on the most critical 'Path of Least Resistance'. High-level, fast execution oriented.",
        "Market Intel": "Prioritize deep market intelligence, competitor gaps, and eternal trends over internal milestones."
    };

    const selectedMode = mode || "Standard";
    const instructions = modeInstructions[selectedMode] || modeInstructions["Standard"];

    let lastError = null;

    for (const modelName of preferredModels) {
        try {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: modelName,
                contents: {
                    role: "user",
                    parts: [{
                        text: `Act as a world-class strategic architect. Generate a rigorous, actionable success blueprint for: "${goal}". 
            MODE: ${selectedMode}.
            INSTRUCTIONS: ${instructions}
            ${isPriority ? 'Apply maximum analytical depth and expert-level reasoning.' : 'Keep it accessible yet highly effective.'} 
            The output MUST be valid JSON.`
                    }]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            goalTitle: { type: "STRING" },
                            visionStatement: { type: "STRING" },
                            strategyRoadmap: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        title: { type: "STRING" },
                                        description: { type: "STRING" },
                                        timeline: { type: "STRING" },
                                        status: { type: "STRING" }
                                    },
                                    required: ["title", "description", "timeline", "status"]
                                }
                            },
                            marketAnalysis: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        title: { type: "STRING" },
                                        description: { type: "STRING" },
                                        sourceUrl: { type: "STRING" }
                                    },
                                    required: ["title", "description", "sourceUrl"]
                                }
                            },
                            coreFocus: {
                                type: "ARRAY",
                                items: { type: "STRING" },
                                description: "3 simple, high-impact focus points."
                            }
                        },
                        required: ["goalTitle", "visionStatement", "strategyRoadmap", "marketAnalysis", "coreFocus"]
                    }
                }
            });

            // Set headers for streaming
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Stream the response
            let buffer = '';
            let isJsonComplete = false;

            for await (const chunk of response.stream()) {
                if (chunk.text) {
                    const text = chunk.text();
                    buffer += text;
                    
                    // Send accumulated text chunks to client
                    res.write(`data: ${JSON.stringify({ type: 'content', text: text })}\n\n`);
                }
            }

            // Try to parse complete JSON from buffer
            try {
                const json = JSON.parse(buffer);
                res.write(`data: ${JSON.stringify({ type: 'complete', data: json })}\n\n`);
                isJsonComplete = true;
            } catch (parseErr) {
                // If not valid JSON, just mark as done
                res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            }

            res.end();
            return;

        } catch (err) {
            lastError = err;
            console.error(`Error with model ${modelName}:`, err);
            // Continue to next model if available
        }
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: lastError?.message || "Failed to generate blueprint" });
}
