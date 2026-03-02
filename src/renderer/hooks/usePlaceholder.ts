import { useMemo } from "react";
import type { UiLocale } from "../components/LanguageSelector";

const PLACEHOLDERS: Record<UiLocale, string[]> = {
  ru: [
    "Что изменится в мире через 5 лет?",
    "Как быстрее всего выучить новый навык?",
    "Кто сейчас президент США?",
    "Как подготовиться к собеседованию?",
    "Почему растёт курс биткоина?",
    "Какой рецепт блинчиков самый простой?",
    "Что делать, если не хватает мотивации?",
    "Как выбрать ноутбук для работы?",
    "Кто лучший футболист всех времён?",
    "Как начать инвестировать с нуля?",
    "Что почитать для саморазвития?",
    "Как справиться с прокрастинацией?",
    "Какие привычки меняют жизнь?",
    "Почему важно учить языки?",
    "Как найти баланс между работой и отдыхом?"
  ],
  en: [
    "What will change in the world in 5 years?",
    "What's the fastest way to learn a new skill?",
    "Who is the current US president?",
    "How to prepare for a job interview?",
    "Why is Bitcoin price rising?",
    "What's the simplest pancake recipe?",
    "What to do when you lack motivation?",
    "How to choose a laptop for work?",
    "Who is the greatest footballer of all time?",
    "How to start investing from scratch?",
    "What to read for self-improvement?",
    "How to beat procrastination?",
    "What habits change your life?",
    "Why is learning languages important?",
    "How to find work-life balance?"
  ],
  zh: [
    "5年后世界会有什么变化？",
    "最快学会新技能的方法是什么？",
    "美国现任总统是谁？",
    "如何准备面试？",
    "比特币为什么涨？",
    "最简单的煎饼食谱是什么？",
    "缺乏动力时该怎么办？",
    "如何选择工作用的笔记本电脑？",
    "史上最伟大的足球运动员是谁？",
    "如何从零开始投资？",
    "自我提升该读什么书？",
    "如何克服拖延症？",
    "哪些习惯能改变人生？",
    "为什么学语言很重要？",
    "如何找到工作与生活的平衡？"
  ]
};

/** Возвращает случайный placeholder при каждом монтировании (обновлении страницы) */
export function usePlaceholder(locale: UiLocale): string {
  return useMemo(() => {
    const list = PLACEHOLDERS[locale];
    const idx = Math.floor(Math.random() * list.length);
    return list[idx] ?? list[0];
  }, [locale]);
}
