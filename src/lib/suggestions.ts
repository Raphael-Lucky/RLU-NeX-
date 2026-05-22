const SUGGESTION_POOL = [
  'Explain quantum computing in simple terms',
  'Write a professional email to reschedule a meeting',
  'Debug this JavaScript function for me',
  'Summarize the key concepts of machine learning',
  'Help me plan a productive week',
  'Draft a short cover letter for a software role',
  'What are the pros and cons of remote work?',
  'Turn my rough notes into a clear outline',
  'Suggest three dinner ideas with what I have at home',
  'Explain recursion like I am new to programming',
  'Help me brainstorm names for a startup',
  'Write a polite follow-up message after an interview',
  'Compare React and Vue for a small web app',
  'Create a study schedule for an upcoming exam',
  'Summarize this article in five bullet points',
  'Help me fix grammar and tone in this paragraph',
  'What should I ask in a one-on-one with my manager?',
  'Generate ideas for a YouTube video about productivity',
  'Explain how large language models work',
  'Help me break a big project into smaller tasks',
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickSuggestions(count = 4, firstName?: string): string[] {
  const personalized = firstName
    ? [
        `What should I focus on today, ${firstName}?`,
        `Help me set one goal for this week, ${firstName}`,
      ]
    : [];

  const pool = [...personalized, ...SUGGESTION_POOL];
  return shuffle(pool).slice(0, count);
}
