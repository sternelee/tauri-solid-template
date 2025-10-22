use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{migrate::MigrateDatabase, query, sqlite::SqlitePoolOptions, Pool, Row, Sqlite};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

// Wrapper for DateTime<Utc> to implement specta::Type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timestamp(DateTime<Utc>);

impl Type for Timestamp {
    fn inline(type_map: &mut specta::TypeMap, generics: specta::Generics<'_>) -> specta::DataType {
        // Delegate to String's Type implementation
        String::inline(type_map, generics)
    }

    fn reference(
        type_map: &mut specta::TypeMap,
        generics: &[specta::DataType],
    ) -> specta::datatype::reference::Reference {
        // Delegate to String's Type implementation
        String::reference(type_map, generics)
    }
}

impl From<DateTime<Utc>> for Timestamp {
    fn from(dt: DateTime<Utc>) -> Self {
        Timestamp(dt)
    }
}

impl From<Timestamp> for DateTime<Utc> {
    fn from(ts: Timestamp) -> Self {
        ts.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
    pub model: String,
    pub provider: String,
    pub message_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String, // "user" or "assistant"
    pub content: String,
    pub created_at: Timestamp,
    pub context: Option<String>, // JSON string for context data
    pub tokens_used: Option<i32>,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MessageContext {
    pub apps: Vec<AppReference>,
    pub files: Vec<FileReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppReference {
    pub name: String,
    pub bundle_id: String,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct FileReference {
    pub path: String,
    pub file_type: String,
    pub content_preview: Option<String>,
}

pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    pub async fn new(app: &AppHandle) -> Result<Self> {
        // Get app data directory
        let app_dir = app
            .path()
            .app_data_dir()
            .expect("Failed to get app data directory");

        // Create directory if it doesn't exist
        std::fs::create_dir_all(&app_dir)?;

        // Database file path
        let db_path = app_dir.join("chat.db");
        let db_url = format!("sqlite:{}", db_path.display());

        // Create database if it doesn't exist
        if !db_path.exists() {
            Sqlite::create_database(&db_url).await?;
        }

        // Connect to database
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect(&db_url)
            .await?;

        // Run migrations
        sqlx::migrate!("./migrations").run(&pool).await?;

        Ok(Database { pool })
    }

    pub async fn create_conversation(
        &self,
        title: Option<String>,
        model: &str,
        provider: &str,
    ) -> Result<String> {
        let id = Uuid::new_v4().to_string();
        let title = title.unwrap_or_else(|| "New Conversation".to_string());
        let now = Utc::now();

        query("INSERT INTO conversations (id, title, created_at, updated_at, model, provider, message_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)")
            .bind(&id)
            .bind(title)
            .bind(now)
            .bind(now)
            .bind(model)
            .bind(provider)
            .execute(&self.pool)
            .await?;

        Ok(id)
    }

    pub async fn get_conversation(&self, conversation_id: &str) -> Result<Option<Conversation>> {
        let row = query(
            r#"
            SELECT id, title, created_at, updated_at, model, provider, message_count
            FROM conversations
            WHERE id = ?
            "#,
        )
        .bind(conversation_id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(Some(Conversation {
                id: row.get("id"),
                title: row.get("title"),
                created_at: Timestamp::from(row.get::<chrono::DateTime<Utc>, _>("created_at")),
                updated_at: Timestamp::from(row.get::<chrono::DateTime<Utc>, _>("updated_at")),
                model: row.get("model"),
                provider: row.get("provider"),
                message_count: row.get::<i64, _>("message_count") as u32,
            })),
            None => Ok(None),
        }
    }

    pub async fn list_conversations(&self, limit: Option<f64>) -> Result<Vec<Conversation>> {
        let limit = limit.unwrap_or(50.0) as i64;

        let rows = query(
            r#"
            SELECT id, title, created_at, updated_at, model, provider, message_count
            FROM conversations
            ORDER BY updated_at DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        let conversations = rows
            .into_iter()
            .map(|row| Conversation {
                id: row.get("id"),
                title: row.get("title"),
                created_at: Timestamp::from(row.get::<chrono::DateTime<Utc>, _>("created_at")),
                updated_at: Timestamp::from(row.get::<chrono::DateTime<Utc>, _>("updated_at")),
                model: row.get("model"),
                provider: row.get("provider"),
                message_count: row.get::<i64, _>("message_count") as u32,
            })
            .collect();

        Ok(conversations)
    }

    pub async fn update_conversation_title(
        &self,
        conversation_id: &str,
        title: &str,
    ) -> Result<()> {
        let now = Utc::now();

        query(
            r#"
            UPDATE conversations
            SET title = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(title)
        .bind(now)
        .bind(conversation_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn delete_conversation(&self, conversation_id: &str) -> Result<()> {
        // Delete messages first (foreign key constraint)
        query("DELETE FROM messages WHERE conversation_id = ?")
            .bind(conversation_id)
            .execute(&self.pool)
            .await?;

        // Delete conversation
        query("DELETE FROM conversations WHERE id = ?")
            .bind(conversation_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn add_message(
        &self,
        conversation_id: &str,
        role: &str,
        content: &str,
        context: Option<MessageContext>,
        tokens_used: Option<i32>,
        model: &str,
    ) -> Result<String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let context_json = context.map(|c| serde_json::to_string(&c)).transpose()?;

        query(
            r#"
            INSERT INTO messages (id, conversation_id, role, content, created_at, context, tokens_used, model)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(conversation_id)
        .bind(role)
        .bind(content)
        .bind(now)
        .bind(&context_json)
        .bind(tokens_used)
        .bind(model)
        .execute(&self.pool)
        .await?;

        // Update conversation's updated_at and message_count
        query(
            r#"
            UPDATE conversations
            SET updated_at = ?, message_count = message_count + 1
            WHERE id = ?
            "#,
        )
        .bind(now)
        .bind(conversation_id)
        .execute(&self.pool)
        .await?;

        Ok(id)
    }

    pub async fn get_messages(&self, conversation_id: &str) -> Result<Vec<Message>> {
        let rows = query(
            r#"
            SELECT id, conversation_id, role, content, created_at, context, tokens_used, model
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            "#,
        )
        .bind(conversation_id)
        .fetch_all(&self.pool)
        .await?;

        let messages = rows
            .into_iter()
            .map(|row| Message {
                id: row.get("id"),
                conversation_id: row.get("conversation_id"),
                role: row.get("role"),
                content: row.get("content"),
                created_at: Timestamp::from(row.get::<chrono::DateTime<Utc>, _>("created_at")),
                context: row.get("context"),
                tokens_used: row.get("tokens_used"),
                model: row.get("model"),
            })
            .collect();

        Ok(messages)
    }

    pub async fn delete_message(&self, message_id: &str) -> Result<()> {
        let message = query("SELECT conversation_id FROM messages WHERE id = ?")
            .bind(message_id)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(message) = message {
            let conversation_id: String = message.get("conversation_id");

            query("DELETE FROM messages WHERE id = ?")
                .bind(message_id)
                .execute(&self.pool)
                .await?;

            // Update conversation's message_count
            query(
                r#"
                UPDATE conversations
                SET message_count = message_count - 1
                WHERE id = ?
                "#,
            )
            .bind(&conversation_id)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    pub async fn search_conversations(&self, search_query: &str) -> Result<Vec<Conversation>> {
        let search_pattern = format!("%{}%", search_query);

        let rows = query(
            r#"
            SELECT c.id, c.title, c.created_at, c.updated_at, c.model, c.provider, c.message_count
            FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.title LIKE ? OR m.content LIKE ?
            GROUP BY c.id
            ORDER BY c.updated_at DESC
            LIMIT 20
            "#,
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .fetch_all(&self.pool)
        .await?;

        let conversations = rows
            .into_iter()
            .map(|row| Conversation {
                id: row.get("id"),
                title: row.get("title"),
                created_at: Timestamp::from(row.get::<chrono::DateTime<Utc>, _>("created_at")),
                updated_at: Timestamp::from(row.get::<chrono::DateTime<Utc>, _>("updated_at")),
                model: row.get("model"),
                provider: row.get("provider"),
                message_count: row.get::<i64, _>("message_count") as u32,
            })
            .collect();

        Ok(conversations)
    }

    // Simple statistics function that returns safe types
    pub async fn get_basic_statistics(&self) -> Result<(u32, u32)> {
        let row = query(
            r#"
            SELECT
                COUNT(DISTINCT c.id) as total_conversations,
                COUNT(m.id) as total_messages
            FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id
            "#,
        )
        .fetch_one(&self.pool)
        .await?;

        let total_conversations: i64 = row
            .get::<Option<i64>, _>("total_conversations")
            .unwrap_or(0);
        let total_messages: i64 = row.get::<Option<i64>, _>("total_messages").unwrap_or(0);

        Ok((total_conversations as u32, total_messages as u32))
    }
}
