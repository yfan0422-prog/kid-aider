"use client";

import { useEffect, useState } from "react";
import type { TopicCatalog, TopicContent, TopicSuggestion } from "@/lib/utils/types";

type SubTab = "catalog" | "suggestions";

export function TopicManager() {
  const [subTab, setSubTab] = useState<SubTab>("catalog");
  const [topics, setTopics] = useState<TopicCatalog[]>([]);
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTopic, setEditingTopic] = useState<TopicCatalog | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newAgeGroup, setNewAgeGroup] = useState("all");
  const [newLanguage, setNewLanguage] = useState("zh-CN");

  const fetchTopics = async () => {
    const res = await fetch("/api/topics");
    const d = await res.json();
    setTopics(d.topics);
  };

  const fetchSuggestions = async () => {
    const res = await fetch("/api/topics/suggestions");
    const d = await res.json();
    setSuggestions(d.suggestions);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTopics(), fetchSuggestions()]).finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newSummary.trim() || !newCategory.trim()) return;
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        summary: newSummary,
        category: newCategory,
        age_group: newAgeGroup,
        language: newLanguage,
      }),
    });
    setNewTitle("");
    setNewSummary("");
    setNewCategory("");
    setShowAddForm(false);
    fetchTopics();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此话题？")) return;
    await fetch(`/api/topics/${id}`, { method: "DELETE" });
    fetchTopics();
  };

  const handleSuggestion = async (s: TopicSuggestion, action: "approved" | "rejected") => {
    await fetch(`/api/topics/suggestions/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: action,
        ...(action === "approved"
          ? {
              topic_title: s.candidate_title,
              topic_summary: `与"${s.interest_tag}"相关的知识探索`,
              category: "自然科学",
              age_group: "all",
              language: "zh-CN",
            }
          : {}),
      }),
    });
    fetchSuggestions();
    if (action === "approved") fetchTopics();
  };

  if (loading) {
    return <div className="p-6 text-ink-tertiary">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-0 border-b border-border">
        {([
          { key: "catalog" as SubTab, label: "📂 话题目录", count: topics.length },
          { key: "suggestions" as SubTab, label: "💡 智能推荐", count: suggestions.length },
        ]).map(st => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-body-sm border-b-2 transition-colors ${
              subTab === st.key
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-ink-tertiary hover:text-ink"
            }`}
          >
            {st.label} ({st.count})
          </button>
        ))}
      </div>

      {/* Catalog tab */}
      {subTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-body-lg font-bold">话题目录</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-primary text-white border-none rounded-btn px-4 py-2 font-semibold text-body-sm"
            >
              {showAddForm ? "取消" : "+ 添加话题"}
            </button>
          </div>

          {showAddForm && (
            <div className="bg-surface border border-border rounded-card p-4 space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="话题标题"
                className="w-full px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised"
              />
              <input
                type="text"
                value={newSummary}
                onChange={e => setNewSummary(e.target.value)}
                placeholder="一句话简介"
                className="w-full px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised"
              />
              <div className="flex gap-3">
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised"
                >
                  <option value="">选择分类</option>
                  <option value="自然科学">自然科学</option>
                  <option value="技术编程">技术编程</option>
                  <option value="视觉艺术">视觉艺术</option>
                  <option value="音乐表演">音乐表演</option>
                  <option value="历史长廊">历史长廊</option>
                  <option value="国学经典">国学经典</option>
                  <option value="诗词歌赋">诗词歌赋</option>
                  <option value="中医智慧">中医智慧</option>
                  <option value="中文精进">中文精进</option>
                  <option value="英文探索">英文探索</option>
                  <option value="数学思维">数学思维</option>
                  <option value="综合能力">综合能力</option>
                </select>
                <select
                  value={newAgeGroup}
                  onChange={e => setNewAgeGroup(e.target.value)}
                  className="w-28 px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised"
                >
                  <option value="6-9">6-9 岁</option>
                  <option value="10-12">10-12 岁</option>
                  <option value="13-15">13-15 岁</option>
                  <option value="all">全年龄</option>
                </select>
                <select
                  value={newLanguage}
                  onChange={e => setNewLanguage(e.target.value)}
                  className="w-28 px-3 py-2 border border-border rounded-btn text-body-sm bg-surface-raised"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="zh-HK">繁體中文</option>
                  <option value="en">English</option>
                </select>
              </div>
              <button
                onClick={handleAdd}
                className="bg-primary text-white border-none rounded-btn px-4 py-2 font-semibold text-body-sm"
              >
                确认添加
              </button>
            </div>
          )}

          <div className="space-y-2">
            {topics.map(topic => (
              <div
                key={topic.id}
                className="bg-surface border border-border rounded-card p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span>{topic.cover_image || "📚"}</span>
                    <span className="text-body font-bold">{topic.title}</span>
                    <span className="text-body-xs text-ink-tertiary px-2 py-0.5 bg-surface-raised rounded-full">
                      {topic.age_group}
                    </span>
                    <span className="text-body-xs text-ink-tertiary">{topic.language}</span>
                    <span className="text-body-xs text-ink-tertiary">| {topic.category}</span>
                  </div>
                  <p className="text-body-sm text-ink-tertiary mt-1">{topic.summary}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className={`text-body-xs px-2 py-0.5 rounded-full ${
                    topic.source === "seed" ? "bg-surface-raised text-ink-tertiary" :
                    topic.source === "auto_suggested" ? "bg-accent-purple/15 text-accent-purple" :
                    "bg-accent-green/15 text-accent-green"
                  }`}>
                    {topic.source === "seed" ? "种子" : topic.source === "auto_suggested" ? "推荐" : "手动"}
                  </span>
                  <button
                    onClick={() => handleDelete(topic.id)}
                    className="text-body-xs text-ink-tertiary hover:text-red-500 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions tab */}
      {subTab === "suggestions" && (
        <div className="space-y-4">
          <h3 className="text-body-lg font-bold">智能推荐审核</h3>
          {suggestions.length === 0 ? (
            <p className="text-ink-tertiary text-body-sm">暂无待审核的推荐</p>
          ) : (
            <div className="space-y-3">
              {suggestions.map(s => (
                <div key={s.id} className="bg-surface border border-border rounded-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-body font-bold">{s.candidate_title}</span>
                      <span className="text-body-xs text-ink-tertiary px-2 py-0.5 bg-surface-raised rounded-full">
                        {s.interest_tag}
                      </span>
                      <span className={`text-body-xs font-bold ${
                        s.viability_score >= 0.7 ? "text-accent-green" :
                        s.viability_score >= 0.5 ? "text-accent-yellow" : "text-red-500"
                      }`}>
                        可行性：{Math.round(s.viability_score * 100)}%
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSuggestion(s, "approved")}
                        className="bg-accent-green text-white border-none rounded-btn px-3 py-1.5 font-semibold text-body-xs"
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleSuggestion(s, "rejected")}
                        className="bg-surface-raised border border-border text-ink-secondary rounded-btn px-3 py-1.5 text-body-xs"
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                  {s.viability_reason && (
                    <p className="text-body-xs text-ink-tertiary">{s.viability_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
