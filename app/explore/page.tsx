"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TopicCard } from "@/components/parent/topic-card";
import { TopicDetail } from "@/components/parent/topic-detail";
import type { TopicCatalog, TopicCategory, TopicLanguage } from "@/lib/utils/types";

export const dynamic = "force-dynamic";

const CATEGORY_GROUPS: { label: string; icon: string; categories: TopicCategory[] }[] = [
  { label: "探索创造", icon: "🔬", categories: ["自然科学", "技术编程", "视觉艺术", "音乐表演"] },
  { label: "文化根基", icon: "📚", categories: ["历史长廊", "国学经典", "诗词歌赋", "中医智慧"] },
  { label: "学业赋能", icon: "🎯", categories: ["中文精进", "英文探索", "数学思维", "综合能力"] },
];

const LANGUAGES: { code: TopicLanguage; label: string; flag: string }[] = [
  { code: "zh-CN", label: "简体中文", flag: "🇨🇳" },
  { code: "zh-HK", label: "繁體中文", flag: "🇭🇰" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreContent />
    </Suspense>
  );
}

function ExploreContent() {
  const searchParams = useSearchParams();
  const topicIdParam = searchParams.get("topic");

  const [topics, setTopics] = useState<TopicCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(0);
  const [activeCategory, setActiveCategory] = useState<TopicCategory | null>(null);
  const [language, setLanguage] = useState<TopicLanguage>("zh-CN");
  const [selectedTopic, setSelectedTopic] = useState<TopicCatalog | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory) params.set("category", activeCategory);
    params.set("language", language);
    params.set("isActive", "true");

    setLoading(true);
    fetch(`/api/topics?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setTopics(d.topics);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeCategory, language]);

  useEffect(() => {
    if (topicIdParam && topics.length > 0) {
      const found = topics.find(t => t.id === topicIdParam);
      if (found) setSelectedTopic(found);
    }
  }, [topicIdParam, topics]);

  if (selectedTopic) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <TopicDetail
          topic={selectedTopic}
          onBack={() => setSelectedTopic(null)}
          initialLanguage={language}
        />
      </div>
    );
  }

  const currentCategories = CATEGORY_GROUPS[activeGroup].categories;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-ink-tertiary hover:text-ink transition-colors">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold">🔍 探索</h1>
      </div>

      {/* Language switcher */}
      <div className="flex items-center gap-2 mb-4">
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            onClick={() => setLanguage(l.code)}
            className={`px-3 py-1.5 rounded-btn text-body-sm transition-colors ${
              language === l.code
                ? "bg-primary text-white"
                : "bg-surface border border-border text-ink-secondary hover:bg-surface-raised"
            }`}
          >
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      {/* Category group tabs */}
      <div className="flex gap-0 mb-4 border-b border-border">
        {CATEGORY_GROUPS.map((g, i) => (
          <button
            key={g.label}
            onClick={() => { setActiveGroup(i); setActiveCategory(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-body-sm border-b-2 transition-colors ${
              activeGroup === i
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-ink-tertiary hover:text-ink"
            }`}
          >
            {g.icon} {g.label}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-body-sm transition-colors ${
            activeCategory === null
              ? "bg-primary text-white"
              : "bg-surface border border-border text-ink-secondary hover:bg-surface-raised"
          }`}
        >
          全部
        </button>
        {currentCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-body-sm transition-colors ${
              activeCategory === cat
                ? "bg-primary text-white"
                : "bg-surface border border-border text-ink-secondary hover:bg-surface-raised"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Topic grid */}
      {loading ? (
        <div className="text-center py-12 text-ink-tertiary">加载中...</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-12 text-ink-tertiary">
          <div className="text-4xl mb-3">📭</div>
          <p>暂无话题，更多内容正在准备中</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {topics.map(topic => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
