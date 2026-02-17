import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3301;

// Initialize Supabase client for database operations
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  console.log('✅ Supabase initialized for server-side operations');
} else {
  console.warn('⚠️ Supabase keys missing - device tracking will be disabled');
}

// Load multiple API keys for load balancing and fallback
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3
].filter(Boolean); // Remove undefined keys

// ========== SPAM DETECTION & USAGE TRACKING FUNCTIONS ==========

/**
 * Check if a device fingerprint is blocked (too many accounts)
 */
async function checkDeviceSpam(deviceFingerprint) {
  if (!supabase) {
    console.warn('⚠️ Supabase not initialized - cannot check device spam. Add SUPABASE_SERVICE_ROLE_KEY to server/.env');
    return { isBlocked: false, reason: null };
  }
  
  try {
    const { data, error } = await supabase
      .from('device_fingerprints')
      .select('*')
      .eq('device_fingerprint', deviceFingerprint)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking device:', error.message);
      return { isBlocked: false, reason: null };
    }

    if (data) {
      console.log(`🔍 Device check: ${data.account_count} account(s) found, blocked=${data.is_blocked}`);
    }

    if (data && data.is_blocked) {
      console.warn(`❌ BLOCKING signup - Device marked as blocked: ${data.blocked_reason}`);
      return { isBlocked: true, reason: data.blocked_reason || 'Device blocked due to too many accounts' };
    }

    // Check if device has 3 or more accounts (block at 3)
    if (data && data.account_count >= 3) {
      console.warn(`❌ BLOCKING signup - Device has ${data.account_count} accounts (limit: 3 max)`);
      return { isBlocked: true, reason: `Maximum account limit reached from this device (${data.account_count}/3)` };
    }

    if (data) {
      console.log(`✅ Device OK - allowing signup (${data.account_count}/3 accounts)`);
    }

    return { isBlocked: false, reason: null };
  } catch (e) {
    console.error('Device spam check error:', e.message);
    return { isBlocked: false, reason: null };
  }
}

/**
 * Register a new device for a user
 */
async function registerDevice(deviceFingerprint, userId) {
  if (!supabase) {
    console.warn('⚠️ Cannot register device - Supabase not initialized');
    return;
  }

  try {
    // Check if this fingerprint already exists
    const { data: existing, error: fetchError } = await supabase
      .from('device_fingerprints')
      .select('*')
      .eq('device_fingerprint', deviceFingerprint)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing device:', fetchError.message);
      return;
    }

    if (existing) {
      // Device already registered
      if (existing.user_id === userId) {
        console.log(`✅ Device already registered for this user`);
        return;
      }
      
      // Different user on same device - increment count
      const newCount = existing.account_count + 1;
      console.warn(`⚠️ MULTI-ACCOUNT ALERT: New user on device with ${newCount} total accounts`);
      
      const { error: updateError } = await supabase
        .from('device_fingerprints')
        .update({
          account_count: newCount,
          updated_at: new Date().toISOString(),
          is_blocked: newCount >= 3  // Auto-block at 3+ accounts
        })
        .eq('device_fingerprint', deviceFingerprint);

      if (updateError) {
        console.error('Error updating device fingerprint:', updateError.message);
        return;
      }

      // Log suspicious activity
      const { error: logError } = await supabase
        .from('spam_logs')
        .insert({
          device_fingerprint: deviceFingerprint,
          action: 'new_account_same_device',
          details: { 
            newUser: userId, 
            previousUser: existing.user_id, 
            previousCount: existing.account_count,
            totalAccounts: newCount
          }
        });

      if (logError) console.error('Error logging spam activity:', logError.message);
      
      if (newCount >= 3) {
        console.warn(`❌ AUTO-BLOCKED: Device exceeded 3 account limit (${newCount} found)`);
      }
    } else {
      // New device - create entry
      const { error: insertError } = await supabase
        .from('device_fingerprints')
        .insert({
          device_fingerprint: deviceFingerprint,
          user_id: userId,
          account_count: 1
        });

      if (insertError) {
        console.error('Error inserting device fingerprint:', insertError.message);
        return;
      }

      console.log('✅ New device registered (1/3 accounts)');
    }
  } catch (e) {
    console.error('Device registration error:', e.message);
  }
}

