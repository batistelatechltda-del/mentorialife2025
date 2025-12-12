"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Clock,
  Bot,
  User,
  Edit3,
  Trash2,
} from "lucide-react";
import { API } from "@/services";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

interface JournalEntry {
  id: string;
  user_id: string;
  content: string;
  is_auto: boolean;
  is_completed: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  category?: string | null;
  emoji?: string | null;
  life_area_id?: string | null;
  life_area?: { id: string; name: string } | null;
}

interface LifeArea {
  id: string;
  user_id?: string;
  name: string;
  color?: string | null;
}

const JournalPage = ({ journal: initialJournal }: any) => {
  const router = useRouter();
  const [journalInput, setJournalInput] = useState("");
  const [entries, setEntries] = useState<JournalEntry[]>(initialJournal || []);
  const [isLoading, setIsLoading] = useState(false);

  /** FILTROS DE VISUALIZAÇÃO */
  const [filterAutoManual, setFilterAutoManual] = useState<
    "all" | "auto" | "manual"
  >("all");
  const [filterLifeArea, setFilterLifeArea] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterEmoji, setFilterEmoji] = useState<string>("all");

  /** CAMPOS APENAS PARA CRIAÇÃO */
  const [createLifeAreaId, setCreateLifeAreaId] = useState<string>("all");
  const [createCategory, setCreateCategory] = useState<string>("");
  const [createEmoji, setCreateEmoji] = useState<string>("");

  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([]);

  /** LOAD LIFE AREAS */
  useEffect(() => {
    (async () => {
      try {
        const resp = await API.getAllLifeArea();
        setLifeAreas(resp.data.data || resp.data || []);
      } catch (err) {
        console.error("Failed fetching life areas", err);
      }
    })();
  }, []);

  /** LOAD JOURNALS */
  useEffect(() => {
    (async () => {
      try {
        const resp = await API.getAllJournal();
        setEntries(resp.data.data || resp.data || []);
      } catch (error) {
        console.error("Erro ao buscar journals", error);
      }
    })();
  }, []);

  /** CRIAÇÃO DE JOURNAL */
  const handleSubmit = async () => {
    if (!journalInput.trim()) return;

    setIsLoading(true);

    try {
      const payload: any = {
        content: journalInput.trim(),
        is_auto: false,
        category: createCategory || undefined,
        emoji: createEmoji || undefined,
        life_area_id:
          createLifeAreaId === "all" ? undefined : createLifeAreaId,
      };

      const resp = await API.addJournal(payload);
      const created = resp.data.data || resp.data;
      setEntries((prev) => [created, ...prev]);

      setJournalInput("");
      setCreateCategory("");
      setCreateEmoji("");
      setCreateLifeAreaId("all");
    } catch (err) {
      console.error("Erro ao criar journal", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await API.deleteJournal(entryId);
      setEntries(entries.filter((entry) => entry.id !== entryId));
    } catch (err) {
      console.error("Erro ao deletar", err);
    }
  };

  const handleToggleFavorite = async (entry: JournalEntry) => {
    try {
      const updated = { ...entry, is_favorite: !entry.is_favorite };
      await API.toggleFavoriteJournal(entry.id, {
        is_favorite: updated.is_favorite,
      });
      setEntries(entries.map((e) => (e.id === entry.id ? updated : e)));
    } catch (err) {
      console.error("Erro ao favoritar", err);
    }
  };

  /** FORMATADORES */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  /** FILTROS REAIS */
  const filteredEntries = entries
    .filter((entry) => {
      if (filterAutoManual === "auto" && !entry.is_auto) return false;
      if (filterAutoManual === "manual" && entry.is_auto) return false;
      return true;
    })
    .filter((entry) => {
      if (filterLifeArea === "all") return true;
      return entry.life_area_id === filterLifeArea;
    })
    .filter((entry) => {
      if (filterCategory === "all") return true;
      return entry.category === filterCategory;
    })
    .filter((entry) => {
      if (filterEmoji === "all") return true;
      return entry.emoji === filterEmoji;
    })
    .sort((a, b) => {
      if (a.is_favorite === b.is_favorite) {
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      }
      return a.is_favorite ? -1 : 1;
    });

  /** AGRUPAMENTO — SOMENTE AREAS QUE TÊM JOURNALS */
  const groupedByLifeArea = [
    {
      id: "all",
      name: "Todos os Diários",
      journals: filteredEntries,
    },
    ...lifeAreas
      .map((area) => ({
        id: area.id,
        name: area.name,
        journals: filteredEntries.filter(
          (j) => j.life_area_id === area.id
        ),
      }))
      .filter((g) => g.journals.length > 0),
  ];

  /** CALENDÁRIO */
  const formatDateForCalendar = (
    dateString: string,
    content: string,
    isFavorite: boolean
  ) => {
    const date = new Date(dateString);
    return {
      title: content.substring(0, 40),
      start: date.toISOString().split("T")[0],
      allDay: true,
      backgroundColor: isFavorite ? "#facc15" : "#3b82f6",
      borderColor: isFavorite ? "#d97706" : "#2563eb",
      textColor: "#000",
    };
  };

  const calendarEvents = entries.map((entry) =>
    formatDateForCalendar(
      entry.created_at,
      entry.content,
      entry.is_favorite
    )
  );

  /** ANIMAÇÃO DO FUNDO */
  const starsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (starsRef.current) {
      starsRef.current.innerHTML = "";
      for (let i = 0; i < 100; i++) {
        const star = document.createElement("div");
        star.className = "absolute rounded-full animate-pulse";
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        const size = Math.random() * 3 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.opacity = `${Math.random() * 0.8 + 0.2}`;
        star.style.background = "#fff";
        star.style.animationDelay = `${Math.random() * 3}s`;
        starsRef.current.appendChild(star);
      }
    }
  }, []);

  /** ESTATÍSTICAS */
  const stats = {
    total: entries.length,
    auto: entries.filter((e) => e.is_auto).length,
    manual: entries.filter((e) => !e.is_auto).length,
    today: entries.filter((e) => isToday(e.created_at)).length,
  };

  return (
    <div className="min-h-screen bg-black from-slate-950 bg-gradient-to-b">
      <div
        ref={starsRef}
        className="fixed inset-0 overflow-hidden pointer-events-none"
        style={{ zIndex: 0 }}
      />

      {/* HEADER */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft size={18} className="mr-2" />
            <span>Back</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Journal
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">

        {/* Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div
            onClick={() => setFilterAutoManual("all")}
            className={`bg-white dark:bg-gray-800 p-4 rounded shadow cursor-pointer ${
              filterAutoManual === "all" && "ring-2 ring-blue-500"
            }`}
          >
            <p className="text-sm text-gray-500">Total Entries</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.total}
            </p>
          </div>

          <div
            onClick={() => setFilterAutoManual("auto")}
            className={`bg-white dark:bg-gray-800 p-4 rounded shadow cursor-pointer ${
              filterAutoManual === "auto" && "ring-2 ring-blue-500"
            }`}
          >
            <p className="text-sm text-gray-500">Auto</p>
            <p className="text-2xl font-bold text-blue-600">
              {stats.auto}
            </p>
          </div>

          <div
            onClick={() => setFilterAutoManual("manual")}
            className={`bg-white dark:bg-gray-800 p-4 rounded shadow cursor-pointer ${
              filterAutoManual === "manual" && "ring-2 ring-blue-500"
            }`}
          >
            <p className="text-sm text-gray-500">Manual</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.manual}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
            <p className="text-sm text-gray-500">Today</p>
            <p className="text-2xl font-bold text-purple-600">
              {stats.today}
            </p>
          </div>
        </div>

        {/* --- FILTROS DE VISUALIZAÇÃO --- */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Life Area Filter */}
          <select
            value={filterLifeArea}
            onChange={(e) => setFilterLifeArea(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="all">Todas as Life Areas</option>
            {lifeAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="all">Todas Categorias</option>
            <option value="Reflexão">Reflexão</option>
            <option value="Insight">Insight</option>
            <option value="Progresso">Progresso</option>
          </select>

          
        </div>

        {/* CALENDÁRIO */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <FullCalendar
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            events={calendarEvents}
            eventClick={(info) => {
              alert("Entry: " + info.event.title);
            }}
          />
        </div>

        {/* ADD ENTRY */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          {/* CAMPOS DE CRIAÇÃO (life area, categoria, emoji) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <select
              value={createLifeAreaId}
              onChange={(e) => setCreateLifeAreaId(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="all">Selecione a Life Area</option>
              {lifeAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>

            <select
              value={createCategory}
              onChange={(e) => setCreateCategory(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="">Categoria</option>
              <option value="Reflexão">Reflexão</option>
              <option value="Insight">Insight</option>
              <option value="Progresso">Progresso</option>
            </select>

            <select
              value={createEmoji}
              onChange={(e) => setCreateEmoji(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="">Emoji</option>
              <option value="🧠">🧠</option>
              <option value="💪">💪</option>
              <option value="🔥">🔥</option>
              <option value="❤️">❤️</option>
            </select>
          </div>

          {/* Textarea */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 mt-1">
              <Edit3 size={16} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <textarea
                value={journalInput}
                onChange={(e) => setJournalInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="What's on your mind today?"
                className="w-full p-3 border rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">
                  Press Enter to add entry
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!journalInput.trim() || isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Add Entry
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* EXIBIÇÃO AGRUPADA */}
        <div className="space-y-6">
          {groupedByLifeArea.map((group) => (
            <div key={group.id}>
              <h2 className="text-lg font-semibold mb-3 text-white">
                {group.name}
              </h2>

              <div className="grid gap-4">
                {group.journals.length > 0 ? (
                  group.journals.map((entry) => (
                    <div
                      key={entry.id}
                      className={`bg-white rounded-lg p-4 ${
                        entry.is_favorite
                          ? "border-2 border-yellow-400 shadow-[0_0_10px_rgba(255,215,0,0.5)]"
                          : "shadow"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              entry.is_auto ? "bg-blue-100" : "bg-green-100"
                            }`}
                          >
                            {entry.is_auto ? (
                              <Bot size={16} />
                            ) : (
                              <User size={16} />
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  entry.is_auto
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {entry.is_auto
                                  ? "Auto-Generated"
                                  : "Manual Entry"}
                              </span>

                              <div className="flex items-center text-xs text-gray-500">
                                <Clock size={12} className="mr-1" />
                                {isToday(entry.created_at) ? (
                                  <span>
                                    Today at {formatTime(entry.created_at)}
                                  </span>
                                ) : (
                                  <span>
                                    {formatDate(entry.created_at)} at{" "}
                                    {formatTime(entry.created_at)}
                                  </span>
                                )}
                              </div>

                              {entry.category && (
                                <span className="ml-2 text-xs px-2 py-1 rounded bg-gray-100">
                                  {entry.category}
                                </span>
                              )}

                              {entry.emoji && (
                                <span className="ml-1">{entry.emoji}</span>
                              )}
                            </div>

                            <p className="text-gray-900 leading-relaxed">
                              {entry.content}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 ml-2">
                          <button
                            onClick={() => handleToggleFavorite(entry)}
                            className={`${
                              entry.is_favorite
                                ? "text-yellow-400"
                                : "text-gray-400 hover:text-yellow-500"
                            }`}
                          >
                            ★
                          </button>

                          <button
                            onClick={() =>
                              handleDeleteEntry(entry.id)
                            }
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 bg-white rounded-lg shadow">
                    <p className="text-gray-500">
                      Nenhum diário nessa área.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
};

export default JournalPage;
