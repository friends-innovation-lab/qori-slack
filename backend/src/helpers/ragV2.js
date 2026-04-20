
require("dotenv").config();

const { Graph } = require("@langchain/langgraph");

const RAG_ENABLED =
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_ANON_KEY &&
  process.env.OPENAI_API_KEY;

let runRagV2;

if (RAG_ENABLED) {
  const { ChatOpenAI, OpenAIEmbeddings } = require("@langchain/openai");
  const { SupabaseVectorStore } = require("@langchain/community/vectorstores/supabase");
  const { createClient } = require("@supabase/supabase-js");
  const { SUMMARY_PROMPT } = require("./prompts");

  const llm        = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0 });
  const embeddings = new OpenAIEmbeddings();
  const supabase   = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const store      = new SupabaseVectorStore(embeddings, { client: supabase, tableName: "documents" });

  const classifyNode = async ({ input, targetStudies = "ALL", promptTemplate }) => {
    return { input, targetStudies, promptTemplate };
  };

  const retrievalNode = async ({ input, targetStudies, promptTemplate }) => {
    let filter = undefined;
    if (targetStudies !== "ALL") {
      const studyIds = targetStudies.split(/\s*,\s*/);
      filter = { folder: studyIds[0] };
    }
    const docs = await store.asRetriever({ k: 10, filter }).getRelevantDocuments(input);
    return { input, docs, promptTemplate };
  };

  const answerNode = async ({ input, docs, promptTemplate }) => {
    const context = docs.map(doc => doc.pageContent).join('\n\n');
    const tpl      = promptTemplate || SUMMARY_PROMPT;
    const formattedPrompt = await tpl.formatMessages({ context, input });
    const response = await llm.invoke(formattedPrompt);
    return response.text;
  };

  runRagV2 = new Graph()
    .addNode("classify", classifyNode)
    .addNode("retrieve", retrievalNode)
    .addNode("answer", answerNode)
    .addEdge("classify", "retrieve")
    .addEdge("retrieve", "answer")
    .setEntryPoint("classify")
    .setFinishPoint("answer")
    .compile();

  console.log("✅ RAG pipeline initialized (Supabase + OpenAI)");
} else {
  console.warn("⚠️  RAG disabled: SUPABASE_URL, SUPABASE_ANON_KEY, or OPENAI_API_KEY not set");

  runRagV2 = {
    invoke: async () => {
      throw new Error("RAG is not available — missing SUPABASE_URL, SUPABASE_ANON_KEY, or OPENAI_API_KEY env vars");
    }
  };
}

module.exports = { runRagV2 };