/**
 * Get user's daily usage count for today
 */
async function getUserDailyUsage(userId) {
  if (!supabase) return 0;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('user_daily_usage')
      .select('usage_count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting daily usage:', error.message);
      return 0;
    }

    return data?.usage_count || 0;
  } catch (e) {
    console.error('Daily usage check error:', e.message);
    return 0;
  }
}

/**
 * Increment user's daily usage count
 */
async function incrementUserUsage(userId) {
  if (!supabase) return 1;

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Try to increment existing record
    const { data: updated, error: updateError } = await supabase
      .from('user_daily_usage')
      .update({
        usage_count: supabase.rpc('increment', { row_id: { eq: { user_id: userId, usage_date: today } }, col: 'usage_count' })
      })
      .eq('user_id', userId)
      .eq('usage_date', today)
      .select('usage_count')
      .single();

    // If no record exists, create one
    if (updateError?.code === 'PGRST116') {
      const { data: inserted } = await supabase
        .from('user_daily_usage')
        .insert({
          user_id: userId,
          usage_count: 1,
          usage_date: today
        })
        .select('usage_count')
        .single();

      return inserted?.usage_count || 1;
    }

    return updated?.usage_count || 1;
  } catch (e) {
    console.error('Usage increment error:', e.message);
    return 1;
  }
}

// ========== API ENDPOINTS FOR SPAM DETECTION & USAGE ==========

/**
 * Health check endpoint to diagnose configuration
 */
app.get('/api/status', async (req, res) => {
  try {
    const status = {
      server: 'online',
      timestamp: new Date().toISOString(),
      configuration: {
        supabaseInitialized: !!supabase,
        geminiKeysConfigured: GEMINI_API_KEYS.length,
      },
      features: {
        deviceSpamDetection: !!supabase,
        dailyUsageTracking: !!supabase,
      }
    };

    // Test Supabase connection if initialized
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('device_fingerprints')
          .select('count', { count: 'exact' })
          .limit(1);

        status.database = {
          connected: !error,
          deviceFingerprintsTable: !error,
          devicesRegistered: error ? 'unknown' : 'connected'
        };
      } catch (e) {
        status.database = {
          connected: false,
          error: e.message
        };
      }
    } else {
      status.database = {
        connected: false,
        reason: 'Supabase service role key not configured in server/.env'
      };
    }

    res.json(status);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * Check if device is blocked before signup
 */
app.post('/api/check-spam', async (req, res) => {
  try {
    const { deviceFingerprint } = req.body;

    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Device fingerprint required' });
    }

    const result = await checkDeviceSpam(deviceFingerprint);
    
    return res.json(result);
  } catch (error) {
    console.error('Spam check error:', error);
    return res.status(500).json({ error: 'Spam check failed' });
  }
});

/**
 * Register device after successful signup
 */
app.post('/api/register-device', async (req, res) => {
  try {
    const { deviceFingerprint, userId } = req.body;

    if (!deviceFingerprint || !userId) {
      return res.status(400).json({ error: 'Device fingerprint and user ID required' });
    }

    await registerDevice(deviceFingerprint, userId);
    
    return res.json({ success: true, message: 'Device registered' });
  } catch (error) {
    console.error('Device registration endpoint error:', error);
    return res.status(500).json({ error: 'Device registration failed' });
  }
});

/**
 * Get user's current daily usage
 */
app.post('/api/get-daily-usage', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const usageCount = await getUserDailyUsage(userId);
    
    return res.json({ usageCount, limitReached: usageCount >= 3 });
  } catch (error) {
    console.error('Daily usage check error:', error);
    return res.status(500).json({ error: 'Failed to check daily usage' });
  }
});

/**
 * Increment user's daily usage after blueprint generation
 */
app.post('/api/increment-usage', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const newCount = await incrementUserUsage(userId);
    
    return res.json({ usageCount: newCount, limitReached: newCount >= 3 });
  } catch (error) {
    console.error('Usage increment error:', error);
    return res.status(500).json({ error: 'Failed to increment usage' });
  }
});

