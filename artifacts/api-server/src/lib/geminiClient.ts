import { GoogleGenAI } from "@google/genai";

const apiKey = process.env["GEMINI_API_KEY"];

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is required.");
}

export const gemini = new GoogleGenAI({ apiKey });

/**
 * Ask Gemini AI a question with optional user preference context.
 */
export async function askGemini(
  query: string,
  preferences: Array<{ category: string; platform: string; count: number }> = []
): Promise<string> {
  const prefContext =
    preferences.length > 0
      ? `User preferences (learned from usage): ${preferences.map((p) => `${p.category}: ${p.platform} (used ${p.count} times)`).join(", ")}.`
      : "";

  const systemInstruction = [
    "You are EchoPulse, a sleek and intelligent voice assistant.",
    "Respond concisely — your answers will be spoken aloud by a text-to-speech engine.",
    "Keep responses under 3 sentences when possible. Be helpful, direct, and occasionally witty.",
    prefContext,
  ]
    .filter(Boolean)
    .join(" ");

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: query }] }],
    config: {
      systemInstruction,
      maxOutputTokens: 512,
    },
  });

  return response.text ?? "I'm sorry, I couldn't generate a response.";
}
