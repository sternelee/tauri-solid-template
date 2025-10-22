use super::*;
use serde_json::{json, Value};
use reqwest::Client;
use std::collections::HashMap;

// Enhanced embedding tool with vector operations
pub struct EmbeddingTool {
    client: Client,
    api_key: String,
    base_url: Option<String>,
}

impl EmbeddingTool {
    pub fn new(api_key: String, base_url: Option<String>) -> Self {
        let client = Client::new();
        Self {
            client,
            api_key,
            base_url,
        }
    }

    pub async fn create_embeddings(&self, request: EmbeddingRequest) -> Result<EmbeddingResponse, AgentError> {
        let url = self.base_url
            .clone()
            .unwrap_or_else(|| "https://api.openai.com/v1/embeddings".to_string());

        let payload = json!({
            "model": request.model,
            "input": request.input,
            "encoding_format": request.encoding_format.unwrap_or_else(|| "float".to_string()),
            "dimensions": request.dimensions,
        });

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| AgentError::ApiError(format!("Failed to send embedding request: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await
                .map_err(|e| AgentError::ApiError(format!("Failed to read error response: {}", e)))?;
            return Err(AgentError::ApiError(format!("Embedding creation failed: {}", error_text)));
        }

        let result: EmbeddingResponse = response.json().await
            .map_err(|e| AgentError::ApiError(format!("Failed to parse embedding response: {}", e)))?;

        Ok(result)
    }

    // Calculate cosine similarity between two embeddings
    pub fn cosine_similarity(&self, embedding1: &[f32], embedding2: &[f32]) -> Result<f32, AgentError> {
        if embedding1.len() != embedding2.len() {
            return Err(AgentError::Custom("Embeddings must have the same dimensions".to_string()));
        }

        let dot_product: f32 = embedding1.iter()
            .zip(embedding2.iter())
            .map(|(a, b)| a * b)
            .sum();

        let magnitude1: f32 = embedding1.iter()
            .map(|x| x * x)
            .sum::<f32>()
            .sqrt();

        let magnitude2: f32 = embedding2.iter()
            .map(|x| x * x)
            .sum::<f32>()
            .sqrt();

        if magnitude1 == 0.0 || magnitude2 == 0.0 {
            return Ok(0.0);
        }

        Ok(dot_product / (magnitude1 * magnitude2))
    }

    // Calculate Euclidean distance between two embeddings
    pub fn euclidean_distance(&self, embedding1: &[f32], embedding2: &[f32]) -> Result<f32, AgentError> {
        if embedding1.len() != embedding2.len() {
            return Err(AgentError::Custom("Embeddings must have the same dimensions".to_string()));
        }

        let distance_squared: f32 = embedding1.iter()
            .zip(embedding2.iter())
            .map(|(a, b)| (a - b).powi(2))
            .sum();

        Ok(distance_squared.sqrt())
    }

    // Find most similar embeddings from a list
    pub fn find_most_similar(
        &self,
        query_embedding: &[f32],
        candidate_embeddings: &[Vec<f32>],
        threshold: Option<f32>,
    ) -> Result<Vec<(usize, f32)>, AgentError> {
        let mut similarities = Vec::new();

        for (index, candidate) in candidate_embeddings.iter().enumerate() {
            let similarity = self.cosine_similarity(query_embedding, candidate)?;
            if let Some(min_threshold) = threshold {
                if similarity >= min_threshold {
                    similarities.push((index, similarity));
                }
            } else {
                similarities.push((index, similarity));
            }
        }

        // Sort by similarity (descending)
        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        Ok(similarities)
    }

    // Perform semantic search on text corpus
    pub async fn semantic_search(
        &self,
        query: &str,
        documents: &[String],
        model: &str,
        top_k: Option<usize>,
    ) -> Result<Vec<(usize, f32, String)>, AgentError> {
        // Create embedding for query
        let query_request = EmbeddingRequest {
            input: query.to_string(),
            model: model.to_string(),
            encoding_format: Some("float".to_string()),
            dimensions: None,
        };

        let query_response = self.create_embeddings(query_request).await?;
        let query_embedding = &query_response.data[0].embedding;

        // Create embeddings for all documents
        let mut doc_embeddings = Vec::new();
        for (index, document) in documents.iter().enumerate() {
            let doc_request = EmbeddingRequest {
                input: document.clone(),
                model: model.to_string(),
                encoding_format: Some("float".to_string()),
                dimensions: None,
            };

            match self.create_embeddings(doc_request).await {
                Ok(response) => {
                    if let Some(embedding) = response.data.first() {
                        doc_embeddings.push((index, embedding.embedding.clone()));
                    }
                }
                Err(e) => {
                    eprintln!("Failed to create embedding for document {}: {}", index, e);
                }
            }
        }

        // Find similarities
        let candidate_embeddings: Vec<Vec<f32>> = doc_embeddings.iter()
            .map(|(_, embedding)| embedding.clone())
            .collect();

        let similarities = self.find_most_similar(query_embedding, &candidate_embeddings, None)?;

        // Convert back to document indices and limit results
        let results: Vec<(usize, f32, String)> = similarities
            .into_iter()
            .take(top_k.unwrap_or(5))
            .map(|(doc_index, similarity)| {
                let original_index = doc_embeddings[doc_index].0;
                (original_index, similarity, documents[original_index].clone())
            })
            .collect();

        Ok(results)
    }

    // Cluster documents by similarity
    pub fn cluster_documents(
        &self,
        embeddings: &[Vec<f32>],
        threshold: f32,
    ) -> Result<Vec<Vec<usize>>, AgentError> {
        let mut clusters = Vec::new();
        let mut visited = vec![false; embeddings.len()];

        for (i, embedding) in embeddings.iter().enumerate() {
            if visited[i] {
                continue;
            }

            let mut cluster = vec![i];
            visited[i] = true;

            // Find all similar documents
            for (j, other_embedding) in embeddings.iter().enumerate() {
                if i != j && !visited[j] {
                    let similarity = self.cosine_similarity(embedding, other_embedding)?;
                    if similarity >= threshold {
                        cluster.push(j);
                        visited[j] = true;
                    }
                }
            }

            clusters.push(cluster);
        }

        Ok(clusters)
    }
}

// Vector store for semantic memory
pub struct VectorStore {
    embeddings: HashMap<String, Vec<f32>>,
    metadata: HashMap<String, Value>,
    embedding_tool: EmbeddingTool,
}

impl VectorStore {
    pub fn new(api_key: String, base_url: Option<String>) -> Self {
        Self {
            embeddings: HashMap::new(),
            metadata: HashMap::new(),
            embedding_tool: EmbeddingTool::new(api_key, base_url),
        }
    }

