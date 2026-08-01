import React from 'react';
import { UsageReportView } from './UsageReportView';

interface AgentReportProps {
  agentType?: string;
}

export const AgentReport: React.FC<AgentReportProps> = ({ agentType }) => (
  <UsageReportView
    title={agentType ?? 'Agent'}
    subtitle="Agent usage statistics"
  />
);

export default AgentReport;
