import { GoogleGenAI, Type } from "@google/genai";
import { DamageAnalysis } from "../types";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
  console.warn("GEMINI_API_KEY is missing or set to a placeholder. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function analyzeAccidentImage(base64Image: string): Promise<DamageAnalysis> {
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("Gemini API key is missing. Please set GEMINI_API_KEY in your Vercel Environment Variables.");
  }

  // Use gemini-flash-latest for multimodal vision tasks
  const model = "gemini-flash-latest";
  
  console.log("Analyzing image with model:", model);
  
  const systemInstruction = `
    You are an expert Nigerian Motor Insurance Adjuster AI.
    Your task is to analyze photos of vehicle accidents in Nigeria.
    
    STEP 1: IMAGE ANALYSIS
    - Identify the vehicle type (Make, Model, Year) and the specific area of impact.
    - Determine if the damage is "Structural" (chassis/engine) or "Cosmetic" (bumpers/fenders).
    
    STEP 2: DAMAGE ASSESSMENT
    - List specific damaged parts (e.g., "Front Nearside Headlight", "Bumper Clip").
    - Categorize severity: Minor, Moderate, Structural, or Totaled.
    
    STEP 3: FRAUD DETECTION
    - Check if the damage is "consistent" (e.g., if the bumper is smashed, is the headlight also cracked as expected?).
    
    OUTPUT FORMAT:
    You must return a JSON object matching the requested schema.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: "Analyze this vehicle accident image for an insurance claim." },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vehicle_info: {
            type: Type.OBJECT,
            properties: {
              make: { type: Type.STRING },
              model: { type: Type.STRING },
              year: { type: Type.STRING },
              plate: { type: Type.STRING, description: "License plate if visible" },
            },
            required: ["make", "model"],
          },
          damage_summary: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          severity: { 
            type: Type.STRING, 
            enum: ["Minor", "Moderate", "Structural", "Totaled"] 
          },
          confidence_score: { type: Type.NUMBER },
          is_consistent: { type: Type.BOOLEAN },
        },
        required: ["vehicle_info", "damage_summary", "severity", "confidence_score", "is_consistent"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Failed to get analysis from Gemini");
  
  return JSON.parse(text) as DamageAnalysis;
}
