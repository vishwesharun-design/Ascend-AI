import { SuccessBlueprint, ArchitectMode } from "../types";

export class GeminiService {
  private apiUrl = "/api/generate";

  async generateBlueprintWithStream(
    goal: string,
    isPriority: boolean = false,
    mode: ArchitectMode = ArchitectMode.STANDARD,
    onChunk?: (chunk: string) => void,
    onComplete?: (blueprint: SuccessBlueprint) => void,
    userId?: string
  ): Promise<SuccessBlueprint> {
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          goal,
          isPriority,
          mode,
          userId
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error || `Server error: ${response.status}`
        );
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completeBlueprint: SuccessBlueprint | null = null;

      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Parse server-sent events
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === 'content' && data.text) {
                    // Stream text chunks to UI
                    onChunk?.(data.text);
                  } else if (data.type === 'complete' && data.data) {
                    // Full blueprint received
                    completeBlueprint = data.data;
                    onComplete?.(completeBlueprint);
                  }
                } catch (e) {
                  // Ignore JSON parse errors for incomplete events
                }
              }
            }
          }
        }
      }

      // Return complete blueprint or construct from streaming data
      if (completeBlueprint) {
        return completeBlueprint;
      }

      // Fallback if streaming didn't complete properly
      return {
        goalTitle: goal || "Untitled Goal",
        visionStatement: "AI-generated execution roadmap.",
        coreFocus: [
          "Execution Discipline",
          "Strategic Clarity",
          "Momentum Building",
        ],
        strategyRoadmap: [
          {
            title: "Phase 1: Strategic Foundation",
            description: "Streaming content generation in progress...",
            timeline: "Initial Phase",
            status: "pending",
          }
        ],
        marketAnalysis: [
          {
            title: "AI Strategic Insight",
            description:
              "Generated using Gemini 2.5 Flash model for structured execution planning.",
            sourceUrl: "",
          }
        ]
      };

    } catch(err: any) {
      console.error("Blueprint generation error:", err);

      // Return safe fallback blueprint instead of crashing React
      return {
        goalTitle: goal || "Goal",
        visionStatement: "System could not generate blueprint.",
        coreFocus: [],
        strategyRoadmap: [],
        marketAnalysis: []
      };
    }
  }

  async generateBlueprint(
    goal: string,
    isPriority: boolean = false,
    mode: ArchitectMode = ArchitectMode.STANDARD
  ): Promise<SuccessBlueprint> {
    return this.generateBlueprintWithStream(goal, isPriority, mode, undefined, undefined);
  }
}

export const geminiService = new GeminiService();
