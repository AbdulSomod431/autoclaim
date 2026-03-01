import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gemini AI Setup
// We initialize inside the route handler to ensure the latest environment variables are used.

// Supabase Configuration
const DEFAULT_URL = 'https://rwlpgrdrqahgovqpprzn.supabase.co';
const DEFAULT_KEY = 'sb_publishable_09KK_ds3brpe-QELRXum8A_Bikt5rEo';

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return url.startsWith('http');
  } catch {
    return false;
  }
};

const envUrl = process.env.VITE_SUPABASE_URL;
const envKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = (envUrl && isValidUrl(envUrl)) ? envUrl : DEFAULT_URL;
const supabaseAnonKey = (envKey && envKey.length > 10) ? envKey : DEFAULT_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/parts-pricing", async (req, res) => {
    const { make, model, year } = req.query;
    if (!make || !model) {
      return res.status(400).json({ error: "Make and Model are required" });
    }

    let query = supabase
      .from('parts')
      .select('*')
      .eq('make', make)
      .eq('model', model);

    if (year) {
      const yearNum = parseInt(year as string);
      query = query.lte('year_start', yearNum).gte('year_end', yearNum);
    }
    
    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  app.get("/api/verify-policy", async (req, res) => {
    const { plate } = req.query;
    if (!plate) {
      return res.status(400).json({ error: "Plate number is required" });
    }

    const normalizedPlate = (plate as string).trim().toUpperCase();
    
    const { data, error } = await supabase
      .from('policies')
      .select('*')
      .ilike('plate_number', normalizedPlate)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      return res.status(500).json({ error: error.message });
    }

    if (data) {
      res.json(data);
    } else {
      res.status(404).json({ error: "Policy not found in NIID" });
    }
  });

  app.post("/api/disburse-payout", async (req, res) => {
    const { amount, plate, ownerName } = req.body;

    if (!amount || !plate) {
      return res.status(400).json({ error: "Amount and Plate number are required" });
    }

    // Simulate a delay for the fintech API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate a successful payout response from a provider like Paystack or Flutterwave
    const transactionId = `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const reference = `REF-${Date.now()}`;

    res.json({
      status: "success",
      message: "Payout disbursed successfully",
      data: {
        transactionId,
        reference,
        amount,
        currency: "NGN",
        recipient: ownerName || "Policy Holder",
        timestamp: new Date().toISOString()
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        watch: {
          ignored: ['**'],
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AutoClaim-NG Engine running on http://localhost:${PORT}`);
  });
}

startServer();
