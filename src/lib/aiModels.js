// Central config for the Groq model IDs the app uses.
//
// Groq periodically decommissions models (e.g. llama-3.3-70b-versatile,
// llama-4-scout). When that happens, update the one line here and every
// AI feature — URL import, photo import, recipe generation, Adjust-with-AI,
// nutrition, shopping list — picks up the new model. See the current list at
// https://console.groq.com/docs/models
export const AI_TEXT_MODEL = 'openai/gpt-oss-120b'   // text: extraction, generation, editing
export const AI_VISION_MODEL = 'qwen/qwen3.6-27b'    // image/OCR: photo import
