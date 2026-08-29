const secret = (value) => String(value || '').trim();
const configured = (value, fallback) => String(value || fallback).trim();

export class OpenAIResponsesError extends Error {
  constructor(message, { status = 500, body = null } = {}) {
    super(message);
    this.name = 'OpenAIResponsesError';
    this.status = status;
    this.body = body;
  }
}

const collectOutput = (response) => {
  const texts = [];
  const citations = [];
  const sources = [];

  for (const item of response?.output || []) {
    if (item?.type === 'message') {
      for (const content of item.content || []) {
        if (content?.type === 'output_text' && typeof content.text === 'string') {
          texts.push(content.text);
          for (const annotation of content.annotations || []) {
            if (annotation?.type === 'url_citation' && annotation.url) {
              citations.push({
                url: annotation.url,
                title: annotation.title || null,
                startIndex: annotation.start_index ?? null,
                endIndex: annotation.end_index ?? null
              });
            }
          }
        }
      }
    }
    if (item?.type === 'web_search_call') {
      for (const source of item.action?.sources || item.sources || []) {
        if (source?.url) sources.push({ url: source.url, title: source.title || null, type: source.type || null });
      }
    }
  }

  const seen = new Set();
  const dedupe = (items) => items.filter((item) => {
    const key = item.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    output: response?.output_text || texts.join('\n\n').trim(),
    citations: dedupe(citations),
    sources: dedupe([...sources, ...citations]),
    responseId: response?.id || null,
    model: response?.model || null,
    usage: response?.usage || null
  };
};

export const createResponsesExecutor = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const apiKey = secret(env.OPENAI_API_KEY || env.LLM_API_KEY);
  const endpoint = configured(env.OPENAI_RESPONSES_URL, 'https://api.openai.com/v1/responses');
  const researchModel = configured(env.RESEARCH_MODEL, 'gpt-5.6-terra');
  const generalModel = configured(env.GENERAL_AGENT_MODEL, 'gpt-5.6-terra');

  const run = async ({ prompt, research = false, reasoningEffort = 'medium' }) => {
    if (!apiKey) {
      throw new OpenAIResponsesError('OPENAI_API_KEY is not configured', { status: 503 });
    }

    const payload = {
      model: research ? researchModel : generalModel,
      input: prompt,
      reasoning: { effort: reasoningEffort }
    };
    if (research) {
      payload.tools = [{ type: 'web_search', search_context_size: 'medium' }];
      payload.include = ['web_search_call.action.sources'];
    }

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new OpenAIResponsesError(body?.error?.message || `Responses API failed: ${response.status}`, {
        status: response.status,
        body
      });
    }
    const result = collectOutput(body);
    if (!result.output) throw new OpenAIResponsesError('Responses API returned no text output', { status: 502, body });
    return result;
  };

  return {
    mode: apiKey ? 'connected' : 'not_configured',
    researchModel,
    generalModel,
    run
  };
};

export const extractLooseJson = (value) => {
  if (typeof value !== 'string') return null;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidates = [fenced, value];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try { return JSON.parse(candidate.trim()); } catch {}
    const objectStart = candidate.indexOf('{');
    const objectEnd = candidate.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      try { return JSON.parse(candidate.slice(objectStart, objectEnd + 1)); } catch {}
    }
  }
  return null;
};
