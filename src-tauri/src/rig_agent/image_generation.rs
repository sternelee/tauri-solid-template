use super::*;
use base64::{engine::general_purpose, Engine as _};
use reqwest::Client;
use serde_json::{json, Value};

// Image generation request structures
#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct ImageGenerationRequest {
    pub prompt: String,
    pub model: Option<String>,
    pub n: Option<u32>,                  // Number of images to generate
    pub size: Option<String>,            // e.g., "1024x1024"
    pub quality: Option<String>,         // "standard" or "hd"
    pub style: Option<String>,           // "vivid" or "natural"
    pub response_format: Option<String>, // "url" or "b64_json"
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct ImageGenerationResponse {
    pub created: f64,
    pub data: Vec<ImageData>,
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct ImageData {
    pub url: Option<String>,
    pub b64_json: Option<String>,
    pub revised_prompt: Option<String>,
}

// Image variation request (for DALL-E 2)
#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct ImageVariationRequest {
    pub image: String, // Base64 encoded image
    pub model: Option<String>,
    pub n: Option<u32>,
    pub size: Option<String>,
    pub response_format: Option<String>,
}

// Image edit request
#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct ImageEditRequest {
    pub image: String,        // Base64 encoded original image
    pub mask: Option<String>, // Base64 encoded mask
    pub prompt: String,
    pub model: Option<String>,
    pub n: Option<u32>,
    pub size: Option<String>,
    pub response_format: Option<String>,
}

// Image generation tool
pub struct ImageGenerationTool {
    client: Client,
    api_key: String,
    base_url: Option<String>,
}

impl ImageGenerationTool {
    pub fn new(api_key: String, base_url: Option<String>) -> Self {
        let client = Client::new();
        Self {
            client,
            api_key,
            base_url,
        }
    }

    pub async fn generate_image(
        &self,
        request: ImageGenerationRequest,
    ) -> Result<ImageGenerationResponse, AgentError> {
        let url = self
            .base_url
            .clone()
            .unwrap_or_else(|| "https://api.openai.com/v1/images/generations".to_string());

        let payload = json!({
            "model": request.model.unwrap_or_else(|| "dall-e-3".to_string()),
            "prompt": request.prompt,
            "n": request.n.unwrap_or(1),
            "size": request.size.unwrap_or_else(|| "1024x1024".to_string()),
            "quality": request.quality.unwrap_or_else(|| "standard".to_string()),
            "style": request.style.unwrap_or_else(|| "vivid".to_string()),
            "response_format": request.response_format.unwrap_or_else(|| "b64_json".to_string()),
        });

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| AgentError::ApiError(format!("Failed to send request: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.map_err(|e| {
                AgentError::ApiError(format!("Failed to read error response: {}", e))
            })?;
            return Err(AgentError::ApiError(format!(
                "Image generation failed: {}",
                error_text
            )));
        }

        let result: ImageGenerationResponse = response
            .json()
            .await
            .map_err(|e| AgentError::ApiError(format!("Failed to parse response: {}", e)))?;

