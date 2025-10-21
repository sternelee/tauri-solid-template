// ============================================================================
// Raycast AI API Implementation
// ============================================================================
// Based on Raycast API specification for AI interactions
// Integrated with Tauri backend for AI processing

import { EventEmitter } from "events";
import { invoke } from "@tauri-apps/api/core";
import { RaycastTauriBridge } from "./tauri-bridge";

export type Creativity =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "maximum"
  | number;

export enum Model {
  "OpenAI_GPT4.1" = "OpenAI_GPT4.1",
  "OpenAI_GPT4.1-mini" = "OpenAI_GPT4.1-mini",
  "OpenAI_GPT4.1-nano" = "OpenAI_GPT4.1-nano",
  OpenAI_GPT4 = "OpenAI_GPT4",
  "OpenAI_GPT4-turbo" = "OpenAI_GPT4-turbo",
  OpenAI_GPT4o = "OpenAI_GPT4o",
  "OpenAI_GPT4o-mini" = "OpenAI_GPT4o-mini",
  OpenAI_o3 = "OpenAI_o3",
  "OpenAI_o4-mini" = "OpenAI_o4-mini",
  OpenAI_o1 = "OpenAI_o1",
  "OpenAI_o3-mini" = "OpenAI_o3-mini",
  Anthropic_Claude_Haiku = "Anthropic_Claude_Haiku",
  Anthropic_Claude_Sonnet = "Anthropic_Claude_Sonnet",
  "Anthropic_Claude_Sonnet_3.7" = "Anthropic_Claude_Sonnet_3.7",
  Anthropic_Claude_Opus = "Anthropic_Claude_Opus",
  Anthropic_Claude_4_Sonnet = "Anthropic_Claude_4_Sonnet",
  Anthropic_Claude_4_Opus = "Anthropic_Claude_4_Opus",
}

export interface AskOptions {
  creativity?: Creativity;
  model?: string;
  signal?: AbortSignal;
  timeout?: number;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AskResult extends Promise<string> {
  on(event: "data", listener: (chunk: string) => void): this;
  on(event: "end", listener: (fullText: string) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "start", listener: () => void): this;
  off(event: "data", listener: (chunk: string) => void): this;
  off(event: "end", listener: (fullText: string) => void): this;
  off(event: "error", listener: (error: Error) => void): this;
  off(event: "start", listener: () => void): this;
}

class StreamingAskResult extends EventEmitter implements AskResult {
  private fullText = "";
  private promise: Promise<string>;
  private isResolved = false;
  private isAborted = false;
  private abortController: AbortController | null = null;

  constructor(
    private prompt: string,
    private options: Required<AskOptions>,
    private useTauriBackend: boolean = true,
  ) {
    super();

    this.abortController = new AbortController();

    this.promise = new Promise<string>((resolve, reject) => {
      const handleChunk = (chunk: string) => {
        if (this.isAborted) return;
        this.fullText += chunk;
        this.emit("data", chunk);
      };

      const handleStart = () => {
        if (this.isAborted) return;
        this.emit("start");
      };

      const handleEnd = () => {
        if (this.isAborted) return;
        if (!this.isResolved) {
          this.isResolved = true;
          this.emit("end", this.fullText);
          resolve(this.fullText);
        }
      };

      const handleError = (error: Error) => {
        if (!this.isResolved) {
          this.isResolved = true;
          this.emit("error", error);
          reject(error);
        }
      };

      this.on("start", handleStart);
      this.on("data", handleChunk);
      this.on("end", handleEnd);
      this.on("error", handleError);

      // Start the AI request
      this.startRequest();
    });
  }

  private async startRequest(): Promise<void> {
    try {
      this.emit("start");

      if (this.useTauriBackend) {
        // Use Tauri backend for AI processing
        await this.executeTauriRequest();
      } else {
        // Fallback to simulation
        await this.executeSimulation();
      }
    } catch (error) {
      if (!this.isResolved) {
        this.emit("error", error as Error);
      }
    }
  }

