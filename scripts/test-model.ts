import { getDb } from "../lib/db/index";
import { createModelProfile, updateModelProfile } from "../lib/db/model-profiles";
import { routeModel, routeModelById } from "../lib/models/router";

getDb();

// Create a test profile (you'll need a real API key to fully test streaming)
const p = createModelProfile({
  name: "Test-DeepSeek",
  provider: "openai",
  base_url: "https://api.deepseek.com/v1",
  api_key: process.env.TEST_API_KEY || "sk-xxx",
  model: "deepseek-chat",
  assigned_roles: ["dialogue"],
});

// Mark it default so routeModel can find it by role
updateModelProfile(p.id, { is_default: true });

const routed = routeModel("dialogue");
console.log("Routed to:", routed?.profile.name, routed?.profile.model);
console.log("Adapter type:", routed?.adapter.constructor.name || "object");

const byId = routeModelById(p.id);
console.log("ById to:", byId?.profile.name, byId?.profile.model);
