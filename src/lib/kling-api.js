/**
 * Kling AI API Utility
 * Documentation: https://klingai.com/api
 */

const KLING_BASE_URL = "https://api.klingai.com/v1";

export class KlingAPI {
  constructor(apiKey) {
    if (!apiKey) throw new Error("KLING_API_KEY is required");
    this.apiKey = apiKey;
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
    };
  }

  /**
   * Universal fetch wrapper for Kling API
   */
  async _request(endpoint, method = "POST", body = null) {
    const url = `${KLING_BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: this.headers,
    };
    if (body) {
      options.body = JSON.stringify(body);
      options.headers = { ...this.headers, "Content-Type": "application/json" };
    }

    const response = await fetch(url, options);
    let data = {};
    try {
      data = await response.json();
    } catch (e) {
      const text = await response.text();
      console.error(`Kling API [${method}] ${url} failed to parse JSON. Status: ${response.status}. Response: ${text.slice(0, 200)}`);
      throw new Error(`Kling API error: ${response.status} (Non-JSON response)`);
    }

    if (!response.ok) {
      console.error(`Kling API [${method}] ${url} Error:`, JSON.stringify(data, null, 2));
      throw new Error(data?.error?.message || data?.message || `Kling API error: ${response.status}`);
    }

    return data.data || data;
  }

  /**
   * Poll for task completion
   */
  async pollTask(taskId, interval = 10000, timeout = 600000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const task = await this._request(`/videos/query?task_id=${taskId}`, "GET");
      
      if (task.task_status === "completed") {
        return task.video_result?.[0]?.url || task.video_url;
      }
      
      if (task.task_status === "failed") {
        throw new Error(task.task_status_msg || "Task failed");
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    throw new Error("Task timed out");
  }

  /**
   * Text to Video
   */
  async text2video(params) {
    const body = {
      model: params.model || "kling-v1-5",
      prompt: params.prompt,
      negative_prompt: params.negative_prompt,
      cfg_scale: params.cfg_scale || 0.5,
      mode: params.mode || "std",
      aspect_ratio: params.aspect_ratio || "16:9",
      duration: params.duration || "5",
    };
    return this._request("/videos/text2video", "POST", body);
  }

  /**
   * Image to Video (Standard & Multi-Image)
   */
  async image2video(params) {
    const body = {
      model: params.model || "kling-v1-5",
      prompt: params.prompt,
      image: params.image, // Base64 or URL
      image_tail: params.image_tail, // Optional
      mode: params.mode || "std",
      aspect_ratio: params.aspect_ratio || "9:16",
      duration: params.duration || "5",
    };
    return this._request("/videos/image2video", "POST", body);
  }

  /**
   * Video Extension (Recursive)
   */
  async extendVideo(videoId, prompt, duration = "5") {
    const body = {
      video_id: videoId,
      prompt: prompt,
      duration: duration,
    };
    return this._request("/videos/video-extend", "POST", body);
  }

  /**
   * AI Multi-Shot (Consistency)
   */
  async multiShot(params) {
    const body = {
      model: params.model || "kling-v1-5",
      prompt: params.prompt,
      images: params.images, // Array of reference images
      mode: params.mode || "pro",
      aspect_ratio: params.aspect_ratio || "9:16",
    };
    return this._request("/videos/ai-multi-shot", "POST", body);
  }

  /**
   * Avatar / Lipsync
   */
  async avatarLipsync(image, audioUrl, prompt = "") {
    const body = {
      image: image,
      audio_url: audioUrl,
      prompt: prompt,
    };
    return this._request("/videos/avatar/image2video", "POST", body);
  }

  /**
   * Omni-Video (Precise Gesture Control)
   */
  async omniVideo(params) {
    const body = {
      model: "kling-v1-5",
      prompt: params.prompt,
      image: params.image,
      gesture_prompts: params.gesture_prompts, // Custom control tokens
      mode: "pro",
    };
    return this._request("/videos/omni-video", "POST", body);
  }

  /**
   * List available avatars (Kling 2.0)
   */
  async listAvatars() {
    return this._request("/avatars", "GET");
  }

  /**
   * List available voices for TTS
   */
  async listVoices() {
    return this._request("/tts/voices", "GET");
  }

  /**
   * Text to Speech
   */
  async text2speech(text, voiceId) {
    const body = {
      text,
      voice_id: voiceId,
    };
    return this._request("/tts/text2speech", "POST", body);
  }

  /**
   * Lip Sync
   */
  async lipsync(image, audio) {
    const body = {
      image,
      audio,
    };
    return this._request("/avatar/lipsync", "POST", body);
  }
}
