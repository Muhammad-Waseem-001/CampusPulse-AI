require("dotenv").config();
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 8080;
const BOT_NAME = process.env.BOT_NAME || "CampusPulse AI";
const BOT_TIMEZONE = process.env.BOT_TIMEZONE || "Asia/Karachi";
const DEBUG_WEBHOOK = process.env.DEBUG_WEBHOOK === "true";

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || "Sheet1!A:G";
const GOOGLE_SERVICE_ACCOUNT_KEY_FILE =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || path.join(__dirname, "credentials.json");

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.warn("Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.");
}
if (!GOOGLE_SHEET_ID) {
  console.warn("Google Sheets is not configured. Set GOOGLE_SHEET_ID.");
}
if (!smtpUser || !smtpPass) {
  console.warn("SMTP email is not configured. Set SMTP_USER and SMTP_PASS.");
}

const courseKnowledgeBase = {
  WEB_DEV: {
    title: "Web Development",
    officeHours: "Mon/Wed 2:00 PM - 4:00 PM",
    assignmentPolicy: "Late submissions accepted within 48 hours with 10% deduction.",
    examFormat: "Practical coding tasks + project review.",
  },
  GEN_CHATBOT: {
    title: "Generative & Chatbot Development",
    officeHours: "Tue/Thu 1:00 PM - 3:00 PM",
    assignmentPolicy: "Two lowest quizzes are dropped automatically.",
    examFormat: "Prompt design assessment + bot implementation.",
  },
  SHOPIFY: {
    title: "Shopify E-Commerce",
    officeHours: "Mon 11:00 AM - 1:00 PM",
    assignmentPolicy: "Draft feedback available up to 3 days before due date.",
    examFormat: "Store build practical + strategy viva.",
  },
  MODERN_WEB_APP: {
    title: "Modren web and app",
    officeHours: "Fri 10:00 AM - 12:00 PM",
    assignmentPolicy: "Group project contributes 30% of final grade.",
    examFormat: "Capstone demo + technical interview.",
  },
};

const courseAliases = {
  WEB_DEV: ["web development", "web dev", "website development", "full stack"],
  GEN_CHATBOT: ["generative", "chatbot development", "gen ai", "ai chatbot"],
  SHOPIFY: ["shopify", "e-commerce", "ecommerce", "online store"],
  MODERN_WEB_APP: ["modren web and app", "modern web and app", "web and app"],
};

const mentorKnowledgeBase = {
  AREEBA_KHAN: {
    name: "Areeba Khan",
    role: "Lead Mentor - Web Development",
    expertise: "React, Node.js, REST APIs",
    officeHours: "Mon/Wed 4:00 PM - 6:00 PM",
    contact: "areeba.khan@campuspulse.edu",
  },
  HAMZA_SIDDIQUI: {
    name: "Hamza Siddiqui",
    role: "Senior Mentor - Generative & Chatbot Development",
    expertise: "LLM prompting, RAG pipelines, chatbot architecture",
    officeHours: "Tue/Thu 3:00 PM - 5:00 PM",
    contact: "hamza.siddiqui@campuspulse.edu",
  },
  MAHNOOR_AHMED: {
    name: "Mahnoor Ahmed",
    role: "Mentor - Shopify E-Commerce",
    expertise: "Shopify setup, payment gateways, conversion optimization",
    officeHours: "Mon/Fri 1:00 PM - 3:00 PM",
    contact: "mahnoor.ahmed@campuspulse.edu",
  },
  ZAIN_ALI: {
    name: "Zain Ali",
    role: "Mentor - Modren web and app",
    expertise: "React Native, Next.js, app deployment",
    officeHours: "Wed/Sat 11:00 AM - 1:00 PM",
    contact: "zain.ali@campuspulse.edu",
  },
};

const mentorAliases = {
  AREEBA_KHAN: ["areeba", "areeba khan", "web mentor", "web development mentor"],
  HAMZA_SIDDIQUI: [
    "hamza",
    "hamza siddiqui",
    "gen ai mentor",
    "chatbot mentor",
    "generative mentor",
  ],
  MAHNOOR_AHMED: ["mahnoor", "mahnoor ahmed", "shopify mentor", "ecommerce mentor"],
  ZAIN_ALI: ["zain", "zain ali", "modern web mentor", "modren web mentor", "app mentor"],
};

