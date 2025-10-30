use std::collections::HashMap;
use serde_json::Value;

/// Utility functions for rig_agent_v2
pub fn extract_text_from_content(content: &Value) -> String {
    match content {
        Value::String(text) => text.clone(),
        Value::Object(map) => {
            if let Some(text) = map.get("text") {
                text.as_str().unwrap_or("").to_string()
            } else {
                content.to_string()
            }
        }
        _ => content.to_string(),
    }
}

/// Generate a unique ID
pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Current timestamp in RFC3339 format
pub fn current_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Validate JSON schema
pub fn validate_json_schema(value: &Value, schema: &Value) -> Result<(), String> {
    // Basic validation - in real implementation, use jsonschema crate
    if let Some(schema_obj) = schema.as_object() {
        if let Some(required) = schema_obj.get("required").and_then(|r| r.as_array()) {
            if let Some(value_obj) = value.as_object() {
                for req in required {
                    if let Some(field_name) = req.as_str() {
                        if !value_obj.contains_key(field_name) {
                            return Err(format!("Missing required field: {}", field_name));
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

/// Format duration in milliseconds
pub fn format_duration_ms(duration_ms: u64) -> String {
    if duration_ms < 1000 {
        format!("{}ms", duration_ms)
    } else if duration_ms < 60000 {
        format!("{:.1}s", duration_ms as f64 / 1000.0)
    } else if duration_ms < 3600000 {
        format!("{:.1}m", duration_ms as f64 / 60000.0)
    } else {
        format!("{:.1}h", duration_ms as f64 / 3600000.0)
    }
}