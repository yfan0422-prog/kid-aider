import type { AgeGroup, Project, ReflectionType } from "@/lib/utils/types";
import { getRecentLogs } from "@/lib/db/project-logs";

export interface ReflectionQuestion {
  id: string;
  text: string;
  hint: string;
}

export interface ReflectionQuestions {
  questions: ReflectionQuestion[];
  context_note: string;
}

export async function buildReflectionQuestions(
  project: Project,
  ageGroup: AgeGroup,
  type: ReflectionType,
  triggerRef?: string | null
): Promise<ReflectionQuestions> {
  const logs = getRecentLogs(project.id, 5);

  // Build context from recent activity
  const doneTasks = logs.filter(l => l.action === "task_done").map(l => l.detail).slice(0, 3);
  const contextNote = doneTasks.length > 0
    ? `完成了：${doneTasks.join("、")}`
    : "";

  const isYoung = ageGroup === "6-9";

  const questions: ReflectionQuestion[] = [
    {
      id: "q1",
      text: isYoung
        ? `今天你做了什么呀？`
        : type === "daily"
          ? "今天你完成了哪些事情？"
          : type === "milestone"
            ? "这个阶段你完成了哪些事情？"
            : "整个项目你完成了哪些事情？回顾一下旅程吧。",
      hint: "想想今天完成了什么任务",
    },
    {
      id: "q2",
      text: isYoung
        ? "有什么让你觉得难的吗？"
        : "过程中遇到的最大挑战是什么？你是怎么解决的？",
      hint: "可以是技术上、材料上、或者时间上的困难",
    },
    {
      id: "q3",
      text: isYoung
        ? "你学会了什么新本领？"
        : type === "daily"
          ? "今天学到了什么新东西？"
          : "你学到了什么新知识或技能？如果可以重来，会怎么做？",
      hint: "可以是具体的技能，也可以是对自己的发现",
    },
    {
      id: "q4",
      text: isYoung
        ? "接下来想做什么呀？"
        : "下一步你有什么计划？需要什么帮助？",
      hint: type === "final" ? "这个项目结束后，你下一步的目标是什么？" : "下一个任务或目标是什么",
    },
  ];

  return { questions, context_note: contextNote };
}
