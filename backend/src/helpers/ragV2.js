
require("dotenv").config();

const { ChatOpenAI } = require("@langchain/openai");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { SupabaseVectorStore } = require("@langchain/community/vectorstores/supabase");
const { Graph } = require("@langchain/langgraph");
const { createClient } = require("@supabase/supabase-js");
const { SUMMARY_PROMPT } = require("./prompts");


const llm        = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 });
const embeddings = new OpenAIEmbeddings();
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://afgrgofklkllsshyfill.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZ3Jnb2ZrbGtsbHNzaHlmaWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3MzI3NzksImV4cCI6MjA2NTMwODc3OX0.tFzGg-bjXO3XbSkc7q3Ma9AlH7V_VG3tiB0gOa-xRKg'
  );
const store      = new SupabaseVectorStore(embeddings, { client: supabase, tableName: "documents" });

/** 1️⃣ small classifier that extracts mentioned studies */
const classifyNode = async ({ input, targetStudies = "ALL", promptTemplate }) => {
  return { input, targetStudies, promptTemplate };
};


/** 2️⃣ pick retriever filter */
const retrievalNode = async ({ input, targetStudies, promptTemplate  }) => {
console.log("🚀 ~ retrievalNode ~ input:", input)
  let filter = undefined;
  console.log('targetStudies ', targetStudies);
  if (targetStudies !== "ALL") {
    const studyIds = targetStudies.split(/\s*,\s*/);
    console.log('studyIds ', studyIds);
    filter = { folder: studyIds[0] };
  } else {
    // filter = { study: { $in: ["abdul rehman"] } };
  }
  console.log("🚀 ~ retrievalNode ~ filter:", filter)
  
  const docs = await store.asRetriever({ k: 10, filter }).getRelevantDocuments(input);
  return { input, docs, promptTemplate };
};

/** 3️⃣ shove docs + question through LLM */
const answerNode = async ({ input, docs, promptTemplate }) => {
  console.log('docs ', docs);
  const context = docs.map(doc => doc.pageContent).join('\n\n');
  const tpl      = promptTemplate || SUMMARY_PROMPT;
  const formattedPrompt = await tpl.formatMessages({ context, input });
  console.log('context ', context);
  const response = await llm.invoke(formattedPrompt);
  return response.text;
};
const runRagV2 = new Graph()
  .addNode("classify", classifyNode)
  .addNode("retrieve", retrievalNode)
  .addNode("answer", answerNode)
  .addEdge("classify", "retrieve")
  .addEdge("retrieve", "answer")
  .setEntryPoint("classify")
  .setFinishPoint("answer")
  .compile();

module.exports = {runRagV2}  
