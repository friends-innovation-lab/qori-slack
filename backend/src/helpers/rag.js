// require("dotenv").config();

// const pathLib = require("node:path");
// const { ChatOpenAI } = require("@langchain/openai");
// const { OpenAIEmbeddings } = require("@langchain/openai");
// // const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
// const { ChatPromptTemplate } = require("@langchain/core/prompts");
// const { RetrievalQAChain } = require("langchain/chains");
// const { SupabaseVectorStore } = require("@langchain/community/vectorstores/supabase");
// const { createClient } = require("@supabase/supabase-js");

// // Supabase client setup
// const supabaseClient = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_ANON_KEY
// );

// // util: explode GitHub path → metadata
// function buildMetadata(repoPath, folderName, sha) {
//   const parts = repoPath.split("/");         // [product-team-1, study-1, primary-research, analysis, file.md]
//   // console.log("🚀 ~ buildMetadata ~ parts:", parts)
//   const ext = pathLib.extname(repoPath).slice(1); // md / pdf / …
//   return {
//     product: parts[1] ?? null,
//     study: parts[3] ?? null,
//     section: parts[4] ?? null,  // desk-research / primary-research / …
//     subsect: parts[5] ?? null,  // analysis / planning / …
//     folder: folderName,        // for good measure
//     path: repoPath,
//     sha,
//     ext
//   };
// }

// async function setupVectorStore(text, folderName, repoPath, sha) {
//   console.log("🚀 ~ setupVectorStore ~ repoPath:", repoPath)
//   // 0️⃣  Only skip when we already embedded this exact commit
//   // const { count, error } = await supabaseClient
//   //     .from("documents")
//   //     .select("id", { head: true, count: "exact" })
//   //     .eq("sha", sha);

//   // console.log("🚀 ~ setupVectorStore ~ count:", count)

//   // if (error) throw error;
//   // if (count === 0) {
//   // 1️⃣ Split, embed, build rows
//   const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
//   const docs = await splitter.createDocuments([text]);
//   const embeddings = new OpenAIEmbeddings();
//   const vectors = await embeddings.embedDocuments(docs.map(d => d.pageContent));

//   const rows = docs.map((doc, i) => ({
//     content: doc.pageContent,
//     embedding: vectors[i],
//     metadata: buildMetadata(repoPath, folderName, sha), // 👈 all the tags in JSON
//     path: repoPath,
//     sha
//   }));
//   // console.log("🚀 ~ rows ~ rows:", rows)

//   await supabaseClient.from("documents").insert(rows);
//   // }

//   // 2️⃣ Same vector store object either way
//   return new SupabaseVectorStore(new OpenAIEmbeddings(), {
//     client: supabaseClient,
//     tableName: "documents",
//     queryName: "match_documents"
//   });
// }


// // Custom function: optionally pass folderName to tag documents
// // async function setupVectorStore(text, folderName, path, sha) {
// //   console.log("🚀 ~ setupVectorStore ~ folderName:", folderName)
// //   // 0) OPTION A: see if any rows already exist for this folder  
// // const { count, error } = await supabaseClient
// //   .from("documents")
// //   .select("id", { head: true, count: "exact" })
// //   .eq("folder_name", folderName);

// //   if (error) throw error;
// //     console.log("🚀 ~ setupVectorStore ~ existing:", count)

// //   // if we've never loaded this folder before, go ahead and insert
// //   if (count === 0) {
// //     // 1) split into docs
// //     const splitter = new RecursiveCharacterTextSplitter({
// //       chunkSize: 1000,
// //       chunkOverlap: 200,
// //     });
// //     const docs = await splitter.createDocuments([text]);

// //     // 2) get embeddings
// //     const embeddings = new OpenAIEmbeddings();
// //     const vectors = await embeddings.embedDocuments(
// //       docs.map((d) => d.pageContent)
// //     );

// //     // 3) build rows
// //     const rows = docs.map((doc, i) => ({
// //       content: doc.pageContent,
// //       metadata: doc.metadata,
// //       embedding: vectors[i],
// //       folder_name: folderName,
// //       path: path,
// //       sha: sha
// //     }));

// //     // 4) insert them
// //     await supabaseClient.from("documents").insert(rows);
// //   }

// //   // 5) whether we just inserted or not, return the same VectorStore
// //   return new SupabaseVectorStore(new OpenAIEmbeddings(), {
// //     client: supabaseClient,
// //     tableName: "documents",
// //     queryName: "match_documents",
// //   });
// // }


// async function runRAG(folderName, taskPrompt =
//   "You are a helpful analyst. Provide a concise summary of the following research folder."
// ) {
//   console.log("🚀 ~ folderName:", folderName)
//   const vectorStore = new SupabaseVectorStore(new OpenAIEmbeddings(), {
//     client: supabaseClient,
//     tableName: "documents",
//     queryName: "match_documents"       // still needed for .similaritySearch(), but we won't call it
//   });

//   const { data: rows, error } = await supabaseClient
//     .from("documents")
//     .select("content")
//     .eq("metadata->>subsect", folderName);

//   if (error) throw error;
//   if (!rows.length) return `No docs indexed for folder **${folderName}**.`;

//   // 2️⃣  Concatenate (cap at ~10 000 tokens to stay under GPT-3.5 limit)
//   const rawText = rows.map(r => r.content).join("\n\n---\n");
//   const maxChars = 40_000;                       // ~10k tokens ≈ 40k chars
//   const inputText = rawText.slice(0, maxChars);

//   // 3️⃣  Send to the LLM
//   const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
//   const { content: answer } = await llm.invoke([
//     { role: "system", content: taskPrompt },
//     { role: "user", content: inputText }
//   ]);

//   return answer;
// }

// // Main RAG function
// // async function runRAG(question, text, folderName, path, sha) {
// //   try {
// //     console.log("🚀 ~ runRAG ~ question:", question)

// //   const vectorStore = await setupVectorStore(text, folderName, path, sha);
// //   const retriever = vectorStore.asRetriever({
// //   filter: { folder_name: folderName },
// //   // optionally:
// //   // k: 5,                     // number of docs to pull back
// // });
// //   console.log("🚀 ~ runRAG ~ retriever:", retriever)

// //   const llm = new ChatOpenAI({
// //     modelName: "gpt-3.5-turbo",
// //     temperature: 0,
// //   });

// //   const prompt = ChatPromptTemplate.fromMessages([
// //     ["system", "You are a helpful assistant. Use only the following context to answer questions."],
// //     ["human", "Context:\n{context}\n\nQuestion:\n{input}"],
// //   ]);

// //   const chain = RetrievalQAChain.fromLLM(llm, retriever, {
// //     qaTemplate: prompt,
// //   });

// //   const { text: answer } = await chain.call({ query: question });
// //   console.log("🚀 ~ runRAG ~ answer:", answer)
// //   return answer;


// //   } catch (error) {
// //     console.error(error)
// //   }

// // }

// module.exports = { runRAG, setupVectorStore };
