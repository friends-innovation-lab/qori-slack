const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');

// async function executeAiGenerationTasks(aiGenerationTasks, inputValues) {
//   console.log("🚀 ~ executeAiGenerationTasks ~ inputValues:", inputValues)
//   const llm = new ChatOpenAI({
//     modelName: 'gpt-3.5-turbo',
//     temperature: 0.4,
//     maxTokens: 3000,
//   });

//   // Dynamically execute all tasks based on task config
//   const aiResponses = {};

//   // Use Promise.all to execute tasks concurrently and avoid await in loop
//   const taskPromises = aiGenerationTasks.map(async (task) => {
//     // Convert Handlebars-style placeholders {{variable}} to LangChain format {variable}
//     const convertedPrompt = task.prompt.replace(/\{\{\s*(\w+)\s*\}\}/g, '{$1}');

//     const promptTemplate = PromptTemplate.fromTemplate(convertedPrompt);
//     const formattedPrompt = await promptTemplate.format(inputValues);
//     const response = await llm.invoke(formattedPrompt);
//     return { taskId: task.task_id, response: response.content };
//   });

//   const results = await Promise.all(taskPromises);

//   // Build the response object
//   results.forEach(({ taskId, response }) => {
//     aiResponses[taskId] = response;
//   });

//   return aiResponses;
// }



const nunjucks = require('nunjucks');
// make sure nunjucks knows it’s okay to render standalone strings
nunjucks.configure({ autoescape: false });

// async function executeAiGenerationTasks(aiGenerationTasks, inputValues) {
//   const llm = new ChatOpenAI({ modelName: 'gpt-3.5-turbo', temperature: 0.4, maxTokens: 3000 });
//   const aiResponses = {};

//   const taskPromises = aiGenerationTasks.map(async (task) => {
//     // 1) Render all Jinja if‑blocks, loops, etc.
//     const jinjaOut = nunjucks.renderString(task.prompt, inputValues);

//     // 2) Convert your {{var}} placeholders to LangChain’s {var}
//     const convertedPrompt = jinjaOut.replace(/\{\{\s*(\w+)\s*\}\}/g, '{$1}');

//     // 3) Feed into PromptTemplate as before
//     const promptTemplate = PromptTemplate.fromTemplate(convertedPrompt);
//     const formattedPrompt = await promptTemplate.format(inputValues);

//     const response = await llm.invoke(formattedPrompt);
//     return { taskId: task.task_id, response: response.content };
//   });

//   (await Promise.all(taskPromises)).forEach(({ taskId, response }) => {
//     aiResponses[taskId] = response;
//   });

//   return aiResponses;
// }

const { ChatAnthropic } = require("@langchain/anthropic");

// Convert Handlebars-style conditionals to Nunjucks syntax
// This allows templates to use either Handlebars {{#if}} or Nunjucks {% if %} syntax
function convertHandlebarsToNunjucks(template) {
  let converted = template;
  
  // IMPORTANT: Convert {{else}} FIRST to prevent Nunjucks from parsing it as a variable
  // Convert {{else}} to {% else %}
  converted = converted.replace(/\{\{else\}\}/g, '{% else %}');
  
  // Convert {{#if variable}} to {% if variable %} (handles optional spaces)
  converted = converted.replace(/\{\{#if\s+(\w+)\s*\}\}/g, '{% if $1 %}');
  
  // Convert {{#unless variable}} to {% if not variable %}
  converted = converted.replace(/\{\{#unless\s+(\w+)\s*\}\}/g, '{% if not $1 %}');
  
  // Convert {{/if}} to {% endif %}
  converted = converted.replace(/\{\{\/if\}\}/g, '{% endif %}');
  
  // Convert {{#each variable}} to {% for item in variable %}
  converted = converted.replace(/\{\{#each\s+(\w+)\s*\}\}/g, '{% for item in $1 %}');
  converted = converted.replace(/\{\{\/each\}\}/g, '{% endfor %}');
  
  // Note: We keep {% else if %} as-is since Nunjucks supports it
  // The {{else}} above will be converted to {% else %} for the final fallback
  
  return converted;
}

async function executeAiGenerationTasks(aiGenerationTasks, inputValues) {
  // Get AI model configuration from environment variables with defaults
  const modelName = process.env.ANTHROPIC_MODEL_NAME || "claude-sonnet-4-20250514";
  const temperature = parseFloat(process.env.ANTHROPIC_TEMPERATURE || "0.4");
  const maxTokens = parseInt(process.env.ANTHROPIC_MAX_TOKENS || "3000", 10);

  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
  }

  const llm = new ChatAnthropic({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    modelName: modelName,
    temperature: temperature,
    maxTokens: maxTokens,
  });
  const aiResponses = {};

  const taskPromises = aiGenerationTasks.map(async (task) => {
    try {
      // 0) Convert Handlebars syntax to Nunjucks if present
      const nunjucksTemplate = convertHandlebarsToNunjucks(task.prompt);
      
      // 1) Render all Jinja/Nunjucks if-blocks, loops, etc.
      const jinjaOut = nunjucks.renderString(nunjucksTemplate, inputValues);

      // 2) Convert your {{var}} placeholders to LangChain's {var}
      const convertedPrompt = jinjaOut.replace(/\{\{\s*(\w+)\s*\}\}/g, "{$1}");

      // 3) Feed into PromptTemplate as before
      const promptTemplate = PromptTemplate.fromTemplate(convertedPrompt);
      const formattedPrompt = await promptTemplate.format(inputValues);

      const response = await llm.invoke(formattedPrompt);
      return { taskId: task.task_id, response: response.content };
    } catch (error) {
      console.error(`Error processing task ${task.task_id}:`, error);
      throw error;
    }
  });

  (await Promise.all(taskPromises)).forEach(({ taskId, response }) => {
    aiResponses[taskId] = response;
  });

  return aiResponses;
}

module.exports = { executeAiGenerationTasks };