// Optional automatic migration: if a DATABASE_URL is provided, attempt to add
// the `blueprint` JSONB column to the `public.blueprints` table if it doesn't exist.
async function runAutoMigrationIfNeeded() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const check = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'blueprints' AND column_name = 'blueprint' LIMIT 1`
    );
    if (check.rowCount === 0) {
      console.log('🔧 blueprint column missing — creating it now');
      await client.query(`ALTER TABLE public.blueprints ADD COLUMN IF NOT EXISTS blueprint JSONB;`);
      console.log('✅ blueprint column created');
    } else {
      console.log('ℹ️ blueprint column already exists');
    }
  } catch (err) {
    console.error('Migration error (auto-migrate):', err.message || err);
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

// Start migration attempt in background (non-blocking)
runAutoMigrationIfNeeded().catch((e) => console.error('Auto-migration failed:', e));

if (!GEMINI_API_KEYS.length) {
  console.warn("⚠️ GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3 are missing in server/.env — using local fallback generator for development.");
}

// Local fallback generator used when Gemini is unavailable
function generateLocalBlueprint(goal, mode) {
  const title = `Strategic Blueprint: ${goal}`;
  const vision = `"A focused vision to achieve ${goal} with measurable milestones."`;
  
  let pillars = [];
  let phases = [];
  let market = [];
  
  // MODE-SPECIFIC CONTENT
  switch (mode) {
    case "Detailed":
      pillars = [
        "Comprehensive Analysis & Planning",
        "Deep Technical Implementation",
        "Rigorous Quality Assurance"
      ];
      phases = [
        { title: "Phase 1: Detailed Discovery", timeline: "0-2 months", description: 'Conduct comprehensive market research, stakeholder interviews, and technical analysis for ' + goal + '.', status: "pending" },
        { title: "Phase 2: Detailed Build", timeline: "2-6 months", description: 'Execute with granular milestones, extensive documentation, and iterative refinement for ' + goal + '.', status: "pending" },
        { title: "Phase 3: Optimization & Scale", timeline: "6-18 months", description: 'Deep optimization cycles, advanced analytics, and strategic expansion for ' + goal + '.', status: "pending" }
      ];
      market = [{ title: "Market Analysis", description: `Detailed market intelligence and deep opportunity analysis for ${goal}.`, sourceUrl: "" }];
      break;
      
    case "Rapid":
      pillars = [
        "Quick Wins & Early Revenue",
        "Lean Execution Discipline",
        "Fast Market Testing"
      ];
      phases = [
        { title: "Phase 1: MVP Sprint", timeline: "0-2 weeks", description: 'Ship minimum viable product immediately for ' + goal + '.', status: "pending" },
        { title: "Phase 2: Fast Scaling", timeline: "2-8 weeks", description: 'Scale rapidly based on early user feedback for ' + goal + '.', status: "pending" },
        { title: "Phase 3: Dominate", timeline: "2-3 months", description: 'Capture market share aggressively for ' + goal + '.', status: "pending" }
      ];
      market = [{ title: "Market Opportunity", description: `First-mover advantage in ${goal} market segment.`, sourceUrl: "" }];
      break;
      
    case "Market Intel":
      pillars = [
        "Competitor Benchmarking",
        "Market Trend Analysis",
        "Customer Insights & Positioning"
      ];
      phases = [
        { title: "Phase 1: Market Intelligence", timeline: "0-1 month", description: 'Deep competitive analysis and market trend research for ' + goal + '.', status: "pending" },
        { title: "Phase 2: Strategic Positioning", timeline: "1-3 months", description: 'Position product based on market gaps and customer needs for ' + goal + '.', status: "pending" },
        { title: "Phase 3: Market Dominance", timeline: "3-12 months", description: 'Execute market penetration strategy with competitive advantages for ' + goal + '.', status: "pending" }
      ];
      market = [
        { title: "Market Gap", description: `Identified market gap and opportunity for ${goal}.`, sourceUrl: "" },
        { title: "Competitive Advantage", description: `Unique positioning strategy for ${goal}.`, sourceUrl: "" }
      ];
      break;
      
    default: // Standard
      pillars = [
        "Execution Discipline",
        "Strategic Clarity",
        "Momentum Building"
      ];
      phases = [
        { title: "Phase 1: Foundation", timeline: "0-1 month", description: 'Set up core assets and validate assumptions for ' + goal + '.', status: "pending" },
        { title: "Phase 2: Build", timeline: "1-3 months", description: 'Execute MVP and gather user feedback for ' + goal + '.', status: "pending" },
        { title: "Phase 3: Scale", timeline: "3-12 months", description: 'Optimize, scale, and secure product-market fit for ' + goal + '.', status: "pending" }
      ];
      market = [{ title: "Market Opportunity", description: `There is a growing demand for solutions related to ${goal}.`, sourceUrl: "" }];
  }

  // Build a human-readable text block similar to Gemini output
  const parts = [];
  parts.push('Official Success Roadmap');
  parts.push(title);
  parts.push('');
  parts.push(vision);
  parts.push('');
  parts.push('Core Pillars');
  parts.push('1. ' + pillars[0]);
  parts.push('2. ' + pillars[1]);
  parts.push('3. ' + pillars[2]);
  parts.push('');
  parts.push('Execution Sequence');
  phases.forEach(p => {
    parts.push(p.title);
    parts.push('Timeline: ' + p.timeline);
    parts.push(p.description);
    parts.push('');
  });
  parts.push('Market Intelligence');
  market.forEach(m => {
    parts.push('- ' + m.description);
  });
  return parts.join('\n');
}

app.post("/api/generate", async (req, res) => {
  try {
    const { goal, mode, userId } = req.body;

    if (!goal) {
      return res.status(400).json({ error: "Goal is required" });
    }

    // 🔥 MODE-BASED INTELLIGENCE SWITCH
    let systemInstruction = "";

    switch (mode) {
      case "Detailed":
        systemInstruction = `
