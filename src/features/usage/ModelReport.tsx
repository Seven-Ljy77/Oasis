import React from 'react';
import { UsageReportView } from './UsageReportView';

interface ModelReportProps {
  modelId?: number;
  modelName?: string;
}

export const ModelReport: React.FC<ModelReportProps> = ({ modelId, modelName }) => (
  <UsageReportView
    title={modelName ?? 'Model'}
    subtitle="Model usage statistics"
  />
);

export default ModelReport;