const intentBlueprint = {
  welcome_student: {
    entities: [],
    parameters: [],
    triggers: ["hi", "hello", "hey", "start", "help"],
  },
  course_info: {
    entities: ["course_code"],
    parameters: ["course_code"],
    triggers: ["course", "exam", "assignment", "office hour", "timing", "schedule"],
  },
  submit_student_query: {
    entities: ["student_name", "student_email", "course_code", "query_text"],
    parameters: ["student_name", "student_email", "course_code", "query_text"],
    triggers: ["issue", "problem", "query", "complaint", "support", "help me", "ticket"],
  },
  mentor_info: {
    entities: ["mentor_name"],
    parameters: ["mentor_name"],
    triggers: ["mentor", "teacher", "teachers", "instructor", "faculty", "trainer", "coach"],
  },
};

let cachedSheetsClient = null;

function normalizeText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value[0] ? String(value[0]).trim() : "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return "";
}

function normalizeKeyName(key) {
  return normalizeText(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getValueByAliases(source, aliases) {
  if (!source || typeof source !== "object") return "";

  const map = new Map();
  for (const [key, value] of Object.entries(source)) {
    map.set(normalizeKeyName(key), value);
  }

  for (const alias of aliases) {
    const matched = map.get(normalizeKeyName(alias));
    const normalized = normalizeText(matched);
    if (normalized) return normalized;
  }

  return "";
}

function objectFromKeyValueArray(input) {
  if (!Array.isArray(input)) {
    return input && typeof input === "object" ? input : {};
  }

  return input.reduce((acc, item) => {
    if (!item || typeof item !== "object") return acc;
    const key = firstNonEmpty(item.name, item.key, item.variableName);
    const value = firstNonEmpty(item.value, item.val, item.data, item.text);
    if (key) acc[key] = value;
    return acc;
  }, {});
}

function formatDateTime(value) {
  const dateObject = new Date(value);
  if (Number.isNaN(dateObject.getTime())) return String(value);
  return dateObject.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
    timeZone: BOT_TIMEZONE,
  });
}

function getGooglePrivateKey() {
  if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }
  if (!process.env.GOOGLE_PRIVATE_KEY) return "";
  return process.env.GOOGLE_PRIVATE_KEY.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

