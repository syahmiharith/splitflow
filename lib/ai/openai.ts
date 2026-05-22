import { aiResponseJsonSchema, aiResponseSchema, type AiRequest, type AiResponse } from "@/lib/ai/schemas";

type ResponsesApiOutput = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function extractOutputText(payload: ResponsesApiOutput): string | null {
  if (typeof payload.output_text === "string") return payload.output_text;

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if ((content.type === "output_text" || content.type === "text") && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

export async function callSplitAgent(input: AiRequest): Promise<AiResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You are SplitFlow's neutral AI Split Agent. Convert organizer requests into clear shared-cost proposal drafts. Keep money math approximate only; deterministic app code owns final calculation. Return only schema-valid JSON."
        },
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "splitflow_split_agent_response",
          strict: true,
          schema: aiResponseJsonSchema
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error("OpenAI request failed.");
  }

  const payload = (await response.json()) as ResponsesApiOutput;
  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI response did not include output text.");
  }

  const parsed = JSON.parse(outputText) as unknown;
  return aiResponseSchema.parse(parsed);
}