You are a senior strategy consultant.

Generate an EXTREMELY detailed execution blueprint including:
`;
        break;

      case "Rapid":
        systemInstruction = `
You are a fast-execution strategist.

Generate a lean, aggressive roadmap focused on:
Keep it concise and action-driven.
`;
        break;

      case "Market Intel":
        systemInstruction = `
You are a market intelligence analyst.

Generate a strategic blueprint heavily focused on:
Include strong market insights.
`;
        break;

      default:
        systemInstruction = `
You are a professional strategy architect.

Generate a balanced execution blueprint with:
`;
    }

    // 🔥 FINAL PROMPT STRUCTURE
    const prompt = `
${systemInstruction}

Create an Official Success Roadmap for the following goal:

"${goal}"

Format EXACTLY in this structure:

Official Success Roadmap
[Strong strategic title]

"Vision statement in quotes"

Core Pillars
1. Pillar one
2. Pillar two
3. Pillar three

Execution Sequence
Phase 1 Title
Timeline
Description

Phase 2 Title
Timeline
Description

Phase 3 Title
Timeline
Description

Market Intelligence
Insight 1
Insight 2
Insight 3

Make it visually structured and professional.
`;

      let blueprintText = null;

      // If Gemini keys are configured, try calling the API; otherwise use local fallback.
      if (GEMINI_API_KEYS.length > 0) {
        // Try each API key with fallback
        for (const apiKey of GEMINI_API_KEYS) {
          try {
            const geminiUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + apiKey;
            const geminiResponse = await fetch(geminiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [{ text: prompt }]
                  }
                ]
              })
            });

            if (!geminiResponse.ok) {
              const data = await geminiResponse.json().catch(() => null);
              console.error("Gemini API Error:", data);
              // Continue to next API key if available
              continue;
            } else {
              const data = await geminiResponse.json().catch(() => null);
              blueprintText = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
              if (blueprintText) {
                console.log('✅ Blueprint generated successfully');
                break; // Success, stop trying other keys
              }
            }
          } catch (e) {
            console.error('Gemini fetch failed:', e.message || e);
            // Continue to next API key
          }
        }
      }

      // Local fallback generator if Gemini failed or is not configured
      if (!blueprintText) {
        blueprintText = generateLocalBlueprint(goal, mode);
      }

    // Clean up markdown formatting
    blueprintText = blueprintText
      .replace(/\*\*/g, "")
      .replace(/\*(?!\s)/g, "")
      .replace(/##+\s*/g, "")
      .replace(/`+/g, "")
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      .trim();

    // Parse the blueprint text to extract structured sections
    function parseBlueprint(text) {
      const lines = text.split('\n');
      let goalTitle = goal || "Untitled Goal";
      let visionStatement = "";
      let coreFocus = [];
      let strategyRoadmap = [];
      let marketAnalysis = [];

      let currentPhase = null;
      let inVision = false;
      let inPillars = false;
      let inPhases = false;
      let inMarket = false;
      let currentPhaseDescription = "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Extract title if exists
        if (i === 0 && line && !line.includes("Vision") && !line.includes("Pillar")) {
          goalTitle = line.replace(/^#+\s*/, "").replace(/\*/g, "");
        }

        // Extract vision statement
        if ((line.includes("Vision") || inVision) && line.includes("\"")) {
          const match = line.match(/"([^"]+)"/);
          if (match) visionStatement = match[1];
          inVision = false;
        } else if ((line.includes("Vision") || inVision) && line) {
          visionStatement = line.replace(/^#+\s*/, "").replace(/Vision.*:/i, "").trim();
          inVision = true;
        }

        // Extract core pillars/focus areas
        if (line.match(/Core\s+Pillar|Focus.*Area/i)) {
          inPillars = true;
          continue;
        }
        if (inPillars && line && !line.match(/^Phase|Execution|Market|Timeline/) && line.match(/^\d+\.|^[-*]/)) {
          const pillars = line.replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "").trim();
          if (pillars) coreFocus.push(pillars);
        }

        // Extract execution phases
        if (line.match(/Phase\s+\d+/i) || line.match(/^Months/i)) {
          if (currentPhase) {
            currentPhase.description = currentPhaseDescription.trim();
            strategyRoadmap.push(currentPhase);
          }
          
          const phaseMatch = line.match(/Phase\s+\d+[:\s]*(.+)/i);
          if (phaseMatch) {
            currentPhase = {
              title: phaseMatch[0],
              description: "",
              timeline: "",
              status: "pending"
            };
            currentPhaseDescription = "";
            inPhases = true;
          }
        } else if (inPhases && currentPhase) {
          const timelineMatch = line.match(/Timeline[:\s]*(.+)/i);
          if (timelineMatch) {
            currentPhase.timeline = timelineMatch[1].trim();
          } else if (line && !line.match(/^Phase|Market|Pillar|Vision/i)) {
            currentPhaseDescription += line + " ";
          }
        }

        // Extract market intelligence
        if (line.match(/Market\s+Intelligence/i)) {
          inMarket = true;
          inPhases = false;
          if (currentPhase) {
            currentPhase.description = currentPhaseDescription.trim();
            strategyRoadmap.push(currentPhase);
            currentPhase = null;
          }
          continue;
        }

        if (inMarket && line && !line.match(/Market\s+Intelligence/i) && line.match(/^[-*•]|\d+\.|^[A-Z]/)) {
          const insight = line.replace(/^[-*•\d+.]\s*/, "").trim();
          if (insight && insight.length > 5) {
            marketAnalysis.push({
              title: insight.split(":")[0],
              description: insight,
              sourceUrl: ""
            });
          }
        }
      }

      // Add last phase if exists
      if (currentPhase) {
        currentPhase.description = currentPhaseDescription.trim();
        strategyRoadmap.push(currentPhase);
      }

      // Ensure minimum structures
      if (coreFocus.length === 0) {
        coreFocus = [
          "Execution Discipline",
          "Strategic Clarity",
          "Momentum Building"
        ];
      }

      if (strategyRoadmap.length === 0) {
        strategyRoadmap = [{
          title: "Strategic Implementation",
          description: blueprintText,
          timeline: "Ongoing",
          status: "pending"
        }];
      }

      if (marketAnalysis.length === 0) {
        marketAnalysis = [{
          title: "Market Analysis",
          description: "Strategic market insights and opportunities identified.",
          sourceUrl: ""
        }];
      }

      return {
        goalTitle,
        visionStatement: visionStatement || blueprintText.slice(0, 200),
        coreFocus,
        strategyRoadmap,
        marketAnalysis
      };
    }

    const structuredBlueprint = parseBlueprint(blueprintText);

    // Stream response as Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send text in chunks with delays for streaming effect
    const chunkSize = 50;
    let sent = 0;
    let completed = false;

    const streamInterval = setInterval(async () => {
      const chunk = blueprintText.substring(sent, sent + chunkSize);
      if (chunk.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'content', text: chunk })}\n\n`);
        sent += chunkSize;
      } else {
        if (!completed) {
          completed = true;
          // Increment user's daily usage after successful generation
          if (userId) {
            incrementUserUsage(userId).catch(err => console.error('Failed to increment usage:', err));
          }
          clearInterval(streamInterval);
          res.write(`data: ${JSON.stringify({ type: 'complete', data: structuredBlueprint })}\n\n`);
          res.end();
        }
      }
    }, 20);

  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      error: "Failed to generate blueprint"
    });
  }
});

// Chat API endpoint for strategy coaching
app.post("/api/chat", async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Build conversation context
    const messages = [
      {
        role: "user",
        parts: [{
          text: `You are a friendly and enthusiastic strategic coach for Ascend AI, similar to ChatGPT.

