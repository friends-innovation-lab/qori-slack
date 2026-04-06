const { ChatPromptTemplate } = require("@langchain/core/prompts");

const SUMMARY_PROMPT = ChatPromptTemplate.fromTemplate(`
Use the context below to answer the user, citing sources where relevant.

<context>
{context}
</context>
QUESTION: {input}
`);

const DIFF_PROMPT = ChatPromptTemplate.fromTemplate(`
Compare the studies as requested by the user. Use bullet points and reference study IDs.

<context>
{context}
</context>
QUESTION: {input}
`);

module.exports ={SUMMARY_PROMPT}
