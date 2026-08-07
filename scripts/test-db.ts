import { getDb } from "../lib/db/index";
import { createSession, getSession } from "../lib/db/sessions";
import { createModelProfile, listModelProfiles } from "../lib/db/model-profiles";

const db = getDb();
console.log("DB initialized, tables:", db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());

const s = createSession({ age_group: "10-12" });
console.log("Created session:", s.id);
console.log("Retrieved:", getSession(s.id)?.id);

// Test encrypted storage
const p = createModelProfile({
  name: "Test", provider: "openai", base_url: "https://api.openai.com/v1",
  api_key: "sk-test-key-12345", model: "gpt-4o",
});
console.log("Profile created, api_key stored encrypted:", p.api_key.substring(0, 20) + "...");
console.log("Profile count:", listModelProfiles().length);