IMPORTANT GUIDELINES:
- Use a conversational, friendly tone like ChatGPT
- Use relevant emojis naturally throughout your response ✨
- Do NOT use markdown formatting (no **, #, -, etc.)
- Write in natural flowing paragraphs, not bullet points
- Be encouraging and motivational 💪
- Keep responses concise but helpful (2-3 sentences typically)
- For longer topics, use emojis as separators instead of formatting

Help the user with:
👉 Goal achievement strategies
👉 Execution planning and roadmaps
👉 Market insights and opportunities
👉 Career guidance and growth
👉 Personal development tips

User's question: ${message}

Remember: Be warm, use emojis, and write naturally without any markdown formatting!`
        }]
      }
    ];

    let chatResponse = null;

    // Try each API key with fallback
    if (GEMINI_API_KEYS.length > 0) {
      for (const apiKey of GEMINI_API_KEYS) {
        try {
          const geminiUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + apiKey;
          const geminiResponse = await fetch(geminiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: messages
            })
          });

          if (!geminiResponse.ok) {
            console.error("Gemini Chat API Error:", await geminiResponse.json().catch(() => null));
            continue;
          } else {
            const data = await geminiResponse.json().catch(() => null);
            chatResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
            if (chatResponse) {
              console.log('✅ Chat response generated successfully');
              break;
            }
          }
        } catch (e) {
          console.error('Gemini chat fetch failed:', e.message || e);
          continue;
        }
      }
    }

    // Fallback response if all API keys fail
    if (!chatResponse) {
      chatResponse = `Great question about "${message}"! 😊 Right now I'm having a small technical hiccup, but here's what I'd recommend: Start by breaking your goal into smaller, manageable steps 🎯 Focus on one action today that moves you forward 🚀 You've got this! Try asking me again in a moment and I'll give you more detailed guidance! 💪`;
    }

    // Send response
    res.json({
      type: 'chat',
      message: chatResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Chat server error:", error);
    return res.status(500).json({
      error: "Failed to process chat message"
    });
  }
});

// ========== DELETE BLUEPRINT ENDPOINT ==========
app.delete('/api/blueprint/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID required' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Blueprint ID required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Get the blueprint to verify ownership
    const { data: blueprints } = await supabase
  .from('blueprints')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });


    if (fetchError || !blueprint) {
      return res.status(404).json({ error: 'Blueprint not found or access denied' });
    }

    // Delete the blueprint
    const { error: deleteError } = await supabase
      .from('blueprints')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Delete blueprint error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete blueprint' });
    }

    console.log(`✅ Blueprint ${id} deleted by user ${userId}`);
    res.json({ success: true, message: 'Blueprint deleted successfully' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ error: 'Server error while deleting blueprint' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Using ${GEMINI_API_KEYS.length} API key(s) for Gemini`);
});
// Serve frontend build
app.use(express.static(path.join(__dirname, "../dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist", "index.html"));
});
