use super::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicU32, Ordering},
    Arc, Mutex, Once,
};
use tauri::{Emitter, Runtime};
use tokio::sync::Notify;

// Global registry for active ReAct agent streams
static REACT_AGENT_CANCEL_REGISTRY: Once = Once::new();
static mut REACT_AGENT_CANCELS: Option<Arc<Mutex<HashMap<String, Arc<Notify>>>>> = None;

fn get_react_agent_cancel_registry() -> &'static Arc<Mutex<HashMap<String, Arc<Notify>>>> {
    unsafe {
        REACT_AGENT_CANCEL_REGISTRY.call_once(|| {
            REACT_AGENT_CANCELS = Some(Arc::new(Mutex::new(HashMap::new())));
        });
        REACT_AGENT_CANCELS.as_ref().unwrap()
    }
}

// Global request counter
static REQUEST_COUNTER: AtomicU32 = AtomicU32::new(0);

/// ReAct-specific request structure
#[derive(Debug, Deserialize)]
pub struct ReactAgentRequest {
    pub prompt: String,
    pub provider: String,
    pub model: String,
    pub chat_history: Option<Vec<ChatMessage>>,
    pub tools: Option<Vec<ToolDefinition>>,
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    pub max_iterations: Option<usize>,
    pub stream_tool_events: Option<bool>,
    pub enable_reasoning: Option<bool>,
    pub react_preamble: Option<String>,
}

/// ReAct agent streaming chat with multi-turn tool calling and reasoning
/// This implements the ReAct (Reasoning and Acting) pattern
#[tauri::command]
pub async fn react_agent_stream_chat<R: Runtime>(
    app_handle: tauri::AppHandle<R>,
    request: ReactAgentRequest,
) -> Result<String, String> {
    let request_id = REQUEST_COUNTER.fetch_add(1, Ordering::SeqCst);
    let event_name = "react-agent-stream";

    // Create a simple ReAct agent response
    let response = format!(
        "ReAct agent response for prompt: '{}'\n\
        This is a placeholder implementation. The actual ReAct functionality \
        would require integration with the rig-agent framework.\n\
        Provider: {}, Model: {}",
        request.prompt, request.provider, request.model
    );

    // Send initial event
    let _ = app_handle.emit(
        event_name,
        serde_json::json!({
            "request_id": request_id,
            "stream_id": "react-stream-id",
            "event_type": "start",
            "is_final": false,
            "content": "",
        }),
    );

    // Send response event
    let _ = app_handle.emit(
        event_name,
        serde_json::json!({
            "request_id": request_id,
            "stream_id": "react-stream-id",
            "event_type": "text",
            "is_final": false,
            "content": response,
        }),
    );

    // Send complete event
    let _ = app_handle.emit(
        event_name,
        serde_json::json!({
            "request_id": request_id,
            "stream_id": "react-stream-id",
            "event_type": "complete",
            "is_final": true,
            "content": "",
        }),
    );

    Ok("react-stream-id".to_string())
}

/// Cancel an ongoing ReAct agent stream by stream ID
#[tauri::command]
pub async fn cancel_react_agent_stream<R: Runtime>(
    _app_handle: tauri::AppHandle<R>,
    stream_id: String,
) -> Result<(), String> {
    println!(
        "Cancel ReAct agent stream request received for stream_id: {}",
        stream_id
    );

    let registry = get_react_agent_cancel_registry();
    let mut registry = registry.lock().unwrap();

    if let Some(cancel_signal) = registry.get(&stream_id) {
        // Notify the cancel signal
        cancel_signal.notify_one();
        println!(
            "Successfully notified cancellation for ReAct stream: {}",
            stream_id
        );
        // Remove from registry
        registry.remove(&stream_id);
        Ok(())
    } else {
        let msg = format!("ReAct agent stream {} not found or already completed", stream_id);
        println!("{}", msg);
        Err(msg)
    }
}

/// ReAct agent non-streaming chat with multi-turn tool calling and reasoning
#[tauri::command]
pub async fn react_agent_chat<R: Runtime>(
    _app_handle: tauri::AppHandle<R>,
    request: ReactAgentRequest,
) -> Result<serde_json::Value, String> {
    let response = format!(
        "ReAct agent response for prompt: '{}'\n\
        This is a placeholder implementation. The actual ReAct functionality \
        would require integration with the rig-agent framework.\n\
        Provider: {}, Model: {}",
        request.prompt, request.provider, request.model
    );

    Ok(serde_json::json!({
        "content": response,
        "status": "completed"
    }))
}

/// Get available ReAct agent tools
#[tauri::command]
pub async fn get_react_agent_tools<R: Runtime>(
    _app_handle: tauri::AppHandle<R>,
) -> Result<serde_json::Value, String> {
    let tools = vec![
        serde_json::json!({
            "name": "add",
            "description": "Add two numbers together",
            "type": "builtin"
        }),
        serde_json::json!({
            "name": "multiply",
            "description": "Multiply two numbers",
            "type": "builtin"
        }),
    ];

    Ok(serde_json::json!({
        "tools": tools,
        "count": tools.len(),
        "message": "This is a placeholder implementation. The actual tool listing would require integration with the rig-agent framework."
    }))
}

/// Execute a ReAct agent tool directly
#[tauri::command]
pub async fn execute_react_agent_tool(
    _app_handle: tauri::AppHandle,
    tool_name: String,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let result = format!(
        "Executed tool '{}' with parameters: {}\n\
        This is a placeholder implementation. The actual tool execution would require integration with the rig-agent framework.",
        tool_name,
        params
    );

    Ok(serde_json::json!({
        "result": result,
        "status": "completed"
    }))
}