        Ok(result)
    }

    pub async fn create_image_variation(
        &self,
        request: ImageVariationRequest,
    ) -> Result<ImageGenerationResponse, AgentError> {
        let url = self
            .base_url
            .clone()
            .unwrap_or_else(|| "https://api.openai.com/v1/images/variations".to_string());

        let mut form = reqwest::multipart::Form::new();

        // Decode base64 image to bytes
        let image_data = general_purpose::STANDARD
            .decode(&request.image)
            .map_err(|e| AgentError::Custom(format!("Failed to decode base64 image: {}", e)))?;

        form = form.part(
            "image",
            reqwest::multipart::Part::bytes(image_data)
                .file_name("image.png")
                .mime_str("image/png")
                .map_err(|e| AgentError::Custom(format!("Failed to create multipart: {}", e)))?,
        );

        if let Some(model) = &request.model {
            form = form.text("model", model.clone());
        }

        if let Some(n) = request.n {
            form = form.text("n", n.to_string());
        }

        if let Some(size) = &request.size {
            form = form.text("size", size.clone());
        }

        if let Some(response_format) = &request.response_format {
            form = form.text("response_format", response_format.clone());
        }

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| {
                AgentError::ApiError(format!("Failed to send variation request: {}", e))
            })?;

        if !response.status().is_success() {
            let error_text = response.text().await.map_err(|e| {
                AgentError::ApiError(format!("Failed to read error response: {}", e))
            })?;
            return Err(AgentError::ApiError(format!(
                "Image variation failed: {}",
                error_text
            )));
        }

        let result: ImageGenerationResponse = response.json().await.map_err(|e| {
            AgentError::ApiError(format!("Failed to parse variation response: {}", e))
        })?;

        Ok(result)
    }

    pub async fn edit_image(
        &self,
        request: ImageEditRequest,
    ) -> Result<ImageGenerationResponse, AgentError> {
        let url = self
            .base_url
            .clone()
            .unwrap_or_else(|| "https://api.openai.com/v1/images/edits".to_string());

        let mut form = reqwest::multipart::Form::new();

        // Decode base64 image to bytes
        let image_data = general_purpose::STANDARD
            .decode(&request.image)
            .map_err(|e| AgentError::Custom(format!("Failed to decode base64 image: {}", e)))?;

        form = form.part(
            "image",
            reqwest::multipart::Part::bytes(image_data)
                .file_name("image.png")
                .mime_str("image/png")
                .map_err(|e| AgentError::Custom(format!("Failed to create multipart: {}", e)))?,
        );

        // Add mask if provided
        if let Some(mask_data) = &request.mask {
            let mask_bytes = general_purpose::STANDARD
                .decode(mask_data)
                .map_err(|e| AgentError::Custom(format!("Failed to decode base64 mask: {}", e)))?;

            form = form.part(
                "mask",
                reqwest::multipart::Part::bytes(mask_bytes)
                    .file_name("mask.png")
                    .mime_str("image/png")
                    .map_err(|e| {
                        AgentError::Custom(format!("Failed to create mask multipart: {}", e))
                    })?,
            );
        }

        form = form.text("prompt", request.prompt);

        if let Some(model) = &request.model {
            form = form.text("model", model.clone());
        }

        if let Some(n) = request.n {
            form = form.text("n", n.to_string());
        }

        if let Some(size) = &request.size {
            form = form.text("size", size.clone());
        }

        if let Some(response_format) = &request.response_format {
            form = form.text("response_format", response_format.clone());
        }

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| AgentError::ApiError(format!("Failed to send edit request: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.map_err(|e| {
                AgentError::ApiError(format!("Failed to read error response: {}", e))
            })?;
            return Err(AgentError::ApiError(format!(
                "Image edit failed: {}",
                error_text
            )));
        }

        let result: ImageGenerationResponse = response
            .json()
            .await
            .map_err(|e| AgentError::ApiError(format!("Failed to parse edit response: {}", e)))?;

        Ok(result)
    }

    // Save image to local file system
    pub async fn save_image(
        &self,
        image_data: &str,
        file_path: &str,
    ) -> Result<String, AgentError> {
        let image_bytes = if image_data.starts_with("data:image/") {
            // Remove data URL prefix
            let comma_index = image_data
                .find(',')
                .ok_or_else(|| AgentError::Custom("Invalid data URL format".to_string()))?;
            general_purpose::STANDARD
                .decode(&image_data[comma_index + 1..])
                .map_err(|e| AgentError::Custom(format!("Failed to decode data URL: {}", e)))?
        } else {
            // Assume it's pure base64
            general_purpose::STANDARD
                .decode(image_data)
                .map_err(|e| AgentError::Custom(format!("Failed to decode base64: {}", e)))?
        };

        tokio::fs::write(file_path, image_bytes)
            .await
            .map_err(|e| AgentError::Custom(format!("Failed to save image: {}", e)))?;

        Ok(file_path.to_string())
    }
}

// Image generation command implementations
#[tauri::command]
#[specta::specta]
pub async fn generate_image_command(
    app: tauri::AppHandle,
    request: ImageGenerationRequest,
    save_to_file: Option<String>,
) -> Result<ImageGenerationResponse, String> {
    // Get API key from state or environment
    let api_key =
        std::env::var("OPENAI_API_KEY").map_err(|_| "OpenAI API key not found".to_string())?;

    let generator = ImageGenerationTool::new(api_key, None);

    let response = generator
        .generate_image(request)
        .await
        .map_err(|e| e.to_string())?;

    // Save to file if requested
    if let Some(file_path) = save_to_file {
        if let Some(first_image) = response.data.first() {
            if let Some(b64_data) = &first_image.b64_json {
                let full_path = format!("data:image/png;base64,{}", b64_data);
                if let Err(e) = generator.save_image(&full_path, &file_path).await {
                    return Err(format!("Failed to save image: {}", e));
                }
            }
        }
    }

    Ok(response)
}

#[tauri::command]
#[specta::specta]
pub async fn create_image_variation_command(
    app: tauri::AppHandle,
    request: ImageVariationRequest,
) -> Result<ImageGenerationResponse, String> {
    let api_key =
        std::env::var("OPENAI_API_KEY").map_err(|_| "OpenAI API key not found".to_string())?;

    let generator = ImageGenerationTool::new(api_key, None);

    generator
        .create_image_variation(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn edit_image_command(
    app: tauri::AppHandle,
    request: ImageEditRequest,
) -> Result<ImageGenerationResponse, String> {
    let api_key =
        std::env::var("OPENAI_API_KEY").map_err(|_| "OpenAI API key not found".to_string())?;

    let generator = ImageGenerationTool::new(api_key, None);

    generator
        .edit_image(request)
        .await
        .map_err(|e| e.to_string())
}
