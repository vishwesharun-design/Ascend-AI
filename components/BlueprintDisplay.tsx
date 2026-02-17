import React, { useMemo } from "react";
import { SuccessBlueprint } from "../types";
import { useTypeWriter } from "../hooks/useTypeWriter";

interface BlueprintDisplayProps {
  blueprint: SuccessBlueprint;
  isDarkMode?: boolean;
  isStreaming?: boolean;
}

const cleanText = (text: string) => {
  if (!text) return "";
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/`/g, "")
    .trim();
};

const BlueprintDisplay: React.FC<BlueprintDisplayProps> = ({
  blueprint,
  isDarkMode = true,
  isStreaming = false,
}) => {
  // Use typewriter effect for streaming content
  const displayDescription = useTypeWriter(
    blueprint.strategyRoadmap[0]?.description || '', 
    isStreaming ? 15 : 0
  );

  if (!blueprint) return null;

  const getPhaseEmoji = (index: number) => {
    const emojis = ["🎯", "⚙️", "🚀", "💡", "🔥"];
    return emojis[index % emojis.length];
  };

  return (
    <div className="pb-20 w-full">

      {/* HEADER SECTION */}
      <div
        className={`p-8 md:p-12 rounded-2xl border-2 mb-6 ${isDarkMode
            ? "bg-gradient-to-br from-slate-900 to-slate-800 border-blue-500/30"
            : "bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300"
          }`}
      >
        <h2 className={`text-4xl md:text-5xl font-black tracking-tight mb-4 ${isDarkMode ? "text-blue-300" : "text-blue-700"}`}>
          ✨ {cleanText(blueprint.goalTitle) || "Strategic Blueprint"}
        </h2>

        <p
          className={`text-lg leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
        >
          💭 {cleanText(blueprint.visionStatement) || ""}
        </p>
      </div>

      {/* CORE FOCUS SECTION - HORIZONTAL */}
      {blueprint.coreFocus && blueprint.coreFocus.length > 0 && (
        <div
          className={`p-6 rounded-2xl border-2 mb-6 ${isDarkMode
              ? "bg-slate-900/50 border-purple-500/30"
              : "bg-purple-50 border-purple-300"
            }`}
        >
          <h3 className={`text-xl font-black mb-4 ${isDarkMode ? "text-purple-300" : "text-purple-700"}`}>
            🎯 Core Focus Areas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {blueprint.coreFocus.map((focus, i) => (
              <div key={i} className={`p-4 rounded-xl ${isDarkMode ? "bg-slate-800/50" : "bg-white/50"}`}>
                <p className={isDarkMode ? "text-slate-200" : "text-slate-800"}>
                  💫 {cleanText(focus)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXECUTION PHASES - HORIZONTAL GRID */}
      <div className="mb-6">
        <h3 className={`text-2xl font-black mb-4 ${isDarkMode ? "text-cyan-300" : "text-cyan-700"}`}>
          📋 Execution Phases
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.isArray(blueprint.strategyRoadmap) &&
            blueprint.strategyRoadmap.map((step, index) => (
              <div
                key={index}
                className={`p-6 rounded-2xl border-2 transition-all hover:shadow-lg ${isDarkMode
                    ? "bg-slate-900/50 border-cyan-500/30"
                    : "bg-cyan-50 border-cyan-300"
                  }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">{getPhaseEmoji(index)}</span>
                  <div className="flex-1">
                    <h4 className={`text-base font-black ${isDarkMode ? "text-cyan-300" : "text-cyan-700"}`}>
                      {cleanText(step.title) || `Phase ${index + 1}`}
                    </h4>
                    {step.timeline && (
                      <span className={`text-xs font-semibold block mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                        ⏱️ {cleanText(step.timeline)}
                      </span>
                    )}
                  </div>
                </div>

                <div className={`text-sm leading-relaxed line-clamp-4 ${isDarkMode ? "text-slate-300" : "text-slate-800"}`}>
                  {isStreaming && index === 0 ? displayDescription : (typeof step.description === "string"
                    ? cleanText(step.description)
                    : "")}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* MARKET INTELLIGENCE - HORIZONTAL GRID */}
      {Array.isArray(blueprint.marketAnalysis) &&
        blueprint.marketAnalysis.length > 0 && (
          <div
            className={`p-6 rounded-2xl border-2 ${isDarkMode
                ? "bg-slate-900/50 border-amber-500/30"
                : "bg-amber-50 border-amber-300"
              }`}
          >
            <h3 className={`text-2xl font-black mb-4 ${isDarkMode ? "text-amber-300" : "text-amber-700"}`}>
              📊 Market Intelligence
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {blueprint.marketAnalysis.map((item, i) => (
                <div key={i} className={`p-4 rounded-xl border ${isDarkMode ? "bg-slate-800/50 border-amber-500/20" : "bg-white/50 border-amber-200"}`}>
                  <div className="flex gap-3">
                    <span className="text-2xl flex-shrink-0">📈</span>
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-bold text-sm mb-1 ${isDarkMode ? "text-amber-200" : "text-amber-800"}`}>
                        {cleanText(item.title)}
                      </h4>
                      <p className={`text-sm line-clamp-3 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                        {cleanText(typeof item.description === "string" ? item.description : "")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

    </div>
  );
};

export default BlueprintDisplay;
