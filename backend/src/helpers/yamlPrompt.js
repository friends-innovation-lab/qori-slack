const yaml = require("js-yaml");
const { ChatPromptTemplate } = require("@langchain/core/prompts");

/**
 * Convert the raw string from template.yml into a ready-to-use
 * ChatPromptTemplate.  It replaces {{input}} → {input} so LangChain
 * can fill it, then appends the `output_format` block verbatim so
 * the model follows that skeleton.
 *
 * @param {string} yamlString  – full contents of template.yml
 * @returns {ChatPromptTemplate}
 */
function buildPromptFromYaml(yamlString) {
  const obj = yaml.load(yamlString);

  if (!obj.prompt || !obj.output_format) {
    throw new Error("YAML must contain `prompt` and `output_format` keys");
  }

  // 1️⃣ swap Jinja placeholder → LangChain placeholder
  const body = obj.prompt.replace(/{{\s*input\s*}}/g, "{input}");

  // 2️⃣ final text the model will see
  const templateText = `
${body}

Follow *exactly* the Markdown structure below – replace every
bracketed hint with the correct text, keep all headings and bullets.

${obj.output_format}
  `.trim();

  return ChatPromptTemplate.fromTemplate(templateText);
}

module.exports = { buildPromptFromYaml };
