import React, { useState } from "react";
import UsageReportView from "./UsageReportView";

const ProviderReport: React.FC = () => {
  const [taskType, setTaskType] = useState<string>("all");

  const taskTypes = [
    { value: "all", label: "All Tasks" },
    { value: "summary", label: "Summary" },
    { value: "translation", label: "Translation" },
    { value: "tagging", label: "Tagging" },
  ];

  const filters = (
    <select
      value={taskType}
      onChange={(e) => setTaskType(e.target.value)}
      className="h-7 px-2 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none"
    >
      {taskTypes.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );

  return (
    <UsageReportView
      title="Provider Usage Report"
      subtitle="Local LLM (http://localhost:5810/v1)"
      filters={filters}
    />
  );
};

export default ProviderReport;
export { ProviderReport };
