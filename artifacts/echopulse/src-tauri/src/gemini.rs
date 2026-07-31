use crate::db::Preference;
use serde::{Deserialize, Serialize};

const API_URL: &str =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// ── Request types ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct Request {
    contents: Vec<Content>,
    #[serde(rename = "systemInstruction")]
    system_instruction: SystemInstruction,
    #[serde(rename = "generationConfig")]
    generation_config: GenerationConfig,
}

#[derive(Serialize)]
struct Content {
    role: String,
    parts: Vec<Part>,
}

#[derive(Serialize)]
struct Part {
    text: String,
}

#[derive(Serialize)]
struct SystemInstruction {
    parts: Vec<Part>,
}

#[derive(Serialize)]
struct GenerationConfig {
    #[serde(rename = "maxOutputTokens")]
    max_output_tokens: u32,
}

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct Response {
    candidates: Option<Vec<Candidate>>,
}

#[derive(Deserialize)]
struct Candidate {
    content: Option<CandidateContent>,
}

#[derive(Deserialize)]
struct CandidateContent {
    parts: Option<Vec<ResponsePart>>,
}

#[derive(Deserialize)]
struct ResponsePart {
    text: Option<String>,
}

// ── Public API ────────────────────────────────────────────────────────────────

pub async fn ask(
    query: &str,
    api_key: &str,
    preferences: &[Preference],
) -> Result<String, String> {
    let pref_ctx = if preferences.is_empty() {
        String::new()
    } else {
        let list = preferences
            .iter()
            .map(|p| format!("{}: {} (used {} times)", p.category, p.platform, p.count))
            .collect::<Vec<_>>()
            .join(", ");
        format!("User preferences learned from usage: {}.", list)
    };

    let system_text = [
        "You are david, a sleek and intelligent personal voice assistant.",
        "Respond concisely — your answers will be spoken aloud by text-to-speech.",
        "Keep responses under 3 sentences when possible. Be helpful, direct, and occasionally witty.",
        &pref_ctx,
    ]
    .iter()
    .filter(|s| !s.is_empty())
    .cloned()
    .collect::<Vec<_>>()
    .join(" ");

    let body = Request {
        contents: vec![Content {
            role: "user".into(),
            parts: vec![Part { text: query.to_string() }],
        }],
        system_instruction: SystemInstruction {
            parts: vec![Part { text: system_text }],
        },
        generation_config: GenerationConfig {
            max_output_tokens: 512,
        },
    };

    let url = format!("{}?key={}", API_URL, api_key);
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini API error {}: {}", status, text));
    }

    let parsed: Response = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    parsed
        .candidates
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.content)
        .and_then(|c| c.parts)
        .and_then(|p| p.into_iter().next())
        .and_then(|p| p.text)
        .ok_or_else(|| "Empty response from Gemini".to_string())
}
