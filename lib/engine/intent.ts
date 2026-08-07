export type Intent = "question" | "task" | "project" | "chat";

const PROJECT_KEYWORDS = [
  "想做", "我要做", "帮我做", "我想弄", "搞一个", "整一个",
  "设计", "开发", "制作", "创造", "搭建", "做一个",
  "app", "游戏", "小程序", "网页", "网站", "机器人",
  "自动", "装置", "diy", "项目",
];

const QUESTION_KEYWORDS = [
  "为什么", "什么是", "怎么", "如何", "是什么", "什么意思",
  "能", "可以吗", "行不行", "对不对", "有没有",
];

const TASK_KEYWORDS = [
  "帮我写", "帮我改", "帮我查", "帮我整理", "帮我总结",
  "作文", "作业", "读后感", "报告", "笔记",
];

export function classifyIntent(input: string): Intent {
  const lower = input.toLowerCase();

  if (PROJECT_KEYWORDS.some(k => lower.includes(k))) return "project";
  if (TASK_KEYWORDS.some(k => lower.includes(k))) return "task";
  if (QUESTION_KEYWORDS.some(k => lower.includes(k))) return "question";

  return "chat";
}
