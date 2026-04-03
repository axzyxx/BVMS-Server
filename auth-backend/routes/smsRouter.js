// routes/smsRouter.js
import express from "express";
import axios from "axios";
import Resident from "../models/Resident.js"; // adapt paths if needed
import Official from "../models/Officials.js"; // adapt
import Announcement from "../models/Announcement.js"; // optional: to save log
const router = express.Router();

const IPROG_BASE = "https://sms.iprogtech.com/api/v1";
const IPROG_TOKEN = process.env.IPROG_API_TOKEN || ""; // set this in your .env
const SMS_SENDER_NAME = "Ka Prets"; // Sender name displayed in SMS

if (!IPROG_TOKEN) {
  console.warn("IPROG_API_TOKEN is not set. SMS sending will fail until it's configured.");
}

/** Same rules as AnnouncementPanel (residentMembershipFlagYes). */
function residentFlagYesSms(val) {
  if (val === true || val === 1) return true;
  if (val == null || val === "") return false;
  return /^\s*(yes|y|1|true)\s*$/i.test(String(val).trim());
}

/** Canonical membership keys from the admin panel / API. */
function normalizeMembershipCategorySms(mc) {
  const s = mc == null ? "All" : String(mc).trim();
  if (s === "") return "All";
  const compact = s.toLowerCase().replace(/\s+/g, "");
  if (compact === "all") return "All";
  if (compact === "4ps") return "4PS";
  if (compact === "pwd") return "PWD";
  if (compact === "ips") return "IPS";
  if (compact === "seniorcitizen") return "SeniorCitizen";
  if (["All", "4PS", "PWD", "IPS", "SeniorCitizen"].includes(s)) return s;
  return "All";
}

function normalizeAudienceValue(a) {
  const s = String(a ?? "All").trim();
  const key = s.toLowerCase().replace(/\s+/g, "");
  const map = {
    all: "All",
    individual: "Individual",
    purok: "Purok",
    officials: "Officials",
    membershipresident: "MembershipResident",
  };
  if (map[key]) return map[key];
  return s;
}

