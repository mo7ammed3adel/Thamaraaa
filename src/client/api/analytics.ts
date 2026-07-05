import { buildQueryString, getJson } from "@/client/transport/http";

type DateRange = {
  from?: string | null;
  to?: string | null;
};

export function getMyProgress(params: DateRange) {
  return getJson(`/api/analytics/my-progress${buildQueryString(params)}`);
}

export function getMyTarget() {
  return getJson("/api/analytics/my-target");
}

export function getTeleSalesTeamAnalytics(params: DateRange) {
  return getJson(`/api/analytics/team${buildQueryString(params)}`);
}

export function getTeleSalesAgentAnalytics(params: DateRange & { agentId: string }) {
  return getJson(`/api/analytics/agent${buildQueryString(params)}`);
}

export function getTeleSalesTeamDrill(params: DateRange & { drillDown: string }) {
  return getJson(`/api/analytics/team/drill${buildQueryString(params)}`);
}

export function getSalesTeamAnalytics(params: DateRange) {
  return getJson(`/api/analytics/sales-team${buildQueryString(params)}`);
}

export function getSalesAgentAnalytics(params: DateRange & { agentId: string }) {
  return getJson(`/api/analytics/sales-agent${buildQueryString(params)}`);
}

export function getSalesTeamDrill(params: DateRange & { drillDown: string }) {
  return getJson(`/api/analytics/sales-team/drill${buildQueryString(params)}`);
}

export function getChiefSalesAnalytics(params: { range: string }) {
  return getJson(`/api/analytics/chief-sales${buildQueryString(params)}`);
}