async function getSheetsClient() {
  if (cachedSheetsClient) return cachedSheetsClient;

  const privateKey = getGooglePrivateKey();
  const hasEnvCredentials = process.env.GOOGLE_CLIENT_EMAIL && privateKey;
  const hasKeyFile = fs.existsSync(GOOGLE_SERVICE_ACCOUNT_KEY_FILE);

  if (!hasEnvCredentials && !hasKeyFile) {
    throw new Error(
      "Google credentials missing. Set GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_FILE."
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: hasEnvCredentials
      ? {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: privateKey,
        }
      : undefined,
    keyFile: !hasEnvCredentials ? GOOGLE_SERVICE_ACCOUNT_KEY_FILE : undefined,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  cachedSheetsClient = google.sheets({ version: "v4", auth: client });
  return cachedSheetsClient;
}

function resolveCourseCode(raw) {
  const text = normalizeText(raw).toUpperCase();
  const normalizedText = normalizeText(raw).toLowerCase();
  if (!text) return "";
  if (courseKnowledgeBase[text]) return text;

  const directCode = Object.keys(courseKnowledgeBase).find((item) => text.includes(item));
  if (directCode) return directCode;

  const aliasCode = Object.entries(courseAliases).find(([, aliases]) =>
    aliases.some((alias) => normalizedText.includes(alias))
  );

  return aliasCode ? aliasCode[0] : "";
}

function resolveMentorCode(raw) {
  const text = normalizeText(raw).toUpperCase();
  const normalizedText = normalizeText(raw).toLowerCase();
  if (!text) return "";
  if (mentorKnowledgeBase[text]) return text;

  const directCode = Object.keys(mentorKnowledgeBase).find((item) => text.includes(item));
  if (directCode) return directCode;

  const aliasCode = Object.entries(mentorAliases).find(([, aliases]) =>
    aliases.some((alias) => normalizedText.includes(alias))
  );

  return aliasCode ? aliasCode[0] : "";
}

function extractPayloadMessage(payload = {}) {
  const raw =
    payload.message ??
    payload.text ??
    payload.content ??
    payload.originalMessage ??
    payload?.payload?.message ??
    payload?.payload?.text ??
    "";

  if (raw && typeof raw === "object") {
    return firstNonEmpty(raw.message, raw.text, raw.content, raw.title);
  }

  return normalizeText(raw);
}

function extractPayloadEntityHints(payload = {}) {
  const metadata = objectFromKeyValueArray(payload.metadata || {});
  const params = objectFromKeyValueArray(
    payload.parameters || payload.params || payload.entities || payload.extractedEntities || {}
  );
  const context = objectFromKeyValueArray(payload.context || payload.conversationContext || {});
  const nlp = objectFromKeyValueArray(payload.nlpResponse || {});
  const nlpParams = objectFromKeyValueArray(
    nlp.parameters || nlp.params || nlp.entities || nlp.extractedEntities || {}
  );

  const scopes = [metadata, params, context, nlpParams, payload, payload.userInfo || {}];

  const pick = (aliases) => firstNonEmpty(...scopes.map((scope) => getValueByAliases(scope, aliases)));

  return {
    student_name: pick([
      "student_name",
      "$student_name",
      "studentName",
      "$studentName",
      "name",
      "$name",
      "displayName",
      "$displayName",
    ]),
    student_email: pick([
      "student_email",
      "$student_email",
      "studentEmail",
      "$studentEmail",
      "email",
      "$email",
      "userEmail",
      "$userEmail",
    ]),
    course_code: pick([
      "course_code",
      "$course_code",
      "courseCode",
      "$courseCode",
      "course",
      "$course",
    ]),
    query_text: pick([
      "query_text",
      "$query_text",
      "queryText",
      "$queryText",
      "issue",
      "$issue",
      "problem",
      "$problem",
      "description",
      "$description",
      "message",
      "$message",
    ]),
    mentor_name: pick([
      "mentor_name",
      "$mentor_name",
      "mentorName",
      "$mentorName",
      "mentor",
      "$mentor",
      "teacher",
      "$teacher",
    ]),
  };
}

function extractEntities(message, hints = {}) {
  const text = normalizeText(message);
  const lc = text.toLowerCase();
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const nameMatch = lc.match(/(?:my name is|i am|this is)\s+([a-z][a-z\s.'-]{1,60})/i);

  return {
    student_name: firstNonEmpty(hints.student_name, nameMatch ? nameMatch[1] : ""),
    student_email: firstNonEmpty(hints.student_email, emailMatch ? emailMatch[0] : ""),
    course_code: resolveCourseCode(firstNonEmpty(hints.course_code, text)),
    query_text: firstNonEmpty(hints.query_text, text),
    mentor_name: resolveMentorCode(firstNonEmpty(hints.mentor_name, text)),
  };
}

function detectIntent(message, entities = {}) {
  const text = normalizeText(message).toLowerCase();
  if (!text) return "fallback";

  if (intentBlueprint.welcome_student.triggers.some((token) => text.includes(token))) {
    return "welcome_student";
  }

  if (
    entities.course_code &&
    intentBlueprint.course_info.triggers.some((token) => text.includes(token))
  ) {
    return "course_info";
  }

  if (intentBlueprint.submit_student_query.triggers.some((token) => text.includes(token))) {
    return "submit_student_query";
  }

  if (
    entities.mentor_name ||
    intentBlueprint.mentor_info.triggers.some((token) => text.includes(token))
  ) {
    return "mentor_info";
  }

  return entities.course_code ? "course_info" : "fallback";
}

function inferIntentFromPayload(payload, message, entities) {
  const nlp = objectFromKeyValueArray(payload.nlpResponse || {});

  const explicitIntent = firstNonEmpty(
    payload.intentName,
    payload.intent,
    payload.action,
    payload.botIntent,
    payload.matchedIntent,
    payload.matchedIntentName,
    payload?.metadata?.intentName,
    payload?.metadata?.intent,
    payload?.payload?.intentName,
    payload?.payload?.intent,
    nlp.intent,
    nlp.intentName,
    nlp.matchedIntent,
    nlp.matchedIntentName
  ).toLowerCase();

  if (explicitIntent.includes("welcome")) return "welcome_student";
  if (explicitIntent.includes("course")) return "course_info";
  if (
    explicitIntent.includes("mentor") ||
    explicitIntent.includes("teacher") ||
    explicitIntent.includes("faculty")
  ) {
    return "mentor_info";
  }
  if (
    explicitIntent.includes("submit") ||
    explicitIntent.includes("query") ||
    explicitIntent.includes("ticket") ||
    explicitIntent.includes("support") ||
    explicitIntent.includes("complaint")
  ) {
    return "submit_student_query";
  }

  if (entities.student_name && entities.student_email && entities.course_code && entities.query_text) {
    return "submit_student_query";
  }

  return detectIntent(message, entities);
}

async function saveConversation(payload) {
  if (!supabase) return { ok: false, reason: "supabase_not_configured" };
  const { error } = await supabase.from("student_conversations").insert([payload]);
  if (error) throw error;
  return { ok: true };
}

async function saveStudentQuery(payload) {
  if (!supabase) return { ok: false, reason: "supabase_not_configured" };
  const { error } = await supabase.from("student_queries").insert([payload]);
  if (error) throw error;
  return { ok: true };
}

async function saveStudentQueryToGoogleSheets(payload) {
  if (!GOOGLE_SHEET_ID) return { ok: false, reason: "google_sheet_id_missing" };

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: GOOGLE_SHEET_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          payload.student_name,
          payload.student_email,
          payload.course_code,
          payload.query_text,
          payload.source,
          payload.status,
          formatDateTime(payload.created_at),
        ],
      ],
    },
  });

  return { ok: true };
}