  private async executeTauriRequest(): Promise<void> {
    try {
      // Map creativity to temperature
      const temperature = this.mapCreativityToTemperature(
        this.options.creativity,
      );

      const request = {
        prompt: this.prompt,
        model: this.options.model,
        temperature,
        maxTokens: this.options.maxTokens,
        systemPrompt: this.options.systemPrompt,
        stream: true,
      };

      // Use the Tauri bridge for streaming
      await RaycastTauriBridge.AI.askStream(
        request,
        (chunk: string) => this.emit("data", chunk),
        (fullText: string) => this.emit("end", fullText),
        (error: Error) => this.emit("error", error),
      );
    } catch (error) {
      console.error("Tauri AI request failed:", error);
      // Fallback to simulation
      await this.executeSimulation();
    }
  }

  private async executeSimulation(): Promise<void> {
    // Simulate streaming response for development/fallback
    const responses = [
      "I understand you're asking about: ",
      this.prompt.substring(0, 50) + (this.prompt.length > 50 ? "..." : ""),
      ". Let me help you with that. ",
      "This is a simulated response since no AI backend is configured. ",
      "To use real AI, please configure an AI provider in the Tauri backend.",
    ];

    for (let i = 0; i < responses.length; i++) {
      if (this.isAborted) break;

      await new Promise((resolve) =>
        setTimeout(resolve, 200 + Math.random() * 300),
      );
      this.emit("data", responses[i]);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!this.isAborted) {
      this.emit("end", this.fullText);
    }
  }

  private mapCreativityToTemperature(creativity: Creativity): number {
    const tempMap: Record<Creativity, number> = {
      none: 0.1,
      low: 0.3,
      medium: 0.7,
      high: 1.0,
      maximum: 1.2,
    };

    if (typeof creativity === "number") {
      return Math.max(0.1, Math.min(2.0, creativity / 100));
    }

    return tempMap[creativity] || 0.7;
  }

  abort(): void {
    if (this.isResolved || this.isAborted) return;

    this.isAborted = true;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.emit("error", new Error("Request aborted"));
  }

  then<TResult1 = string, TResult2 = never>(
    onfulfilled?: ((value: string) => TResult1 | Promise<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | Promise<TResult>) | null,
  ): Promise<string | TResult> {
    return this.promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<string> {
    return this.promise.finally(onfinally);
  }

  [Symbol.toStringTag] = "StreamingAskResult";
}

export const AI = {
  async ask(prompt: string, options: AskOptions = {}): Promise<AskResult> {
    const defaultOptions: Required<AskOptions> = {
      creativity: "medium",
      model: "OpenAI_GPT4o",
      signal: null as any,
      timeout: 30000,
      systemPrompt: "",
      temperature: 0.7,
      maxTokens: 2000,
    };

    const mergedOptions = { ...defaultOptions, ...options };

    // Handle abort signal
    if (options.signal) {
      const result = new StreamingAskResult(prompt, mergedOptions, true);

      options.signal.addEventListener("abort", () => {
        result.abort();
      });

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          result.abort();
        }, options.timeout);
      }

      return result;
    }

    return new StreamingAskResult(prompt, mergedOptions, true);
  },

  // Direct non-streaming API
  async askDirect(prompt: string, options: AskOptions = {}): Promise<string> {
    try {
      const temperature =
        typeof options.creativity === "number"
          ? Math.max(0.1, Math.min(2.0, options.creativity / 100))
          : {
              none: 0.1,
              low: 0.3,
              medium: 0.7,
              high: 1.0,
              maximum: 1.2,
            }[options.creativity || "medium"] || 0.7;

      const response = await RaycastTauriBridge.AI.ask({
        prompt,
        model: options.model || "OpenAI_GPT4o",
        creativity: temperature,
        stream: false,
      });

      return response.content;
    } catch (error) {
      console.error("Direct AI request failed:", error);
      // Fallback response
      return `I apologize, but I'm unable to process your request right now. The AI service may not be configured. Please check your AI provider settings in the application configuration.`;
    }
  },

  // Check if AI is available
  async isAvailable(): Promise<boolean> {
    try {
      await RaycastTauriBridge.AI.ask({
        prompt: "test",
        model: "OpenAI_GPT4o-mini",
        creativity: 0.1,
        stream: false,
      });
      return true;
    } catch {
      return false;
    }
  },

  // Get available models
  async getAvailableModels(): Promise<string[]> {
    try {
      return await invoke<string[]>("get_available_ai_models");
    } catch {
      // Return default models if backend not available
      return Object.values(Model);
    }
  },

  Model,
  Creativity: {
    none: "none" as const,
    low: "low" as const,
    medium: "medium" as const,
    high: "high" as const,
    maximum: "maximum" as const,
  },
};
