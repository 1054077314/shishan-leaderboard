import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { KillLineRecord } from "./types";
import { ModelService } from "./services/modelService";
import { useRankingData } from "./services/rankingSource";

// UI Components
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { CustomCursor } from "./components/CustomCursor";
import { TierHierarchy } from "./components/TierHierarchy";

// Feature Components (Business logic modules)
import {
  BentoStats,
  KillLineTable,
  ModelDetailModal,
  ModelComparatorModal,
} from "./components/features/matrix";
import { ScoreTrendChart } from "./components/features/trajectory";
import { CostVisualizer } from "./components/features/cost";
import { BilibiliEpisodesPanel } from "./components/features/episodes";

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTier, setFilterTier] = useState("ALL");
  const [sortBy, setSortBy] = useState<"score" | "name" | "diamond" | "king">("score");

  // 排名数据来自运行时数据源，dataVersion 一变就会自动重排
  const {
    ranked: allModels,
    payload,
    loading: rankingLoading,
    usingFallback,
    lastSyncedAt,
    refresh: refreshRanking,
  } = useRankingData();

  const [selectedModel, setSelectedModel] = useState<KillLineRecord>(allModels[0]);
  const [selectedForCompare, setSelectedForCompare] = useState<KillLineRecord[]>([]);
  const [isComparatorOpen, setIsComparatorOpen] = useState(false);
  const [detailModalModel, setDetailModalModel] = useState<KillLineRecord | null>(null);
  const [cursorEnabled, setCursorEnabled] = useState(true);
  const [cursorMode, setCursorMode] = useState<"default" | "lens" | "button">("default");
  const [copied, setCopied] = useState(false);

  // Sync has-custom-cursor class to body
  useEffect(() => {
    if (cursorEnabled) {
      document.body.classList.add("has-custom-cursor");
    } else {
      document.body.classList.remove("has-custom-cursor");
    }
    return () => {
      document.body.classList.remove("has-custom-cursor");
    };
  }, [cursorEnabled]);

  const handleMouseEnterLens = () => setCursorMode("lens");
  const handleMouseLeaveCursor = () => setCursorMode("default");

  const handleToggleCompare = (model: KillLineRecord) => {
    setSelectedForCompare((prev) => {
      const exists = prev.some((m) => m.id === model.id);
      if (exists) {
        return prev.filter((m) => m.id !== model.id);
      }
      if (prev.length >= 2) {
        return [prev[0], model];
      }
      return [...prev, model];
    });
  };

  const handleOpenComparator = () => {
    if (selectedForCompare.length === 0) {
      const astra = ModelService.getModelById(allModels, "gpt-6-astra") || allModels[0];
      const flash =
        ModelService.getModelById(allModels, "deepseek-v41-flash") || allModels[1];
      setSelectedForCompare([astra, flash]);
    } else if (selectedForCompare.length === 1) {
      const candidate = allModels.find((m) => m.id !== selectedForCompare[0].id) || allModels[0];
      setSelectedForCompare([selectedForCompare[0], candidate]);
    }
    setIsComparatorOpen(true);
  };

  const handleSelectModelForSlot = (slotIndex: number, model: KillLineRecord) => {
    setSelectedForCompare((prev) => {
      const updated = [...prev];
      updated[slotIndex] = model;
      return updated;
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportData = (format: "json" | "csv") => {
    ModelService.exportData(allModels, format, {
      episodesCovered: payload?.episodes?.length ?? 0,
      videosFound: payload?.videos?.length ?? payload?.episodes?.length ?? 0,
      pending: payload?.pendingEpisodes?.length ?? 0,
    });
  };

  const handleSelectHighlight = (type: "ASTRA" | "DS_FLASH" | "DIAMOND" | "KING") => {
    if (type === "ASTRA") {
      const astra = ModelService.getModelById(allModels, "gpt-6-astra");
      if (astra) {
        setSelectedModel(astra);
        setDetailModalModel(astra);
      }
    } else if (type === "DS_FLASH") {
      const ds = ModelService.getModelById(allModels, "deepseek-v41-flash");
      if (ds) {
        setSelectedModel(ds);
        setDetailModalModel(ds);
      }
    } else if (type === "DIAMOND") {
      setFilterTier("ALL");
      setSortBy("diamond");
    } else if (type === "KING") {
      setFilterTier("TOP");
      setSortBy("king");
    }
  };

  // Delegated to ModelService
  // 依赖里带上 allModels：数据版本一换，排序立即重算
  const filteredAndSortedData = useMemo(() => {
    return ModelService.filterAndSortModels(allModels, {
      searchQuery,
      filterTier,
      sortBy,
    });
  }, [allModels, searchQuery, filterTier, sortBy]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#ededed] font-sans antialiased selection:bg-rose-500/20 selection:text-rose-200">
      <div className="grain-overlay" />

      <CustomCursor
        mode={cursorMode}
        lensSize={140}
        enabled={cursorEnabled}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <Header
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            cursorEnabled={cursorEnabled}
            onToggleCursor={() => setCursorEnabled((prev) => !prev)}
            selectedForCompare={selectedForCompare}
            onOpenComparator={handleOpenComparator}
            onExportData={handleExportData}
            copied={copied}
            onCopyLink={handleCopyLink}
          />
        </motion.div>

        {/* 4 Bento Stat Cards */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <BentoStats
            onSelectHighlight={handleSelectHighlight}
            onMouseEnter={handleMouseEnterLens}
            onMouseLeave={handleMouseLeaveCursor}
          />
        </motion.div>

        {/* Matrix Table */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <KillLineTable
            data={filteredAndSortedData}
            dataVersion={payload?.dataVersion ?? ""}
            updatedAt={payload?.updatedAt ?? ""}
            pendingEpisodes={payload?.pendingEpisodes ?? []}
            episodesCovered={payload?.episodes?.length ?? 0}
            videosFound={payload?.videos?.length ?? payload?.episodes?.length ?? 0}
            syncing={rankingLoading}
            usingFallback={usingFallback}
            lastSyncedAt={lastSyncedAt}
            onRefresh={refreshRanking}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            selectedForCompare={selectedForCompare}
            onToggleCompare={handleToggleCompare}
            onOpenDetailModal={setDetailModalModel}
            filterTier={filterTier}
            onFilterTierChange={setFilterTier}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            onMouseEnter={handleMouseEnterLens}
            onMouseLeave={handleMouseLeaveCursor}
          />
        </motion.div>

        {/* Score Evolution Trendline (Recharts) */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <ScoreTrendChart
            selectedModel={selectedModel}
            onMouseEnter={handleMouseEnterLens}
            onMouseLeave={handleMouseLeaveCursor}
          />
        </motion.div>

        {/* Cost Section */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <CostVisualizer
            onMouseEnter={handleMouseEnterLens}
            onMouseLeave={handleMouseLeaveCursor}
          />
        </motion.div>

        {/* Hierarchy Ladder */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <TierHierarchy
            onMouseEnter={handleMouseEnterLens}
            onMouseLeave={handleMouseLeaveCursor}
          />
        </motion.div>

        {/* Bilibili Official 12 Episodes Explorer */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <BilibiliEpisodesPanel
            onSelectModelFilter={(modelName) => {
              setSearchQuery(modelName);
              const el = document.getElementById("kill-line-matrix");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            onMouseEnter={handleMouseEnterLens}
            onMouseLeave={handleMouseLeaveCursor}
          />
        </motion.div>

        {/* Footer */}
        <Footer />
      </div>

      {/* Side-by-Side Model Comparator Modal */}
      <ModelComparatorModal
        isOpen={isComparatorOpen}
        onClose={() => setIsComparatorOpen(false)}
        models={selectedForCompare}
        allModels={allModels}
        onSelectModelForSlot={handleSelectModelForSlot}
      />

      {/* Model Detail Modal */}
      <ModelDetailModal
        model={detailModalModel}
        isOpen={!!detailModalModel}
        onClose={() => setDetailModalModel(null)}
        onAddToCompare={(model) => {
          handleToggleCompare(model);
          handleOpenComparator();
        }}
      />
    </div>
  );
}