    pub async fn add_document(
        &mut self,
        id: String,
        content: String,
        metadata: Option<Value>,
        model: Option<String>,
    ) -> Result<(), AgentError> {
        let model = model.unwrap_or_else(|| "text-embedding-3-small".to_string());

        let request = EmbeddingRequest {
            input: content.clone(),
            model,
            encoding_format: Some("float".to_string()),
            dimensions: None,
        };

        let response = self.embedding_tool.create_embeddings(request).await?;

        if let Some(embedding_data) = response.data.first() {
            self.embeddings.insert(id.clone(), embedding_data.embedding.clone());
            if let Some(meta) = metadata {
                self.metadata.insert(id, meta);
            } else {
                self.metadata.insert(id, json!({"content": content}));
            }
        }

        Ok(())
    }

    pub async fn search(
        &self,
        query: &str,
        top_k: Option<usize>,
        threshold: Option<f32>,
        model: Option<String>,
    ) -> Result<Vec<(String, f32, Value)>, AgentError> {
        let model = model.unwrap_or_else(|| "text-embedding-3-small".to_string());

        // Create query embedding
        let query_request = EmbeddingRequest {
            input: query.to_string(),
            model,
            encoding_format: Some("float".to_string()),
            dimensions: None,
        };

        let query_response = self.embedding_tool.create_embeddings(query_request).await?;
        let query_embedding = &query_response.data[0].embedding;

        // Find similarities
        let candidate_embeddings: Vec<Vec<f32>> = self.embeddings.values().cloned().collect();
        let similarities = self.embedding_tool.find_most_similar(
            query_embedding,
            &candidate_embeddings,
            threshold,
        )?;

        // Convert results with metadata
        let results: Vec<(String, f32, Value)> = similarities
            .into_iter()
            .take(top_k.unwrap_or(10))
            .map(|(embedding_index, similarity)| {
                let doc_ids: Vec<String> = self.embeddings.keys().cloned().collect();
                let doc_id = &doc_ids[embedding_index];
                let metadata = self.metadata.get(doc_id).cloned().unwrap_or(json!({}));
                (doc_id.clone(), similarity, metadata)
            })
            .collect();

        Ok(results)
    }

    pub fn get_document_count(&self) -> usize {
        self.embeddings.len()
    }

    pub fn clear(&mut self) {
        self.embeddings.clear();
        self.metadata.clear();
    }
}

// Command implementations
#[tauri::command]
#[specta::specta]
pub async fn create_embeddings_command(
    app: tauri::AppHandle,
    request: EmbeddingRequest,
) -> Result<EmbeddingResponse, String> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OpenAI API key not found".to_string())?;

    let tool = EmbeddingTool::new(api_key, None);

    tool.create_embeddings(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn semantic_search_command(
    app: tauri::AppHandle,
    query: String,
    documents: Vec<String>,
    model: Option<String>,
    top_k: Option<usize>,
) -> Result<Vec<(f64, f32, String)>, String> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OpenAI API key not found".to_string())?;

    let tool = EmbeddingTool::new(api_key, None);

    let results = tool.semantic_search(
        &query,
        &documents,
        &model.unwrap_or_else(|| "text-embedding-3-small".to_string()),
        top_k,
    )
    .await
    .map_err(|e| e.to_string())?;

    // Convert usize indices to f64 for frontend compatibility
    Ok(results.into_iter()
        .map(|(index, similarity, content)| (index as f64, similarity, content))
        .collect())
}

#[tauri::command]
#[specta::specta]
pub async fn calculate_similarity_command(
    embedding1: Vec<f32>,
    embedding2: Vec<f32>,
) -> Result<f32, String> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OpenAI API key not found".to_string())?;

    let tool = EmbeddingTool::new(api_key, None);

    tool.cosine_similarity(&embedding1, &embedding2)
        .map_err(|e| e.to_string())
}