// helper to call IPROG for a single phone number
async function sendSingleSms(phoneNumber, message) {
  // Check if API token is configured
  if (!IPROG_TOKEN || IPROG_TOKEN.trim() === "") {
    throw new Error("IPROG_API_TOKEN_MISSING: SMS API token is not configured. Please set IPROG_API_TOKEN in your environment variables.");
  }

  // Ensure phone format: Philippines mobiles should be 09XXXXXXXXX (11 digits)
  // Accept either +639... or 639... or 09... and convert to 09...
  let normalized = phoneNumber.toString().trim();
  if (!normalized || normalized === "") {
    throw new Error("Invalid phone number: phone number is empty");
  }
  
  // Remove any spaces, dashes, or parentheses
  normalized = normalized.replace(/[\s\-\(\)]/g, "");
  
  // Convert to 09XXXXXXXXX format
  if (normalized.startsWith("+63")) {
    // +639XXXXXXXXX -> 09XXXXXXXXX
    normalized = "0" + normalized.slice(3);
  } else if (normalized.startsWith("63") && normalized.length === 12) {
    // 639XXXXXXXXX -> 09XXXXXXXXX
    normalized = "0" + normalized.slice(2);
  } else if (normalized.startsWith("09")) {
    // Already in 09XXXXXXXXX format, keep as is
    normalized = normalized;
  } else {
    // If it doesn't start with any of these, assume it might be missing the 0
    // Only add 0 if it starts with 9 and has 10 digits
    if (normalized.startsWith("9") && normalized.length === 10) {
      normalized = "0" + normalized;
    }
  }
  
  // Validate phone number format (should be 11 digits starting with 09)
  if (!/^09\d{9}$/.test(normalized)) {
    throw new Error(`Invalid phone number format: ${phoneNumber}. Expected format: 09XXXXXXXXX (11 digits starting with 09)`);
  }
  
  // Try multiple API endpoint formats
  const endpoints = [
    `${IPROG_BASE}/sms_messages`,
    `${IPROG_BASE}/send`,
    `${IPROG_BASE}/sms/send`,
  ];
  
  // Log the request details (without exposing full token)
  console.log(`[SMS] Attempting to send to ${normalized}, message length: ${message.length}`);
  
  let lastError = null;
  
  // Try different endpoint and parameter combinations
  for (const url of endpoints) {
    // Method 1: Try as query parameters (most common for IPROG)
    try {
      const params = {
        api_token: IPROG_TOKEN,
        phone_number: normalized,
        message,
        sender_name: SMS_SENDER_NAME,
      };
      
      console.log(`[SMS] Trying ${url} with query params`);
      const res = await axios.post(url, null, { 
        params, 
        timeout: 20000,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      console.log(`[SMS] ✅ Success via query params:`, JSON.stringify(res.data, null, 2));
      return res.data;
    } catch (queryErr) {
      lastError = queryErr;
      console.warn(`[SMS] Query params failed for ${url}:`, queryErr?.response?.status, queryErr?.response?.data || queryErr.message);
      
      // Method 2: Try as JSON body
      try {
        const payload = {
          api_token: IPROG_TOKEN,
          phone_number: normalized,
          message,
          sender_name: SMS_SENDER_NAME,
        };
        
        console.log(`[SMS] Trying ${url} with JSON body`);
        const res = await axios.post(url, payload, {
          headers: { 
            "Content-Type": "application/json",
            'Accept': 'application/json',
          },
          timeout: 20000,
        });
        
        console.log(`[SMS] ✅ Success via JSON body:`, JSON.stringify(res.data, null, 2));
        return res.data;
      } catch (bodyErr) {
        lastError = bodyErr;
        console.warn(`[SMS] JSON body failed for ${url}:`, bodyErr?.response?.status, bodyErr?.response?.data || bodyErr.message);
        
        // Method 3: Try alternative parameter names
        try {
          const altParams = {
            token: IPROG_TOKEN,
            to: normalized,
            text: message,
            from: SMS_SENDER_NAME,
          };
          
          console.log(`[SMS] Trying ${url} with alternative param names`);
          const res = await axios.post(url, null, { 
            params: altParams, 
            timeout: 20000,
            headers: {
              'Accept': 'application/json',
            }
          });
          
          console.log(`[SMS] ✅ Success with alternative params:`, JSON.stringify(res.data, null, 2));
          return res.data;
        } catch (altErr) {
          lastError = altErr;
          console.warn(`[SMS] Alternative params failed for ${url}:`, altErr?.response?.status, altErr?.response?.data || altErr.message);
        }
      }
    }
  }
  
  // If all methods failed, throw detailed error
  const errorDetails = {
    phone: normalized,
    status: lastError?.response?.status,
    statusText: lastError?.response?.statusText,
    data: lastError?.response?.data,
    message: lastError?.message,
    url: lastError?.config?.url,
  };
  console.error("[SMS] ❌ All methods failed:", JSON.stringify(errorDetails, null, 2));
  throw new Error(`SMS sending failed: ${lastError?.response?.data?.message || lastError?.response?.data?.error || lastError?.response?.data || lastError?.message}`);
}

// POST /api/sms/send
// Accepts announcement payload and sends SMS to resolved recipients
router.post("/send", async (req, res) => {
  try {
    // Check if API token is configured
    if (!IPROG_TOKEN || IPROG_TOKEN.trim() === "") {
      return res.status(500).json({ 
        ok: false, 
        error: "IPROG_API_TOKEN_MISSING",
        message: "SMS API token is not configured. Please set IPROG_API_TOKEN in your environment variables." 
      });
    }

    const {
      announcementId,
      type = "Announcement",
      messageType = "Text",
      title = "",
      message = "",
      audience = "All",
      recipient = "",
      official = "",
      recipientId = "",
      recipientPhone = "",
      membershipCategory: membershipCategoryRaw = "All",
    } = req.body;

    const membershipCategory =
      membershipCategoryRaw == null || String(membershipCategoryRaw).trim() === ""
        ? "All"
        : String(membershipCategoryRaw).trim();

    const normalizedAudience = normalizeAudienceValue(audience);
    const membershipCat = normalizeMembershipCategorySms(membershipCategory);

    // Build SMS text with proper formatting based on type and messageType
    // Note: Removed emojis as they can cause delivery issues with some carriers
    let smsText = "";
    
    // Add urgency indicator for Emergency message type
    if (messageType === "Emergency") {
      smsText += "🚨 EMERGENCY ALERT 🚨\n\n";
    } else if (messageType === "Reminder") {
      smsText += "📌 REMINDER\n\n";
    }
    
    // Add announcement type header
    if (type === "Alert") {
      smsText += `ALERT: ${title}\n\n`;
    } else if (type === "Event") {
      smsText += ` EVENT: ${title}\n\n`;
    } else {
      smsText += `${type.toUpperCase()}: ${title}\n\n`;
    }
    
    // Add message content
    smsText += `${message}\n\n`;
    
    // Add footer with message type and sender
    smsText += `-- Barangay Victory (${messageType})`;

    // Determine recipients based on audience
    let targets = [];

    if (normalizedAudience === "All") {
      const residents = await Resident.find({ phone: { $exists: true, $ne: "" } }).select(
        "phone firstName lastName purok"
      );
      targets = residents
        .filter((r) => r.phone && String(r.phone).trim() !== "")
        .map((r) => ({
          phone: String(r.phone).trim(),
          name: `${r.firstName || ""} ${r.lastName || ""}`.trim(),
          purok: r.purok,
        }));
    } else if (normalizedAudience === "MembershipResident") {
      // Match AnnouncementPanel: load candidates then filter flags in JS (Mongo $regex on mixed types often returns no rows)
      const residents = await Resident.find({
        phone: { $exists: true, $ne: "" },
        status: { $nin: ["Rejected", "Transferred"] },
      }).select("phone firstName lastName purok member4ps pwd memberIps seniorCitizen");

      let list = residents.filter((r) => r.phone && String(r.phone).trim() !== "");

      if (membershipCat === "4PS") list = list.filter((r) => residentFlagYesSms(r.member4ps));
      else if (membershipCat === "PWD") list = list.filter((r) => residentFlagYesSms(r.pwd));
      else if (membershipCat === "IPS") list = list.filter((r) => residentFlagYesSms(r.memberIps));
      else if (membershipCat === "SeniorCitizen")
        list = list.filter((r) => residentFlagYesSms(r.seniorCitizen));

      targets = list.map((r) => ({
        phone: String(r.phone).trim(),
        name: `${r.firstName || ""} ${r.lastName || ""}`.trim(),
        purok: r.purok,
      }));
    } else if (normalizedAudience === "Individual") {
      // Check if recipientPhone is provided directly (from frontend)
      
      if (recipientPhone) {
        // Use the phone number directly if provided
        targets.push({ phone: recipientPhone, name: recipient || "Resident" });
      } else {
        // Fallback: recipient is fullName; try to find resident by full name or id
        // Try ID first:
        let r = null;
        if (recipientId && recipientId.match(/^[0-9a-fA-F]{24}$/)) {
          r = await Resident.findById(recipientId).select("phone firstName lastName");
        }
        if (!r && recipient && recipient.match(/^[0-9a-fA-F]{24}$/)) {
          r = await Resident.findById(recipient).select("phone firstName lastName");
        }
        if (!r) {
          // fallback: search by name (case-insensitive)
          const [first, last] = (recipient || "").split(" ");
          r = await Resident.findOne({
            $or: [
              { $expr: { $regexMatch: { input: { $concat: ["$firstName", " ", "$lastName"] }, regex: recipient, options: "i" } } },
              { firstName: new RegExp(`^${first || ""}`, "i") },
            ],
          }).select("phone firstName lastName");
        }
        if (r && r.phone) targets.push({ phone: r.phone, name: `${r.firstName} ${r.lastName}`.trim() });
      }
    } else if (normalizedAudience === "Purok") {
      const residents = await Resident.find({
        purok: new RegExp(recipient || "", "i"),
        phone: { $exists: true, $ne: "" },
      }).select("phone firstName lastName purok");
      targets = residents
        .filter((r) => r.phone && String(r.phone).trim() !== "")
        .map((r) => ({
          phone: String(r.phone).trim(),
          name: `${r.firstName || ""} ${r.lastName || ""}`.trim(),
          purok: r.purok,
        }));
    } else if (normalizedAudience === "Officials") {
      // send to officials (select those with contact/phone number)
      // Officials model uses 'contact' field, not 'phone'
      const officials = await Official.find({ 
        $or: [
          { contact: { $exists: true, $ne: "" } },
          { phone: { $exists: true, $ne: "" } }
        ]
      }).select("contact phone name position");
      // if specific official requested, filter by name
      const filtered = official && official.trim() !== "" 
        ? officials.filter((o) => (o.name || "").toLowerCase().includes(official.toLowerCase())) 
        : officials;
      targets = filtered
        .filter((o) => (o.contact || o.phone)) // Only include officials with contact info
        .map((o) => ({ 
          phone: o.contact || o.phone, // Use contact field, fallback to phone if exists
          name: o.name, 
          position: o.position 
        }));
    }

    if (targets.length === 0) {
      let message = "No recipients found for the selected audience.";
      if (normalizedAudience === "MembershipResident") {
        if (membershipCat !== "All") {
          message += ` No residents match "${membershipCat}" with a phone on file (check resident profiles), or all are Rejected/Transferred.`;
        } else {
          message += " No residents have a phone number, or all are Rejected/Transferred.";
        }
      } else if (normalizedAudience === "All") {
        message += " No residents have a phone number on file.";
      } else if (normalizedAudience === "Purok") {
        message += " No residents in that purok have a phone number.";
      } else if (normalizedAudience === "Officials") {
        message += " No officials have contact/phone on file.";
      } else {
        message += ` Unrecognized audience "${normalizedAudience}".`;
      }
      return res.status(400).json({ ok: false, message });
    }

    // send SMSs in parallel but be mindful of rate limits — we do a Promise.all here
    // If you prefer sequential sending to avoid throttling, change to for..of with await
    const sendPromises = targets.map((t) =>
      sendSingleSms(t.phone, smsText)
        .then((r) => ({ 
          ok: true, 
          phone: t.phone, 
          name: t.name,
          result: r 
        }))
        .catch((err) => ({ 
          ok: false, 
          phone: t.phone, 
          name: t.name,
          error: err?.response?.data || err.message,
          errorDetails: err?.response?.data 
        }))
    );

    const results = await Promise.all(sendPromises);
    
    // Log detailed results for debugging
    const successCount = results.filter(r => r.ok).length;
    const failCount = results.filter(r => !r.ok).length;
    console.log(`SMS sending completed: ${successCount} successful, ${failCount} failed`);
    if (failCount > 0) {
      console.error("Failed SMS details:", results.filter(r => !r.ok));
    }

    // Log results (optionally save to Announcement model)
    if (announcementId) {
      try {
        await Announcement.findByIdAndUpdate(announcementId, { smsSent: true, smsResult: results, smsSentAt: new Date() });
      } catch (e) {
        // ignore logging errors
        console.warn("Failed to update announcement with sms results", e.message);
      }
    }

    // Return detailed results including success/failure breakdown
    const successResults = results.filter(r => r.ok);
    const failedResults = results.filter(r => !r.ok);
    
    return res.json({ 
      ok: true, 
      count: results.length,
      successCount: successResults.length,
      failCount: failedResults.length,
      results,
      summary: {
        total: results.length,
        successful: successResults.length,
        failed: failedResults.length,
        failedDetails: failedResults.map(r => ({
          phone: r.phone,
          name: r.name,
          error: r.error
        }))
      }
    });
  } catch (err) {
    console.error("SMS send route error:", err);
    return res.status(500).json({ ok: false, message: "Server error sending SMS", detail: err.message });
  }
});

// Test endpoint: POST /api/sms/test
// Allows direct testing of SMS sending with a phone number
router.post("/test", async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        ok: false, 
        message: "phoneNumber is required" 
      });
    }
    
    if (!message) {
      return res.status(400).json({ 
        ok: false, 
        message: "message is required" 
      });
    }
    
    // Check if API token is configured
    if (!IPROG_TOKEN || IPROG_TOKEN.trim() === "") {
      return res.status(500).json({ 
        ok: false, 
        error: "IPROG_API_TOKEN_MISSING",
        message: "SMS API token is not configured. Please set IPROG_API_TOKEN in your environment variables." 
      });
    }
    
    console.log(`[SMS TEST] Testing SMS to ${phoneNumber}`);
    const result = await sendSingleSms(phoneNumber, message);
    
    return res.json({ 
      ok: true, 
      message: "SMS sent successfully",
      result 
    });
  } catch (err) {
    console.error("[SMS TEST] Error:", err);
    return res.status(500).json({ 
      ok: false, 
      message: err.message,
      error: err.message 
    });
  }
});

export default router;