function getMailerTransporter() {
  if (!smtpUser || !smtpPass) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

async function sendStudentConfirmationEmail(payload) {
  const transporter = getMailerTransporter();
  if (!transporter) return { ok: false, reason: "smtp_not_configured" };

  const info = await transporter.sendMail({
    from: `"${BOT_NAME}" <${smtpUser}>`,
    to: payload.student_email,
    subject: `Query Received for ${payload.course_code}`,
    text: `Hi ${payload.student_name},\n\nYour query has been received.\n\nCourse: ${payload.course_code}\nQuery: ${payload.query_text}\nStatus: ${payload.status}\nTime: ${formatDateTime(payload.created_at)}\n\nSupport team will follow up soon.\n\n- ${BOT_NAME}`,
  });

  return { ok: true, messageId: info.messageId };
}

async function persistQueryEverywhere(queryPayload) {
  const [supabaseResult, sheetResult, emailResult] = await Promise.allSettled([
    saveStudentQuery(queryPayload),
    saveStudentQueryToGoogleSheets(queryPayload),
    sendStudentConfirmationEmail(queryPayload),
  ]);

  if (supabaseResult.status === "rejected") {
    console.error("Supabase save failed:", supabaseResult.reason);
  }
  if (sheetResult.status === "rejected") {
    console.error("Google Sheet save failed:", sheetResult.reason);
  }
  if (emailResult.status === "rejected") {
    console.error("Student email failed:", emailResult.reason);
  }

  return {
    supabaseOk: supabaseResult.status === "fulfilled" && supabaseResult.value.ok,
    sheetsOk: sheetResult.status === "fulfilled" && sheetResult.value.ok,
    emailOk: emailResult.status === "fulfilled" && emailResult.value.ok,
  };
}

function buildKommunicateResponse(message) {
  return [{ message, metadata: { intentSource: "kommunicate" } }];
}

function hashKey(input) {
  return normalizeText(input)
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

function pickVariant(key, options) {
  if (!options || options.length === 0) return "";
  return options[hashKey(key) % options.length];
}

function getTimeGreeting() {
  const hour = Number(
    new Date().toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: BOT_TIMEZONE,
    })
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function buildDynamicWelcomeResponse(sessionId) {
  const openers = [
    "I can help with course details, teacher/mentor info, and assignment policy.",
    "I can answer course questions, mentor contacts, and register your support query.",
    "I can guide you on schedules, mentors, and also log your academic issues instantly.",
  ];

  const prompts = [
    "Try: 'Exam format for WEB_DEV' or 'Submit query for SHOPIFY'.",
    "You can ask: 'Office hours for GEN_CHATBOT' or 'I need help in MODERN_WEB_APP'.",
    "Start with: 'Course details WEB_DEV' or 'Raise issue for GEN_CHATBOT'.",
  ];

  return `${getTimeGreeting()}! Welcome to ${BOT_NAME}. ${pickVariant(sessionId, openers)} ${pickVariant(
    `${sessionId}-p`,
    prompts
  )}`;
}

function buildDynamicFallbackResponse(sessionId) {
  return pickVariant(sessionId, [
    "I did not fully catch that. Ask about a course, mentor, or share your name, email, course code, and issue.",
    "Please rephrase that. I can help with course details, mentor directory, or register a support query.",
    "I can help with WEB_DEV, GEN_CHATBOT, SHOPIFY, MODERN_WEB_APP, and mentor contacts. Share your question.",
  ]);
}

function buildDynamicCourseResponse(sessionId, code, course) {
  const templates = [
    `${code} (${course.title}) | Office hours: ${course.officeHours} | Assignment policy: ${course.assignmentPolicy} | Exam format: ${course.examFormat}`,
    `${course.title} [${code}] -> Office hours: ${course.officeHours}. Assignment: ${course.assignmentPolicy}. Exam: ${course.examFormat}`,
    `Here is ${code}: Office hours ${course.officeHours}; Assignment policy ${course.assignmentPolicy}; Exam format ${course.examFormat}`,
  ];

  return pickVariant(sessionId, templates);
}

function buildDynamicMentorListResponse(sessionId) {
  const mentorList = Object.values(mentorKnowledgeBase)
    .map((mentor) => mentor.name + " (" + mentor.role + ")")
    .join(" | ");

  const variants = [
    "Here are our campus mentors: " + mentorList + ".",
    "Mentor directory: " + mentorList + ".",
    "You can reach these mentors: " + mentorList + ".",
  ];

  return pickVariant(sessionId + "-mentor-list", variants);
}

function buildDynamicMentorProfileResponse(sessionId, mentor) {
  const variants = [
    mentor.name + " | " + mentor.role + " | Expertise: " + mentor.expertise + " | Office hours: " + mentor.officeHours + " | Contact: " + mentor.contact,
    "Mentor profile: " + mentor.name + " (" + mentor.role + "). Expertise: " + mentor.expertise + ". Office hours: " + mentor.officeHours + ". Contact: " + mentor.contact,
    mentor.name + " is available for guidance. Role: " + mentor.role + ". Skills: " + mentor.expertise + ". Office hours: " + mentor.officeHours + ". Contact: " + mentor.contact,
  ];

  return pickVariant(sessionId + "-" + mentor.name, variants);
}

function buildMissingFieldsResponse(sessionId, missing) {
  const list = missing.join(", ");
  return pickVariant(`${sessionId}-${list}`, [
    `Please share your ${list} so I can register your query.`,
    `I need your ${list} to submit this support request.`,
    `Almost done, please provide ${list} to log your issue.`,
  ]);
}

function buildQueryLoggedResponse(sessionId, courseCode, studentEmail, emailOk) {
  let message = pickVariant(sessionId, [
    `Your query for ${courseCode} has been logged. Support will contact ${studentEmail}.`,
    `Done. I have registered your ${courseCode} query. Team follow-up will go to ${studentEmail}.`,
    `Success. Your ${courseCode} issue is now in the helpdesk queue. Contact: ${studentEmail}.`,
  ]);

  if (!emailOk) {
    message += " Email confirmation is temporarily unavailable.";
  }

  return message;
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "student-helpdesk-bot",
    provider: "kommunicate",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/student-query", async (req, res) => {
  const studentName = normalizeText(req.body.studentName);
  const studentEmail = normalizeText(req.body.studentEmail);
  const courseCode = resolveCourseCode(req.body.courseCode);
  const queryText = normalizeText(req.body.queryText);

  if (!studentName || !studentEmail || !courseCode || !queryText) {
    return res
      .status(400)
      .json({ error: "studentName, studentEmail, courseCode, and queryText are required." });
  }

  try {
    const queryPayload = {
      student_name: studentName,
      student_email: studentEmail,
      course_code: courseCode,
      query_text: queryText,
      source: "web_form",
      status: "open",
      created_at: new Date().toISOString(),
    };

    const persistResult = await persistQueryEverywhere(queryPayload);

    await saveConversation({
      session_id: `web-${Date.now()}`,
      source: "web_form",
      intent_name: "manual_query_submission",
      user_message: queryText,
      bot_response: "Query submitted successfully.",
      course_code: courseCode,
      confidence: null,
      created_at: new Date().toISOString(),
    });

    return res.status(201).json({
      ok: persistResult.supabaseOk || persistResult.sheetsOk,
      message: "Query submitted successfully.",
      channels: persistResult,
    });
  } catch (error) {
    console.error("Error saving student query:", error);
    return res.status(500).json({ error: "Failed to save query." });
  }
});

app.post("/webhook", async (req, res) => {
  const payload = req.body || {};
  const incomingMessage = extractPayloadMessage(payload);

  const sessionId =
    firstNonEmpty(
      payload.groupId,
      payload.sessionId,
      payload.conversationId,
      payload.from,
      payload?.metadata?.sessionId
    ) || `km-${Date.now()}`;

  const payloadHints = extractPayloadEntityHints(payload);
  const entities = extractEntities(incomingMessage, payloadHints);
  const intentName = inferIntentFromPayload(payload, incomingMessage, entities);

  if (DEBUG_WEBHOOK) {
    console.log("[WEBHOOK] Payload keys:", Object.keys(payload));
    console.log("[WEBHOOK] Raw intent markers:", { matchedIntent: payload.matchedIntent, matchedIntentName: payload.matchedIntentName, eventName: payload.eventName });
    console.log("[WEBHOOK] Hints:", payloadHints);
    console.log("[WEBHOOK] Incoming:", { incomingMessage, intentName, sessionId, entities });
  }

  let responseText = buildDynamicFallbackResponse(sessionId);

  if (intentName === "welcome_student") {
    responseText = buildDynamicWelcomeResponse(sessionId);
  } else if (intentName === "course_info") {
    if (!entities.course_code) {
      responseText = "Please provide a course code like WEB_DEV, GEN_CHATBOT, SHOPIFY, or MODERN_WEB_APP.";
    } else {
      const course = courseKnowledgeBase[entities.course_code];
      responseText = buildDynamicCourseResponse(sessionId, entities.course_code, course);
    }
  } else if (intentName === "mentor_info") {
    const requestText = normalizeText(incomingMessage).toLowerCase();
    const wantsList =
      requestText.includes("all mentor") ||
      requestText.includes("all teacher") ||
      requestText.includes("list") ||
      requestText.includes("who are") ||
      requestText.includes("directory");

    if (wantsList || !entities.mentor_name) {
      responseText = buildDynamicMentorListResponse(sessionId);
    } else {
      const mentor = mentorKnowledgeBase[entities.mentor_name];
      responseText = mentor
        ? buildDynamicMentorProfileResponse(sessionId, mentor)
        : buildDynamicMentorListResponse(sessionId);
    }
  } else if (intentName === "submit_student_query") {
    const missing = [];
    if (!entities.student_name) missing.push("name");
    if (!entities.student_email) missing.push("email");
    if (!entities.course_code) missing.push("course code");
    if (!entities.query_text) missing.push("issue details");

    if (missing.length > 0) {
      responseText = buildMissingFieldsResponse(sessionId, missing);
    } else {
      try {
        const queryPayload = {
          student_name: entities.student_name,
          student_email: entities.student_email,
          course_code: entities.course_code,
          query_text: entities.query_text,
          source: "kommunicate",
          status: "open",
          created_at: new Date().toISOString(),
        };

        const persistResult = await persistQueryEverywhere(queryPayload);

        if (DEBUG_WEBHOOK) {
          console.log("[WEBHOOK] Persist result:", persistResult);
        }

        if (persistResult.supabaseOk || persistResult.sheetsOk) {
          responseText = buildQueryLoggedResponse(
            sessionId,
            entities.course_code,
            entities.student_email,
            persistResult.emailOk
          );
        } else {
          responseText = "I could not save your query right now. Please try again shortly.";
        }
      } catch (error) {
        console.error("Error saving Kommunicate query:", error);
        responseText = "I could not save your query right now. Please try again shortly.";
      }
    }
  }

  try {
    await saveConversation({
      session_id: sessionId,
      source: "kommunicate",
      intent_name: intentName,
      user_message: incomingMessage,
      bot_response: responseText,
      course_code: entities.course_code || null,
      confidence: null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error saving conversation:", error);
  }

  return res.json(buildKommunicateResponse(responseText));
});

app.post("/", (req, res) => {
  return res.redirect(307, "/webhook");
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
