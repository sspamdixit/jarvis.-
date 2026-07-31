use chrono::Timelike;
use once_cell::sync::Lazy;
use regex::Regex;

pub struct RouterMatch {
    pub pattern: String,
    pub action: String,
    pub reply: String,
    /// For task_add: the text of the new task
    pub task_text: Option<String>,
    /// For preference tracking: (category, platform)
    pub preference: Option<(String, String)>,
}

// ── Precompiled patterns ──────────────────────────────────────────────────────

static RE_TIME: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(what('s| is) the time|what time is it|current time)\b").unwrap()
});
static RE_DATE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(what('s| is) (the |today('s)? )?date|what day is (it|today))\b").unwrap()
});
static RE_TASK_ADD1: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\badd (.+?) to (my )?(list|tasks|to-?do)\b").unwrap()
});
static RE_TASK_ADD2: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(remind me to|create a? task (to )?|add task )(.+)").unwrap()
});
static RE_TASK_LIST: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(show|list|what('s| are)( on)?( my)?) (tasks|to-?do|list)\b").unwrap()
});
static RE_TASK_COMPLETE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(complete|finish|done with|mark as done|check off) (.+)").unwrap()
});
static RE_PLAY_SPOTIFY: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\bplay (.+?) on spotify\b").unwrap()
});
static RE_PLAY_YOUTUBE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\bplay (.+?) on youtube( music)?\b").unwrap()
});
static RE_PLAY_GENERIC: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\bplay (.+)").unwrap()
});
static RE_VOLUME: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(set |turn )?(volume|vol)(?: (up|down|to))?(?: (\d+))?\b").unwrap()
});
static RE_CLEAR: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(clear (screen|history|log)|reset)\b").unwrap()
});
static RE_GREET: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(hello|hi|hey david|good (morning|afternoon|evening))\b").unwrap()
});
static RE_HELP: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(help|what can you do|commands|what do you know)\b").unwrap()
});
static RE_JOKE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(tell me a joke|joke)\b").unwrap()
});

// ── Router ────────────────────────────────────────────────────────────────────

pub fn route(query: &str) -> Option<RouterMatch> {
    // Time
    if RE_TIME.is_match(query) {
        let now = chrono::Local::now();
        return Some(RouterMatch {
            pattern: "time".into(),
            action: "time".into(),
            reply: format!(
                "The current time is {}.",
                now.format("%I:%M %p")
            ),
            task_text: None,
            preference: None,
        });
    }

    // Date
    if RE_DATE.is_match(query) {
        let now = chrono::Local::now();
        return Some(RouterMatch {
            pattern: "date".into(),
            action: "date".into(),
            reply: format!(
                "Today is {}.",
                now.format("%A, %B %-d, %Y")
            ),
            task_text: None,
            preference: None,
        });
    }

    // Task add — "add X to my list"
    if let Some(caps) = RE_TASK_ADD1.captures(query) {
        let text = caps[1].to_string();
        return Some(RouterMatch {
            pattern: "task_add_1".into(),
            action: "task_add".into(),
            reply: format!("Added \"{}\" to your task list.", text),
            task_text: Some(text),
            preference: None,
        });
    }

    // Task add — "remind me to X" / "create task X"
    if let Some(caps) = RE_TASK_ADD2.captures(query) {
        let text = caps[3].to_string();
        return Some(RouterMatch {
            pattern: "task_add_2".into(),
            action: "task_add".into(),
            reply: format!("Added \"{}\" to your task list.", text),
            task_text: Some(text),
            preference: None,
        });
    }

    // Task list
    if RE_TASK_LIST.is_match(query) {
        return Some(RouterMatch {
            pattern: "task_list".into(),
            action: "task_list".into(),
            reply: "Here are your current tasks.".into(),
            task_text: None,
            preference: None,
        });
    }

    // Task complete
    if let Some(caps) = RE_TASK_COMPLETE.captures(query) {
        let text = caps[2].to_string();
        return Some(RouterMatch {
            pattern: "task_complete".into(),
            action: "task_complete".into(),
            reply: format!("Marked \"{}\" as complete.", text),
            task_text: Some(text),
            preference: None,
        });
    }

    // Spotify
    if let Some(caps) = RE_PLAY_SPOTIFY.captures(query) {
        return Some(RouterMatch {
            pattern: "play_spotify".into(),
            action: "play_spotify".into(),
            reply: format!("Playing \"{}\" on Spotify.", &caps[1]),
            task_text: None,
            preference: Some(("music".into(), "spotify".into())),
        });
    }

    // YouTube
    if let Some(caps) = RE_PLAY_YOUTUBE.captures(query) {
        return Some(RouterMatch {
            pattern: "play_youtube".into(),
            action: "play_youtube".into(),
            reply: format!("Playing \"{}\" on YouTube Music.", &caps[1]),
            task_text: None,
            preference: Some(("music".into(), "youtube".into())),
        });
    }

    // Generic play
    if let Some(caps) = RE_PLAY_GENERIC.captures(query) {
        return Some(RouterMatch {
            pattern: "play_music".into(),
            action: "play_music".into(),
            reply: format!("Playing \"{}\".", &caps[1]),
            task_text: None,
            preference: None,
        });
    }

    // Volume
    if let Some(caps) = RE_VOLUME.captures(query) {
        let reply = if caps.get(4).map(|m| m.as_str()) == Some("up") {
            "Volume increased.".into()
        } else if caps.get(4).map(|m| m.as_str()) == Some("down") {
            "Volume decreased.".into()
        } else if let Some(level) = caps.get(5) {
            format!("Volume set to {}%.", level.as_str())
        } else {
            "Adjusting volume.".into()
        };
        return Some(RouterMatch {
            pattern: "volume".into(),
            action: "volume".into(),
            reply,
            task_text: None,
            preference: None,
        });
    }

    // Clear screen
    if RE_CLEAR.is_match(query) {
        return Some(RouterMatch {
            pattern: "clear".into(),
            action: "clear_screen".into(),
            reply: "Screen cleared.".into(),
            task_text: None,
            preference: None,
        });
    }

    // Greeting
    if RE_GREET.is_match(query) {
        let hour = chrono::Local::now().hour();
        let period = if hour < 12 {
            "morning"
        } else if hour < 17 {
            "afternoon"
        } else {
            "evening"
        };
        return Some(RouterMatch {
            pattern: "greeting".into(),
            action: "greeting".into(),
            reply: format!("Good {}! I'm david. How can I help you today?", period),
            task_text: None,
            preference: None,
        });
    }

    // Help
    if RE_HELP.is_match(query) {
        return Some(RouterMatch {
            pattern: "help".into(),
            action: "help".into(),
            reply: "I can handle time, date, tasks, music, and volume locally. Anything else goes to Gemini AI.".into(),
            task_text: None,
            preference: None,
        });
    }

    // Joke
    if RE_JOKE.is_match(query) {
        return Some(RouterMatch {
            pattern: "joke".into(),
            action: "joke".into(),
            reply: "Why do programmers prefer dark mode? Because light attracts bugs.".into(),
            task_text: None,
            preference: None,
        });
    }

    None
}
